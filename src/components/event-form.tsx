import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { DateField, TimeField } from '@/components/datetime-fields';
import { EventTaskSection, type LocalTask } from '@/components/event-task-section';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import {
    ScrollOverflowChevron,
    useHorizontalOverflow,
} from '@/components/scroll-overflow-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import {
    UNASSIGNED_COLOR,
    colorForResponsible,
    memberColorMap,
} from '@/lib/colors';
import type {
    Child,
    HouseholdMember,
    List,
    Location,
    LocationPlaceInput,
    NewEventInput,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';
import { EVENT_TYPES } from '@/lib/event-types';
import {
    RECURRENCE_PRESET_OPTIONS,
    WEEKDAY_OPTIONS,
    buildRRule,
    parseRecurrence,
    weekdayForDate,
    type RecurrencePresetId,
    type WeekdayCode,
} from '@/lib/recurrence';

export type EventFormSubmitInput = NewEventInput & {
    /** Raw location form values; the screen resolves these into a locationId before saving. */
    locationName: string;
    locationMapsUrl: string;
    /**
     * When the user picked a Google Places suggestion, this carries place_id + formatted
     * address so the screen can pass them to resolveLocationId (which dedupes by place_id
     * and persists the postal address). Null when the user typed a name by hand.
     */
    locationPlace: LocationPlaceInput | null;
    /**
     * 'series' = update the master event (current behavior). 'occurrence' = upsert a
     * responsible-parent override row for the given recurringInstanceDate; only
     * responsibleProfileId is meaningful in that branch — every other field stays as
     * the master's value (and is force-disabled in the form when this mode is active).
     */
    applyTo: 'series' | 'occurrence';
    /**
     * Final list of tasks the user wants attached to this event after save. The screen
     * diffs this against the snapshot it loaded into the form on mount to figure out
     * which DB rows to insert, update, or delete. Empty array = no tasks.
     */
    tasks: LocalTask[];
};

export type EventFormValues = {
    title: string;
    date: string; // YYYY-MM-DD (start date)
    /**
     * End date for all-day events that span multiple days (e.g. a vacation Mon→Wed).
     * YYYY-MM-DD, inclusive. Equal to `date` for single-day all-day events. Ignored
     * when `allDay` is false (timed events use endTime instead). The submit path
     * converts this to ends_at = endDate + 1 day at 00:00 (exclusive end, same
     * convention as before for single-day events).
     */
    endDate: string;
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    allDay: boolean;
    locationName: string;
    locationMapsUrl: string;
    notes: string;
    responsibleProfileId: string | null;
    /** Existing rule when editing; null for new events. */
    recurrenceRule: string | null;
    /** Optional event type id (e.g. "pickup", "sports"). Null = no icon. */
    eventType: string | null;
    /**
     * IANA tz anchoring the event's wall clock. For new events the screen pre-fills with
     * the browser's tz; on edit the existing tz is preserved (we don't silently rebind
     * an event to the editor's current tz, since that would shift recurring instances).
     */
    timezone: string | null;
    /** Children this event applies to. Empty = household-wide (no badges shown). */
    childIds: string[];
    /** Alternation mode for recurring events; null = use static responsibleProfileId. */
    alternation: 'same_day' | 'previous_day' | null;
};

type Props = {
    headerTitle: string;
    submitLabel?: string;
    members: HouseholdMember[];
    locations: Location[];
    /** Household roster used to render the per-child multi-select chips. */
    children: Child[];
    /** Lists available to this household. Threaded into the inline EventTaskSection
     *  so the user can file event-linked tasks into Groceries / Urgent / etc. at
     *  creation time instead of always landing in Inbox. */
    lists: List[];
    currentUserId: string;
    initialValues: EventFormValues;
    /**
     * Surfaces the two "↻ Alternates" chips. Should only be true for separated households
     * with a configured custody schedule — otherwise there's nothing to alternate against.
     */
    showAlternationChips?: boolean;
    /**
     * YYYY-MM-DD of the specific occurrence the user clicked into. Set only when editing
     * one instance of a recurring event. Enables the "Apply to: this occurrence / entire
     * series" toggle and unlocks the override save path.
     */
    recurringInstanceDate?: string | null;
    /** True when an event_occurrence_overrides row already exists for this date. */
    hasExistingOccurrenceOverride?: boolean;
    /**
     * The override row's responsible_profile_id (null is a valid value meaning "Anyone
     * for this date"). Only consulted when hasExistingOccurrenceOverride is true; used
     * to preload the responsible chip when the user flips to occurrence mode.
     */
    occurrenceOverrideResponsibleId?: string | null;
    /** Removes the existing override row, reverting the occurrence to the series rule. */
    onRemoveOccurrenceOverride?: () => Promise<void>;
    /**
     * Initial task list loaded from the DB (empty for new events). The form mutates a
     * local copy and includes the final state in the EventFormSubmitInput; the screen
     * diffs and writes.
     */
    initialTasks?: LocalTask[];
    /**
     * Optional handler for the inline complete-checkbox on tasks that already have a
     * dbId. Lets the user check things off without saving the whole form.
     */
    onCompleteTaskImmediate?: (dbId: string, completed: boolean) => Promise<void>;
    onSubmit: (input: EventFormSubmitInput) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

export function EventForm({
    headerTitle,
    submitLabel = 'Save',
    members,
    locations,
    children,
    lists,
    currentUserId,
    initialValues,
    showAlternationChips = false,
    recurringInstanceDate = null,
    hasExistingOccurrenceOverride = false,
    occurrenceOverrideResponsibleId = null,
    onRemoveOccurrenceOverride,
    initialTasks = [],
    onCompleteTaskImmediate,
    onSubmit,
    onDelete,
    onCancel,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [title, setTitle] = useState(initialValues.title);
    const [date, setDate] = useState(initialValues.date);
    const [endDate, setEndDate] = useState(initialValues.endDate);
    const [startTime, setStartTime] = useState(initialValues.startTime);
    const [endTime, setEndTime] = useState(initialValues.endTime);
    const [allDay, setAllDay] = useState(initialValues.allDay);
    // Multi-select set of child ids this event applies to. Empty = household-wide.
    const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(
        () => new Set(initialValues.childIds),
    );
    const toggleChild = (childId: string) => {
        setSelectedChildIds((prev) => {
            const next = new Set(prev);
            if (next.has(childId)) next.delete(childId);
            else next.add(childId);
            return next;
        });
    };
    const [locationName, setLocationName] = useState(initialValues.locationName);
    const [locationMapsUrl, setLocationMapsUrl] = useState(initialValues.locationMapsUrl);
    // Captured when the user picks a Google Places suggestion. Cleared once the user edits
    // the name to something that doesn't match the picked place.
    const [pickedPlace, setPickedPlace] = useState<LocationPlaceInput | null>(null);
    const [pickedPlaceAddress, setPickedPlaceAddress] = useState<string>('');
    // UX-010: overflow indicator for the saved-locations chip strip.
    const locationsOverflow = useHorizontalOverflow();
    const [notes, setNotes] = useState(initialValues.notes);
    const [responsibleId, setResponsibleId] = useState<string | null>(
        initialValues.responsibleProfileId,
    );
    // Alternation mode is mutually exclusive with a specific responsibleId. The setters
    // below clear the other state on every transition.
    const [alternation, setAlternation] = useState<'same_day' | 'previous_day' | null>(
        initialValues.alternation,
    );
    const pickResponsibleProfile = (profileId: string | null) => {
        setResponsibleId(profileId);
        setAlternation(null);
    };
    const pickAlternation = (mode: 'same_day' | 'previous_day') => {
        setAlternation(mode);
        setResponsibleId(null);
    };

    // "Apply to" mode for editing a recurring event's instance. Defaults to series so
    // accidental occurrence-only edits don't happen — the user opts in deliberately.
    // When recurringInstanceDate is null (creating, or editing a one-off) the toggle
    // doesn't appear and applyTo stays 'series' forever.
    const [applyTo, setApplyTo] = useState<'series' | 'occurrence'>('series');
    const showApplyToToggle = !!recurringInstanceDate;

    // When the user flips the Apply-To toggle, re-seed the responsible chip:
    //   series → master's responsible (initialValues.responsibleProfileId)
    //   occurrence + existing override → the override's responsible
    //   occurrence + no override → master's responsible (sensible starting point;
    //                              user can change before saving to create the override)
    // Side effect: any in-progress chip selection is lost on toggle, which is consistent
    // with the "mode shift" semantic.
    //
    // QA-006: we only re-seed on an actual `applyTo` TRANSITION, not whenever the
    // override-map dep identities change. Previously, if useEventOccurrenceOverrides
    // refetched while the user was editing in occurrence mode, `hasExistingOccurrenceOverride`
    // and `occurrenceOverrideResponsibleId` could flip prop identity and the effect
    // would overwrite the user's in-progress chip pick. By gating on a ref-tracked
    // previous applyTo, we read the override values "at the moment of toggle" but ignore
    // subsequent refetches.
    const prevApplyToRef = useRef<'series' | 'occurrence'>(applyTo);
    const hasExistingOverrideRef = useRef(hasExistingOccurrenceOverride);
    const overrideResponsibleRef = useRef(occurrenceOverrideResponsibleId);
    hasExistingOverrideRef.current = hasExistingOccurrenceOverride;
    overrideResponsibleRef.current = occurrenceOverrideResponsibleId;
    useEffect(() => {
        if (prevApplyToRef.current === applyTo) return;
        prevApplyToRef.current = applyTo;
        if (applyTo === 'occurrence' && hasExistingOverrideRef.current) {
            setResponsibleId(overrideResponsibleRef.current);
            setAlternation(null);
        } else {
            setResponsibleId(initialValues.responsibleProfileId);
            setAlternation(initialValues.alternation);
        }
        // initialValues is captured-on-mount; ESLint can't see that. The other reads come
        // from refs intentionally so we don't react to mid-edit refetches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyTo]);
    // When the user is editing just one occurrence, every field except the responsible
    // parent chips is read-only — overriding title/time/etc. for one instance isn't
    // supported (and would muddle the data model). Combined with `busy` to also lock
    // during network calls.
    const lockExceptResponsible = applyTo === 'occurrence';
    const [eventType, setEventType] = useState<string | null>(initialValues.eventType);
    const parsedRecurrence = useMemo(
        () => parseRecurrence(initialValues.recurrenceRule),
        [initialValues.recurrenceRule],
    );
    const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePresetId>(
        parsedRecurrence.preset,
    );
    const [customDays, setCustomDays] = useState<Set<WeekdayCode>>(
        () => new Set(parsedRecurrence.byday),
    );
    // Optional end date for recurring events ("Ends on …"). Empty string = open-ended.
    // Pre-filled from the existing UNTIL clause when editing a series.
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
        parsedRecurrence.until ?? '',
    );

    // Local task list. Initial values come from the DB; mutations stay in local state
    // until form submit, when the screen diffs and writes. The completed-checkbox does
    // fire onCompleteTaskImmediate inline for already-persisted tasks so users don't
    // have to "save" the whole event just to check something off.
    const [tasks, setTasks] = useState<LocalTask[]>(initialTasks);
    const [submitting, setSubmitting] = useState(false);

    const handleSelectPreset = (id: RecurrencePresetId) => {
        setRecurrencePreset(id);
        if (id === 'custom' && customDays.size === 0) {
            // Seed Custom with the event's own weekday so the picker has a sensible default.
            const dt = new Date(`${date}T00:00`);
            if (!Number.isNaN(dt.getTime())) {
                setCustomDays(new Set([weekdayForDate(dt)]));
            }
        }
    };

    const toggleCustomDay = (code: WeekdayCode) => {
        setCustomDays((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UX-016: clear the inline error whenever any input that participates in
    // validation changes. Web users were left staring at a red "Recurrence end
    // date must be on or after the event's start date" line after fixing the
    // field. Native users dodge this because the error path uses Alert.alert,
    // but we keep the effect tz-agnostic — clearing optimistically is safe
    // because Save re-runs the validation. Fires on transitions through the
    // tracked fields' identity; on initial mount `error` is already null so
    // the no-op runs once.
    useEffect(() => {
        if (error !== null) setError(null);
        // We intentionally only depend on the validated inputs, not `error`
        // itself — otherwise the effect would loop on every clear.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, endTime, recurrenceEndDate]);

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    // Memoized so PlacesAutocomplete's debounce effect doesn't re-arm on every
    // EventForm re-render. Without the memo, a fresh-identity array was passed
    // each render, the autocomplete's [value, placesOn, skipFetchValues] deps
    // would re-fire, the 300ms timer would reset, and the user's typing never
    // debounced to completion (QA-007).
    const skipFetchValues = useMemo(
        () =>
            locations.flatMap((l) =>
                [l.name, l.formatted_address ?? ''].filter((s) => s.length > 0),
            ),
        [locations],
    );

    // If the current name (case-insensitive) matches a saved location — or the picked
    // place_id matches one — treat it as picked: its Maps URL is the source of truth and
    // we hide the Maps URL input field.
    const matchedLocation = useMemo<Location | null>(() => {
        if (pickedPlace?.placeId) {
            const byPlaceId = locations.find(
                (l) => l.google_place_id === pickedPlace.placeId,
            );
            if (byPlaceId) return byPlaceId;
        }
        const t = locationName.trim().toLowerCase();
        if (!t) return null;
        // Match by either the saved name OR the formatted address — picking a chip puts
        // the address in the field, so we need to recognize both as "this saved entry".
        return (
            locations.find(
                (l) =>
                    l.name.toLowerCase() === t ||
                    (l.formatted_address ?? '').toLowerCase() === t,
            ) ?? null
        );
    }, [locations, locationName, pickedPlace]);

    // Manual Maps URL field appears only when the user is typing a brand-new location
    // by hand — picking a saved chip or a Google suggestion fills it for them.
    const showMapsUrlField =
        locationName.trim().length > 0 &&
        matchedLocation === null &&
        pickedPlace === null;

    const busy = submitting || deleting;
    // Locked-but-still-cancellable: in occurrence mode every field except the responsible
    // parent chips is read-only. The chips and the Cancel button keep using `busy` so
    // the user can still pick a different parent and bail out.
    const locked = busy || lockExceptResponsible;
    const canSubmit = title.trim().length > 0 && !busy;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            let startsAt: Date;
            let endsAt: Date;
            if (allDay) {
                // QA-005: All-day events are anchored at UTC midnight, not local
                // midnight. Otherwise the ISO string differs between viewers in
                // different timezones — a Tokyo creator's "May 22" was serializing
                // to 2026-05-21T15:00:00Z, which a US viewer's local-time render
                // would see as May 21. By writing UTC midnight everyone reads the
                // same calendar date back out (via the ISO date prefix).
                startsAt = new Date(`${date}T00:00:00Z`);
                // Multi-day all-day events: endDate is inclusive (a Mon→Wed
                // vacation has endDate = Wed). Convert to exclusive ends_at by
                // adding one day, matching the single-day convention where a
                // Tuesday event has ends_at = Wed 00:00. endDate defaults to
                // `date` so single-day events keep their existing semantics.
                const effectiveEndDate =
                    endDate && endDate >= date ? endDate : date;
                endsAt = new Date(`${effectiveEndDate}T00:00:00Z`);
                endsAt.setUTCDate(endsAt.getUTCDate() + 1);
            } else {
                startsAt = new Date(`${date}T${startTime}`);
                endsAt = new Date(`${date}T${endTime}`);
                if (endsAt <= startsAt) {
                    throw new Error('End time must be after the start time.');
                }
            }
            if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
                throw new Error('Invalid date or time.');
            }

            // For Custom: if days are picked, build a fresh BYDAY rule. If no days are picked
            // (the case where an unrecognized rule was loaded and the user didn't change it),
            // preserve the original rule so we don't silently lose it.
            const untilForRule =
                recurrenceEndDate.trim().length > 0 ? recurrenceEndDate.trim() : null;
            // UX-012 guard: prevent an UNTIL date earlier than the event's own
            // start. Without this the form happily saves a recurring rule with
            // UNTIL < DTSTART, which rrule expands to zero occurrences and the
            // event silently never shows up. Mirrors the existing "End time must
            // be after the start time" precedent.
            if (untilForRule && untilForRule < date) {
                throw new Error(
                    "Recurrence end date must be on or after the event's start date.",
                );
            }
            let recurrenceRule: string | null;
            if (recurrencePreset === 'custom') {
                if (customDays.size === 0) {
                    recurrenceRule = initialValues.recurrenceRule;
                } else {
                    recurrenceRule = buildRRule(
                        'custom',
                        Array.from(customDays),
                        untilForRule,
                    );
                }
            } else {
                recurrenceRule = buildRRule(recurrencePreset, undefined, untilForRule);
            }

            // QA-014: all-day events are anchored at UTC midnight (see the
            // QA-005 fix above). The stored timezone must match — if we keep
            // the editor's local IANA tz (e.g. America/New_York), the
            // recurrence expander's floating-DTSTART transform reads UTC
            // midnight as e.g. 19:00 EST the prior day, and DST transitions
            // shift each occurrence by an hour, which in the UTC-prefix
            // date-key logic (used by every all-day renderer) flips the
            // weekday of the occurrence. Hardcoding 'UTC' for all-day rows
            // makes the wall clock agree with the stored instant — no DST
            // shift, no drift. Timed events keep the editor's tz so DST
            // continues to keep the wall clock invariant.
            const submitTimezone = allDay ? 'UTC' : initialValues.timezone;
            await onSubmit({
                title: title.trim(),
                startsAt,
                endsAt,
                allDay,
                description: notes.trim() || null,
                location: locationName.trim() || null, // legacy text mirror
                responsibleProfileId: responsibleId,
                recurrenceRule,
                eventType,
                timezone: submitTimezone,
                childIds: Array.from(selectedChildIds),
                responsibleAlternation: alternation,
                locationName: locationName.trim(),
                locationMapsUrl: locationMapsUrl.trim(),
                locationPlace: pickedPlace,
                applyTo,
                tasks,
            });
        } catch (err) {
            console.error('event submit failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save event", msg);
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete || busy) return;
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' && window.confirm('Delete this event?')
                : await new Promise<boolean>((resolve) => {
                      Alert.alert('Delete this event?', 'This cannot be undone.', [
                          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                      ]);
                  });
        if (!confirmed) return;
        setDeleting(true);
        setError(null);
        try {
            await onDelete();
        } catch (err) {
            console.error('event delete failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't delete event", msg);
            setDeleting(false);
        }
    };

    const openMaps = (url: string) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url).catch(() => undefined);
        }
    };

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.headerBar}>
                    <Pressable
                        onPress={onCancel}
                        disabled={busy}
                        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold">{headerTitle}</ThemedText>
                    <Pressable
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            pressed && canSubmit && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: canSubmit ? '#6F7FA5' : colors.textSecondary,
                                fontWeight: '600',
                            }}>
                            {submitting ? 'Saving…' : submitLabel}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {/* "Apply to" toggle: only rendered when the user clicked into a
                        specific occurrence of a recurring event. Choosing "This occurrence"
                        switches the save path to write an override row for that date and
                        disables every field except the responsible-parent chips. */}
                    {showApplyToToggle ? (
                        <View
                            style={[
                                styles.applyToCard,
                                { backgroundColor: colors.backgroundElement },
                            ]}>
                            <ThemedText type="smallBold">Apply changes to</ThemedText>
                            <View style={styles.chipRow}>
                                {(['series', 'occurrence'] as const).map((mode) => {
                                    const selected = applyTo === mode;
                                    const label =
                                        mode === 'series'
                                            ? 'Entire series'
                                            : 'This occurrence only';
                                    return (
                                        <Pressable
                                            key={mode}
                                            onPress={() => setApplyTo(mode)}
                                            disabled={busy}
                                            style={({ pressed }) => [
                                                styles.chip,
                                                {
                                                    borderColor: '#6F7FA5',
                                                    backgroundColor: selected
                                                        ? '#6F7FA5'
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected ? '#fff' : colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {label}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <ThemedText themeColor="textSecondary" type="small">
                                {applyTo === 'occurrence'
                                    ? `Override responsible parent for ${recurringInstanceDate} only. Other fields are locked.`
                                    : 'Changes apply to every occurrence in the series.'}
                            </ThemedText>
                        </View>
                    ) : null}

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Title</ThemedText>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Soccer practice"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoFocus
                            editable={!locked}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Responsible parent</ThemedText>
                        <View style={styles.chipRow}>
                            {members.map((m) => {
                                const color = colorForResponsible(m.profile_id, colorMap);
                                // A parent chip is "selected" only when alternation is OFF
                                // and the id matches — alternation owns the responsibility
                                // when it's on, even if the underlying responsibleId is set.
                                const selected =
                                    alternation === null && responsibleId === m.profile_id;
                                const label = currentUserId === m.profile_id ? 'Me' : m.display_name;
                                return (
                                    <Pressable
                                        key={m.profile_id}
                                        onPress={() => pickResponsibleProfile(m.profile_id)}
                                        disabled={busy}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                borderColor: color,
                                                backgroundColor: selected ? color : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <View style={[styles.chipDot, { backgroundColor: color }]} />
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: selected ? '#fff' : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            {label}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                            <Pressable
                                onPress={() => pickResponsibleProfile(null)}
                                disabled={busy}
                                style={({ pressed }) => [
                                    styles.chip,
                                    {
                                        borderColor: UNASSIGNED_COLOR,
                                        backgroundColor:
                                            alternation === null && responsibleId === null
                                                ? UNASSIGNED_COLOR
                                                : 'transparent',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <View style={[styles.chipDot, { backgroundColor: UNASSIGNED_COLOR }]} />
                                <ThemedText
                                    type="small"
                                    style={{
                                        color:
                                            alternation === null && responsibleId === null
                                                ? '#fff'
                                                : colors.text,
                                        fontWeight: '500',
                                    }}>
                                    Anyone
                                </ThemedText>
                            </Pressable>

                            {/* Alternation chips: only meaningful when there's a custody
                                schedule to derive responsibility from. Hidden in occurrence
                                mode (per-occurrence overrides are always a specific parent). */}
                            {showAlternationChips && !lockExceptResponsible ? (
                                <>
                                    <Pressable
                                        onPress={() => pickAlternation('same_day')}
                                        disabled={locked}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                borderColor: '#6F7FA5',
                                                backgroundColor:
                                                    alternation === 'same_day'
                                                        ? '#6F7FA5'
                                                        : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color:
                                                    alternation === 'same_day'
                                                        ? '#fff'
                                                        : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            ↻ Alternates
                                        </ThemedText>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => pickAlternation('previous_day')}
                                        disabled={locked}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                borderColor: '#6F7FA5',
                                                backgroundColor:
                                                    alternation === 'previous_day'
                                                        ? '#6F7FA5'
                                                        : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color:
                                                    alternation === 'previous_day'
                                                        ? '#fff'
                                                        : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            ↻ Alternates (overnight)
                                        </ThemedText>
                                    </Pressable>
                                </>
                            ) : null}
                        </View>
                        {alternation ? (
                            <ThemedText themeColor="textSecondary" type="small">
                                {alternation === 'same_day'
                                    ? 'The responsible parent on each occurrence comes from the custody schedule for that day.'
                                    : 'The responsible parent on each occurrence comes from the custody schedule for the night before (good for morning drop-offs).'}
                            </ThemedText>
                        ) : null}
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Type</ThemedText>
                        <View style={styles.chipRow}>
                            <Pressable
                                onPress={() => setEventType(null)}
                                disabled={locked}
                                style={({ pressed }) => [
                                    styles.chip,
                                    {
                                        borderColor: colors.backgroundSelected,
                                        backgroundColor: eventType === null ? '#6F7FA5' : 'transparent',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{
                                        color: eventType === null ? '#fff' : colors.text,
                                        fontWeight: '500',
                                    }}>
                                    None
                                </ThemedText>
                            </Pressable>
                            {EVENT_TYPES.map((t) => {
                                const selected = eventType === t.id;
                                return (
                                    <Pressable
                                        key={t.id}
                                        onPress={() => setEventType(t.id)}
                                        disabled={locked}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                borderColor: colors.backgroundSelected,
                                                backgroundColor: selected ? '#6F7FA5' : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: selected ? '#fff' : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            {t.icon} {t.label}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Per-child multi-select. Hidden entirely for households with no kids
                        so empty households (single roommate, couples without kids) don't
                        see a dead UI affordance. */}
                    {children.length > 0 ? (
                        <View style={styles.field}>
                            <ThemedText type="smallBold">For child(ren)</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                Leave blank for household-wide events.
                            </ThemedText>
                            <View style={styles.chipRow}>
                                {children.map((c) => {
                                    const selected = selectedChildIds.has(c.id);
                                    return (
                                        <Pressable
                                            key={c.id}
                                            onPress={() => toggleChild(c.id)}
                                            disabled={locked}
                                            style={({ pressed }) => [
                                                styles.chip,
                                                {
                                                    borderColor: c.color,
                                                    backgroundColor: selected
                                                        ? c.color
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ChildBadge
                                                name={c.display_name}
                                                color={c.color}
                                                size="sm"
                                            />
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    // Dark text everywhere — the pastel
                                                    // background plus chip border is enough
                                                    // contrast; flipping to white on selected
                                                    // would clash with the badge's dark letter.
                                                    color: colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {c.display_name}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.field}>
                        <ThemedText type="smallBold">
                            {allDay ? 'Start date' : 'Date'}
                        </ThemedText>
                        <DateField
                            value={date}
                            onChange={(next) => {
                                setDate(next);
                                // Snap endDate forward if the new start date is past
                                // the current end date — otherwise we'd silently
                                // store an inverted range. The user can still drag
                                // it back if they meant something different.
                                if (next && endDate && next > endDate) {
                                    setEndDate(next);
                                }
                            }}
                        />
                    </View>

                    <View style={styles.allDayRow}>
                        <ThemedText type="smallBold">All day</ThemedText>
                        <Switch value={allDay} onValueChange={setAllDay} disabled={locked} />
                    </View>

                    {allDay ? (
                        // Multi-day all-day events. Defaults to start date so a
                        // single-day event is the no-op default. Validation in the
                        // submit path snaps endDate >= date if a stale value somehow
                        // slipped through (e.g. via setDate not re-running).
                        <View style={styles.field}>
                            <ThemedText type="smallBold">End date</ThemedText>
                            <DateField value={endDate} onChange={setEndDate} />
                        </View>
                    ) : (
                        <View style={styles.timeRow}>
                            <View style={styles.timeField}>
                                <ThemedText type="smallBold">Start</ThemedText>
                                <TimeField value={startTime} onChange={setStartTime} />
                            </View>
                            <View style={styles.timeField}>
                                <ThemedText type="smallBold">End</ThemedText>
                                <TimeField value={endTime} onChange={setEndTime} />
                            </View>
                        </View>
                    )}

                    {/* Repeats */}
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Repeats</ThemedText>
                        <View style={styles.chipRow}>
                            {RECURRENCE_PRESET_OPTIONS.map((opt) => {
                                const selected = recurrencePreset === opt.id;
                                return (
                                    <Pressable
                                        key={opt.id}
                                        onPress={() => handleSelectPreset(opt.id)}
                                        disabled={locked}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                borderColor: colors.backgroundSelected,
                                                backgroundColor: selected ? '#6F7FA5' : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: selected ? '#fff' : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            {opt.label}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {recurrencePreset === 'custom' ? (
                            <View style={styles.weekdayRow}>
                                {WEEKDAY_OPTIONS.map((opt) => {
                                    const selected = customDays.has(opt.code);
                                    return (
                                        <Pressable
                                            key={opt.code}
                                            onPress={() => toggleCustomDay(opt.code)}
                                            disabled={locked}
                                            style={({ pressed }) => [
                                                styles.weekdayBtn,
                                                {
                                                    backgroundColor: selected
                                                        ? '#6F7FA5'
                                                        : 'transparent',
                                                    borderColor: selected
                                                        ? '#6F7FA5'
                                                        : colors.backgroundSelected,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected ? '#fff' : colors.text,
                                                    fontWeight: '600',
                                                }}>
                                                {opt.label}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : null}

                        {recurrencePreset !== 'none' ? (
                            <>
                                {/* Optional end date for the series. Empty = repeats forever
                                    (well, until the user edits or deletes the master). Stored
                                    as ;UNTIL=YYYYMMDDT235959 in the RRULE. */}
                                <View style={styles.recurrenceEndRow}>
                                    <View style={styles.recurrenceEndField}>
                                        <ThemedText type="smallBold">
                                            Ends on (optional)
                                        </ThemedText>
                                        <DateField
                                            value={recurrenceEndDate}
                                            onChange={setRecurrenceEndDate}
                                        />
                                    </View>
                                    {recurrenceEndDate.length > 0 ? (
                                        <Pressable
                                            onPress={() => setRecurrenceEndDate('')}
                                            disabled={locked}
                                            style={({ pressed }) => [
                                                styles.recurrenceClearBtn,
                                                { borderColor: colors.backgroundSelected },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                themeColor="textSecondary"
                                                type="small">
                                                Clear
                                            </ThemedText>
                                        </Pressable>
                                    ) : null}
                                </View>
                                <ThemedText themeColor="textSecondary" type="small">
                                    {recurrencePreset === 'custom' && customDays.size === 0
                                        ? 'Pick at least one day, or change to Does not repeat to remove recurrence.'
                                        : 'Editing or deleting affects every occurrence in the series.'}
                                </ThemedText>
                            </>
                        ) : null}
                    </View>

                    {/* Location */}
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Location (optional)</ThemedText>

                        {locations.length > 0 ? (
                            <View style={styles.locationChipWrapper}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.locationChipRow}
                                onContentSizeChange={
                                    locationsOverflow.onContentSizeChange
                                }
                                onLayout={locationsOverflow.onLayout}
                                onScroll={locationsOverflow.onScroll}
                                scrollEventThrottle={32}>
                                {locations.map((loc) => {
                                    const selected = matchedLocation?.id === loc.id;
                                    return (
                                        <Pressable
                                            key={loc.id}
                                            onPress={() => {
                                                // Prefer the formatted address in the field
                                                // when available — Google can search that
                                                // text, the saved name (e.g. "Nadim's home")
                                                // can't. Fall back to the name only when
                                                // the row has no address stored.
                                                setLocationName(
                                                    loc.formatted_address || loc.name,
                                                );
                                                setLocationMapsUrl(loc.google_maps_url ?? '');
                                                // Pre-fill the picked-place context if the
                                                // saved location was originally pulled from
                                                // Places — keeps the dedup path intact.
                                                if (loc.google_place_id) {
                                                    setPickedPlace({
                                                        placeId: loc.google_place_id,
                                                        formattedAddress:
                                                            loc.formatted_address ?? '',
                                                    });
                                                    setPickedPlaceAddress(
                                                        loc.formatted_address ?? '',
                                                    );
                                                } else {
                                                    setPickedPlace(null);
                                                    setPickedPlaceAddress('');
                                                }
                                            }}
                                            disabled={locked}
                                            style={({ pressed }) => [
                                                styles.chip,
                                                {
                                                    borderColor: colors.backgroundSelected,
                                                    backgroundColor: selected ? '#6F7FA5' : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected ? '#fff' : colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {loc.name}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <ScrollOverflowChevron
                                visible={locationsOverflow.showLeftIndicator}
                                side="left"
                            />
                            <ScrollOverflowChevron
                                visible={locationsOverflow.showRightIndicator}
                                side="right"
                            />
                            </View>
                        ) : null}

                        <PlacesAutocomplete
                            value={locationName}
                            onChangeText={(t) => {
                                setLocationName(t);
                                // When typing away from the currently-matched saved location,
                                // clear the URL so we don't carry a stale link from the
                                // previous place into the new entry's URL field. Match
                                // against either the saved name OR the formatted address —
                                // either is what we put in the field when a chip was picked.
                                if (matchedLocation) {
                                    const newLower = t.trim().toLowerCase();
                                    const nameLower = matchedLocation.name.toLowerCase();
                                    const addrLower = (
                                        matchedLocation.formatted_address ?? ''
                                    ).toLowerCase();
                                    if (newLower !== nameLower && newLower !== addrLower) {
                                        setLocationMapsUrl('');
                                    }
                                }
                                // Any keystroke drops the picked-place context. If the
                                // user picks a Google suggestion next, onPickPlace will
                                // restore it on the same render cycle.
                                if (pickedPlace) {
                                    setPickedPlace(null);
                                    setPickedPlaceAddress('');
                                }
                            }}
                            onPickPlace={(details) => {
                                setLocationMapsUrl(details.googleMapsUri);
                                setPickedPlace({
                                    placeId: details.placeId,
                                    formattedAddress: details.formattedAddress,
                                });
                                setPickedPlaceAddress(details.formattedAddress);
                            }}
                            placeholder={
                                locations.length > 0
                                    ? 'Pick a saved place or search for a new one'
                                    : 'e.g. School field'
                            }
                            placeholderTextColor={colors.textSecondary}
                            inputStyle={inputStyle}
                            editable={!locked}
                            // Don't ask Google to autocomplete a value that's already a
                            // resolved saved entry (chip pick) — Google has no idea what
                            // "Nadim's home" is, and showing "no results" on the dropdown
                            // is worse than no dropdown at all. Memoized at the top of
                            // the component so the autocomplete's debounce timer doesn't
                            // reset on every parent re-render.
                            skipFetchValues={skipFetchValues}
                        />

                        {/* Show the formatted address when a Place is in play (picked or
                            sourced from a saved location with stored Places data). */}
                        {pickedPlaceAddress ||
                        matchedLocation?.formatted_address ? (
                            <ThemedText themeColor="textSecondary" type="small">
                                {pickedPlaceAddress || matchedLocation?.formatted_address}
                            </ThemedText>
                        ) : null}

                        {matchedLocation?.google_maps_url ? (
                            <Pressable
                                onPress={() => openMaps(matchedLocation.google_maps_url!)}
                                style={({ pressed }) => [styles.mapsLink, pressed && styles.pressed]}>
                                <ThemedText type="small" style={{ color: '#6F7FA5' }}>
                                    📍 Open in Google Maps
                                </ThemedText>
                            </Pressable>
                        ) : null}

                        {showMapsUrlField ? (
                            <>
                                <TextInput
                                    value={locationMapsUrl}
                                    onChangeText={setLocationMapsUrl}
                                    placeholder="Google Maps link (optional)"
                                    placeholderTextColor={colors.textSecondary}
                                    style={inputStyle}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                    editable={!locked}
                                />
                                <ThemedText themeColor="textSecondary" type="small">
                                    New locations are saved for reuse next time.
                                </ThemedText>
                            </>
                        ) : null}
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Notes (optional)</ThemedText>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Any details to remember"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={3}
                            style={[inputStyle, styles.multiline]}
                            editable={!locked}
                        />
                    </View>

                    {/* Inline task list. Defaults each new task's due_at to the event's
                        start (computed from the current date+time fields). Hidden in
                        occurrence-override mode because tasks are series-level. */}
                    <EventTaskSection
                        value={tasks}
                        onChange={setTasks}
                        members={members}
                        colorMap={colorMap}
                        currentUserId={currentUserId}
                        lists={lists}
                        children={children}
                        // Seed new task rows from the event's currently-selected kids
                        // so inline tasks inherit the event's child context.
                        defaultChildIds={Array.from(selectedChildIds)}
                        onCompleteImmediate={onCompleteTaskImmediate}
                        defaultDueAt={(() => {
                            // Reconstruct the event's start time from the current form
                            // fields. allDay events get midnight; otherwise the picked
                            // time. We don't bother with tz conversion here — the value
                            // is just a sensible default that the DB will store as a
                            // timestamptz interpreted in the user's local tz.
                            const dateStr = allDay
                                ? `${date}T00:00`
                                : `${date}T${startTime}`;
                            const d = new Date(dateStr);
                            return Number.isNaN(d.getTime()) ? null : d.toISOString();
                        })()}
                        disabled={lockExceptResponsible}
                    />

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {/* "Delete event" is only meaningful in series mode — deleting from
                        within an occurrence-override workflow would be ambiguous (delete
                        the whole series? just the override?). Hidden in occurrence mode;
                        the override-specific "Remove this override" button takes its place. */}
                    {onDelete && !lockExceptResponsible ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <ThemedText style={styles.deleteText}>
                                {deleting ? 'Deleting…' : 'Delete event'}
                            </ThemedText>
                        </Pressable>
                    ) : null}

                    {lockExceptResponsible &&
                    hasExistingOccurrenceOverride &&
                    onRemoveOccurrenceOverride ? (
                        <Pressable
                            onPress={async () => {
                                if (busy) return;
                                const confirmed =
                                    Platform.OS === 'web'
                                        ? typeof window !== 'undefined' &&
                                          window.confirm(
                                              'Remove this override? The occurrence will go back to the series rule.',
                                          )
                                        : await new Promise<boolean>((resolve) => {
                                              Alert.alert(
                                                  'Remove this override?',
                                                  'The occurrence will go back to the series rule.',
                                                  [
                                                      {
                                                          text: 'Cancel',
                                                          style: 'cancel',
                                                          onPress: () => resolve(false),
                                                      },
                                                      {
                                                          text: 'Remove',
                                                          style: 'destructive',
                                                          onPress: () => resolve(true),
                                                      },
                                                  ],
                                              );
                                          });
                                if (!confirmed) return;
                                try {
                                    await onRemoveOccurrenceOverride();
                                } catch (err) {
                                    const msg = errorMessage(err);
                                    if (Platform.OS === 'web') setError(msg);
                                    else Alert.alert("Couldn't remove override", msg);
                                }
                            }}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <ThemedText style={styles.deleteText}>
                                Remove this override
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    headerBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
    scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
    field: { gap: Spacing.two },
    allDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeRow: { flexDirection: 'row', gap: Spacing.three },
    timeField: { flex: 1, gap: Spacing.two },
    multiline: { height: 88, textAlignVertical: 'top', paddingTop: Spacing.two },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingTop: Spacing.one },
    // Date field + Clear button on one row, only rendered when recurrence is active.
    recurrenceEndRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.two,
        paddingTop: Spacing.one,
    },
    recurrenceEndField: { flex: 1, gap: Spacing.two },
    recurrenceClearBtn: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        borderRadius: Spacing.two,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
    },
    // Top-of-form card containing the "Apply changes to: series / occurrence" toggle.
    // Only rendered when editing a specific instance of a recurring event.
    applyToCard: {
        padding: Spacing.three,
        borderRadius: Spacing.two,
        gap: Spacing.two,
    },
    weekdayBtn: {
        minWidth: 44,
        height: 36,
        paddingHorizontal: Spacing.two,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationChipRow: { gap: Spacing.two, paddingVertical: Spacing.one },
    // UX-010: relative-positioned wrapper so the overflow chevron pins to the
    // saved-locations strip's visible right edge.
    locationChipWrapper: { position: 'relative' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    mapsLink: { paddingVertical: Spacing.one },
    errorText: { color: '#B85D52' },
    deleteBtn: {
        marginTop: Spacing.three,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: '#F3D9D3',
        alignItems: 'center',
    },
    deleteText: { color: '#B85D52', fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
