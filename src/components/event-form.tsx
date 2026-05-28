import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    AIHelper,
    AnyoneChip,
    CreateTopBar,
    DateTimePickerSheet,
    FormGroup,
    FormRow,
    FormSectionLabel,
    FormSwitch,
    LocationSuggestionRow,
    PersonChip,
    RepeatsPickerSheet,
    SheetShell,
} from '@/components/ds';
import { EventTaskSection, type LocalTask } from '@/components/event-task-section';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
    BrandColors,
    Colors,
    FontFamily,
    Spacing,
    Typography,
} from '@/constants/theme';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import type {
    Child,
    HouseholdMember,
    List,
    Location,
    LocationPlaceInput,
    NewEventInput,
    NewEventResponsibleInput,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';
import {
    buildRRule,
    formatRecurrenceLabel,
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
    /**
     * @deprecated Prefer `responsibles` (multi-responsible model). Still
     * read on mount as a back-compat fallback when `responsibles` is empty
     * — single-responsible events created before migration 0039 keep
     * working without callers having to derive the list themselves.
     */
    responsibleProfileId: string | null;
    /**
     * Multi-responsible list — each entry tags one adult, with at most one
     * `isLead`. The form pre-fills from this when present; falls back to a
     * single-row list from `responsibleProfileId` when empty.
     */
    responsibles: NewEventResponsibleInput[];
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
    /**
     * Privacy opt-in (#466). When true the saved event will show as a generic
     * Busy block for any household viewer who isn't in the responsibles
     * list. Defaults to false for backward compatibility — existing events
     * load with `is_private` from the DB and new events default to public.
     * Pre-fill is sourced from event.is_private when loading an existing
     * row; the screen's prepareInitialValues helpers default to false for
     * the create flow.
     */
    isPrivate: boolean;
    /**
     * "Also notify other parent" toggle (#322). When true, the reminder
     * dispatch path (#308) pings every tagged adult, not just the
     * creator's default scope. Defaults to false; loads from
     * event.notify_other_parent on edit.
     */
    notifyOtherParent: boolean;
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
    /**
     * Inline list-create handler (#468). When provided, the To-do list
     * picker sheet exposes a "+ NEW LIST" row that expands into a
     * TextInput; submitting calls this and the picker auto-selects the
     * returned list. Callers wire it to db.createList(household.id, …)
     * + their lists refetch. Optional so the picker degrades to
     * read-only (existing lists only) when a caller hasn't wired the
     * create path yet.
     */
    onCreateList?: (name: string) => Promise<List>;
};

// ─── Section primitives ─────────────────────────────────────────────────────
//
// `FormSectionLabel` (caps-mono section label) + `FormGroup` (rounded-12
// hairline card) lifted to `@/components/ds` so EventDetail (read view)
// and EventCreate (this form) share the same source. Design source:
// screens-extra-2.jsx FormSectionLabel + FormGroup.

// Section order (matches screens-extra-2.jsx EventCreate):
//   Title (naked) → WHEN → WHO → WHERE → ATTACH → NOTIFICATIONS → NOTES.
// Each section is a caps-mono <FormSectionLabel> followed by a rounded-12
// hairline <FormGroup> card (flush variant when its body is composed of
// FormRow primitives, padded variant when it wraps custom sub-blocks like
// WHO's RESPONSIBLE / FOR CHILD(REN) chip clusters). Destructive actions
// (Delete / Remove override) live in a sticky bottom action bar instead of
// inline at the end of the scroll.
//
// FormRow is used throughout this form (Starts / Ends / All day / Repeats /
// Alternates / Mark private / To-do list / Quick tasks / Remind me / Also
// notify other parent) and on the read side via EventDetail. The two
// surfaces share one vocabulary now — this comment used to predict the
// /event/[id]/edit modal getting retired in favor of an inline-edit
// EventDetail; that work landed (#413, #422) and EventForm is now the
// create + edit surface for both /event/new and /event/[id]/edit.
/**
 * Spec 04.2 Starts/Ends row formatter. Renders the date + time as
 * "Tue May 26 · 16:00" (mono), collapsing to just "Tue May 26" when
 * all-day. Empty/invalid inputs fall through to "Pick a date" so the
 * row reads correctly when the user hasn't filled anything in yet.
 */
function formatWhenRow(
    ymd: string,
    hhmm: string,
    allDay: boolean,
): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'Pick a date';
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return 'Pick a date';
    const datePart = date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    if (allDay || !/^\d{2}:\d{2}$/.test(hhmm)) return datePart;
    return `${datePart} · ${hhmm}`;
}

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
    onCreateList,
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
    const [notes, setNotes] = useState(initialValues.notes);
    // "Mark private" toggle (#466). When true, the writer persists
    // events.is_private = true; Calendar/Home gate their rendering so
    // non-responsible viewers see a Busy block instead of the title.
    // Bound to FormSwitch in the Visibility row added below.
    const [isPrivate, setIsPrivate] = useState<boolean>(initialValues.isPrivate);
    // "Also notify other parent" toggle (#322). Wired through onSubmit
    // as `notifyOtherParent`; persisted via events.notify_other_parent
    // (migrations 0046 + 0047). The actual notification dispatch path
    // is #308 follow-up; until then this column stores the user's
    // intent honestly.
    const [notifyOtherParent, setNotifyOtherParent] = useState<boolean>(
        initialValues.notifyOtherParent,
    );
    // Multi-responsible state — `selectedIds` is the set of tagged adults,
    // `leadId` is the one flagged `is_lead` (gets the LEAD chip + primary
    // push). Two pieces because the design distinguishes "is X tagged" from
    // "is X the lead" — toggling tagging shouldn't blow away the lead pick
    // unless the lead itself was removed.
    //
    // Initial state precedence:
    //   1. `initialValues.responsibles` when non-empty (the new multi model)
    //   2. fall back to a single-row list from `responsibleProfileId` (back-
    //      compat for unmigrated callers and for "claim" links that still
    //      pass a single profile id)
    //   3. empty Set → Anyone / unassigned
    const seedResponsibles =
        initialValues.responsibles.length > 0
            ? initialValues.responsibles
            : initialValues.responsibleProfileId
              ? [
                    {
                        profileId: initialValues.responsibleProfileId,
                        isLead: true,
                    },
                ]
              : [];
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set(seedResponsibles.map((r) => r.profileId)),
    );
    const [leadId, setLeadId] = useState<string | null>(
        seedResponsibles.find((r) => r.isLead)?.profileId ??
            seedResponsibles[0]?.profileId ??
            null,
    );
    // Alternation mode is mutually exclusive with explicit responsibles. The
    // setters below clear the other state on every transition.
    const [alternation, setAlternation] = useState<'same_day' | 'previous_day' | null>(
        initialValues.alternation,
    );
    /**
     * Toggle a parent's tagged state.
     *   - If selected: remove. If they were the lead, promote the next
     *     entry in iteration order (or clear lead when empty).
     *   - If not selected: add. First selection becomes lead automatically
     *     (matches the design's "default = first added" semantic).
     * Also clears alternation since "explicit tags" wins over "follow custody".
     */
    const toggleResponsible = (profileId: string) => {
        setAlternation(null);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(profileId)) {
                next.delete(profileId);
                if (profileId === leadId) {
                    const first = next.values().next().value as string | undefined;
                    setLeadId(first ?? null);
                }
            } else {
                next.add(profileId);
                if (!leadId) setLeadId(profileId);
            }
            return next;
        });
    };
    const clearResponsibles = () => {
        // "Anyone" chip — clears the selection entirely. Lead drops to null.
        setSelectedIds(new Set());
        setLeadId(null);
        setAlternation(null);
    };
    const pickAlternation = (mode: 'same_day' | 'previous_day' | null) => {
        setAlternation(mode);
        // Alternation owns responsibility per occurrence — clear explicit tags.
        setSelectedIds(new Set());
        setLeadId(null);
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
            // Occurrence overrides are single-responsible by design — a
            // per-date swap doesn't carry the multi-responsible list. Map
            // the override's single profile id into our Set/lead pair.
            const overrideId = overrideResponsibleRef.current;
            setSelectedIds(
                overrideId ? new Set([overrideId]) : new Set(),
            );
            setLeadId(overrideId);
            setAlternation(null);
        } else {
            // Series mode: re-seed from initialValues.responsibles (the
            // multi-responsible source of truth), falling back to the legacy
            // single-id field for unmigrated callers.
            const seed =
                initialValues.responsibles.length > 0
                    ? initialValues.responsibles
                    : initialValues.responsibleProfileId
                      ? [
                            {
                                profileId:
                                    initialValues.responsibleProfileId,
                                isLead: true,
                            },
                        ]
                      : [];
            setSelectedIds(new Set(seed.map((r) => r.profileId)));
            setLeadId(
                seed.find((r) => r.isLead)?.profileId ??
                    seed[0]?.profileId ??
                    null,
            );
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
    // The event-type picker UI was removed in the Phase 5 redesign, but the
    // value still threads through onSubmit so existing events keep their type
    // on save. Until the column is dropped server-side, we read initial
    // value and pass it through unchanged — no setter needed.
    const [eventType] = useState<string | null>(initialValues.eventType);
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
    // Attach section (canvas 04.2). `defaultListId` seeds new quick
    // tasks' listIds when set — picked from existing household lists.
    // `quickTasksExpanded` toggles the inline task editor below the
    // Attach FormGroup (collapsed by default so the section reads as
    // two clean chevron rows).
    const [defaultListId, setDefaultListId] = useState<string | null>(null);
    const [listPickerOpen, setListPickerOpen] = useState(false);
    // Inline "+ NEW LIST" state for the To-do list picker sheet (#468).
    // Two-step UX: tap "+ NEW LIST" → row replaces itself with a
    // TextInput → Enter calls onCreateList(name) → on success, the
    // returned list becomes the default and the sheet closes. Local
    // state because the picker sheet is owned by EventForm; the
    // parent's lists prop refetches separately.
    const [newListMode, setNewListMode] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListSaving, setNewListSaving] = useState(false);
    const handleNewListSubmit = useCallback(async () => {
        if (!onCreateList) return;
        const name = newListName.trim();
        if (!name || newListSaving) return;
        setNewListSaving(true);
        try {
            const created = await onCreateList(name);
            setDefaultListId(created.id);
            setNewListMode(false);
            setNewListName('');
            setListPickerOpen(false);
        } catch (err) {
            console.error('inline create list failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined')
                    window.alert(`Couldn't create list\n\n${msg}`);
            } else {
                Alert.alert("Couldn't create list", msg);
            }
        } finally {
            setNewListSaving(false);
        }
    }, [newListName, newListSaving, onCreateList]);
    const [quickTasksExpanded, setQuickTasksExpanded] = useState(false);
    // When section pickers (spec 04.2): tap a FormRow → opens the
    // corresponding picker sheet. Mirrors how every other v2 create
    // surface routes scalar edits through small sheets.
    const [startsPickerOpen, setStartsPickerOpen] = useState(false);
    const [endsPickerOpen, setEndsPickerOpen] = useState(false);
    const [repeatsPickerOpen, setRepeatsPickerOpen] = useState(false);
    // Alternation picker — feature not in canvas 04.2 but preserved
    // because separated households use it heavily. Rendered as a
    // FormRow + chevron in Who, opens this 3-option picker (Off /
    // Same day / Overnight) to match the options-entry vocabulary.
    const [alternationPickerOpen, setAlternationPickerOpen] = useState(false);

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

    // (The previous `showMapsUrlField` derivation drove an inline
    // manual Maps URL TextInput that surfaced under the search bar
    // whenever the user was typing a brand-new place. It read as
    // visual clutter mid-search and was dropped — custom-location-
    // with-URL creation belongs in Settings → Locations, not inline
    // in the event creator.)

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
            // Multi-responsible: build the list from selectedIds with the
            // current leadId promoted. If no lead is flagged (shouldn't
            // happen given the toggle logic, but defensive) the writer's
            // setEventResponsibles helper promotes the first entry.
            // Mirror the lead into the legacy `responsibleProfileId` field
            // so back-compat callers (RLS, edge fns, analytics) keep
            // working during the transition window.
            const responsiblesList: NewEventResponsibleInput[] = Array.from(
                selectedIds,
            ).map((pid) => ({ profileId: pid, isLead: pid === leadId }));
            const leadForLegacyField = leadId ?? null;
            await onSubmit({
                title: title.trim(),
                startsAt,
                endsAt,
                allDay,
                description: notes.trim() || null,
                location: locationName.trim() || null, // legacy text mirror
                responsibleProfileId: leadForLegacyField,
                responsibles: responsiblesList,
                recurrenceRule,
                eventType,
                timezone: submitTimezone,
                childIds: Array.from(selectedChildIds),
                responsibleAlternation: alternation,
                isPrivate,
                notifyOtherParent,
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

    return (
        <ThemedView style={styles.container}>
            {/* KeyboardAvoidingView: iOS soft keyboard otherwise covers the
                date/title inputs at the bottom of the form on a 402×874
                viewport. Android relies on windowSoftInputMode=adjustResize
                (Expo default); web ignores the wrap. Audit #330 CRITICAL #2. */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={styles.safe}>
                {/* Top bar lifted to the shared CreateTopBar primitive
                    so every creation surface (Event/Task/List/Contact/
                    AddChild) shares one chrome. Spec details (padding,
                    pill radius, label sizes) live in the primitive. */}
                <CreateTopBar
                    title={headerTitle}
                    saveLabel={submitting ? 'Saving…' : submitLabel}
                    saveDisabled={!canSubmit}
                    onCancel={onCancel}
                    onSave={handleSubmit}
                />

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {/* "Apply to" toggle: only rendered when the user clicked into a
                        specific occurrence of a recurring event. Choosing "This
                        occurrence" switches the save path to write an override row
                        for that date and disables every field except the responsible-
                        parent chips. Lives OUTSIDE the main form card as its own
                        meta-card since it changes the meaning of the save action. */}
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
                                                    borderColor: colors.accent,
                                                    backgroundColor: selected
                                                        ? colors.accent
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected ? colors.onAccent : colors.text,
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

                    {/* Title — large/focused per design (screens-extra-2.jsx:429-446).
                        Mono caps "TITLE" sublabel above, then a 22px SemiBold
                        input with an accent underline. No border box — the
                        underline + the focus state carries the affordance,
                        which matches Linear/Things-tier minimal vocabulary.
                        Lives OUTSIDE any FormGroup — it's the form's hero
                        field and gets its own visual treatment. */}
                    <View style={styles.field}>
                        <ThemedText
                            style={[
                                styles.fieldMonoLabel,
                                {
                                    color: colors.textSecondary,
                                    marginBottom: 4,
                                },
                            ]}>
                            TITLE
                        </ThemedText>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Soccer practice"
                            placeholderTextColor={colors.textSecondary}
                            style={[
                                styles.titleInput,
                                {
                                    color: colors.text,
                                    borderBottomColor: colors.accent,
                                    fontFamily: FontFamily.sansSemiBold,
                                },
                            ]}
                            autoFocus
                            editable={!locked}
                            selectionColor={colors.accent}
                        />
                    </View>

                    {/* AI parse-paste hint — visual scaffold per spec.
                        Real backend wiring tracked under #303 / #329.
                        flush={true} because event-form's ScrollView
                        already supplies `padding: 16` — without the
                        flush the banner double-insets to 32 horizontal
                        and reads narrower than the FormGroup cards
                        below it. */}
                    <AIHelper
                        example={'"soccer mei wed 4pm lincoln park" → all fields filled'}
                        flush
                    />

                    {/* ─── WHEN ─────────────────────────────────────────── */}
                    {/* Spec 04.2 (screens-extra-2.jsx:468-487): four
                        FormRows — Starts (mono datetime), Ends (mono
                        datetime), All day (FormSwitch), Repeats
                        (chevron, accent mono value).
                        Date/time edits route through DateTimePickerSheet;
                        recurrence routes through RepeatsPickerSheet. */}
                    <FormSectionLabel>When</FormSectionLabel>
                    <FormGroup flush>
                        <FormRow
                            label="Starts"
                            value={formatWhenRow(date, startTime, allDay)}
                            chevron
                            onPress={() => setStartsPickerOpen(true)}
                            disabled={locked}
                        />
                        <FormRow
                            label="Ends"
                            value={formatWhenRow(
                                allDay ? endDate || date : date,
                                endTime,
                                allDay,
                            )}
                            chevron
                            onPress={() => setEndsPickerOpen(true)}
                            disabled={locked}
                        />
                        <FormRow
                            label="All day"
                            value={
                                <FormSwitch
                                    value={allDay}
                                    onValueChange={setAllDay}
                                    disabled={locked}
                                />
                            }
                        />
                        <FormRow
                            label="Repeats"
                            value={
                                formatRecurrenceLabel(
                                    buildRRule(
                                        recurrencePreset,
                                        recurrencePreset === 'custom'
                                            ? Array.from(customDays)
                                            : undefined,
                                        recurrenceEndDate.trim() || null,
                                    ),
                                ) ?? 'Does not repeat'
                            }
                            accent={recurrencePreset !== 'none'}
                            muted={recurrencePreset === 'none'}
                            chevron
                            onPress={() => setRepeatsPickerOpen(true)}
                            disabled={locked}
                            last
                        />
                    </FormGroup>

                    {/* ─── WHO ──────────────────────────────────────────── */}
                    {/* FormGroup is now `flush` (padding 0) so every row
                        and sub-block shares the FormRow vocabulary's
                        14px horizontal inset. That fixes the prior
                        misalignment where the Alternates FormRow's
                        label sat at 12 + 14 = 26 (FormGroup pad +
                        FormRow pad) while the RESPONSIBLE/FOR labels
                        and chips sat at 12 — Starts/Ends in the WHEN
                        card sit at 14, so nothing inside Who matched
                        them. Now: every label (RESPONSIBLE, Alternates,
                        FOR CHILD(REN), Mark private) and the first
                        chip's leading edge all start at the same 14px
                        inset. */}
                    <FormSectionLabel>Who</FormSectionLabel>
                    <FormGroup flush>
                        {/* RESPONSIBLE sub-block — 14/12 inset matches
                            FormRow's padding so the mono label and first
                            chip leading edge line up with Starts/Ends. */}
                        <View
                            style={[
                                styles.whoSubBlock,
                                {
                                    borderBottomColor: colors.hair,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                },
                            ]}>
                            {/* Multi-select responsible parent. Tap a chip
                                to tag/untag; first-added becomes lead
                                automatically, and the lead chip gets a
                                neutral LEAD tag inline. Tapping a chip a
                                second time when it's the only selected
                                profile leaves the event tagged with no
                                one (= Anyone semantics). For an explicit
                                "switch to Anyone" affordance the user
                                taps the Anyone chip below.
                                Lead is implicit here in EventForm — to
                                change which selected member is lead, the
                                user opens EventDetail and uses
                                EventResponsibleSheet (which has the
                                dedicated lead picker row). */}
                            <ThemedText
                                style={[
                                    styles.fieldMonoLabel,
                                    { color: colors.textSecondary },
                                ]}>
                                RESPONSIBLE
                            </ThemedText>
                            <View style={styles.chipRow}>
                                {members.map((m) => {
                                    const color = colorForResponsible(
                                        m.profile_id,
                                        colorMap,
                                    );
                                    const selected =
                                        alternation === null &&
                                        selectedIds.has(m.profile_id);
                                    const isLead =
                                        selected && m.profile_id === leadId;
                                    const label =
                                        currentUserId === m.profile_id
                                            ? 'Me'
                                            : m.display_name;
                                    return (
                                        <PersonChip
                                            key={m.profile_id}
                                            name={label}
                                            color={color}
                                            selected={selected}
                                            onPress={
                                                busy
                                                    ? undefined
                                                    : () =>
                                                          toggleResponsible(
                                                              m.profile_id,
                                                          )
                                            }
                                            leadTag={
                                                isLead && selectedIds.size > 1
                                                    ? 'LEAD'
                                                    : undefined
                                            }
                                        />
                                    );
                                })}
                                <AnyoneChip
                                    onPress={busy ? undefined : clearResponsibles}
                                    selected={
                                        alternation === null &&
                                        selectedIds.size === 0
                                    }
                                />
                            </View>
                        </View>

                        {/* Alternates — now a top-level FormRow inside
                            the flush FormGroup, so its label aligns
                            exactly with Starts/Ends/All day/Repeats
                            (all 14px inset, 14/500/-0.2 typography). */}
                        {showAlternationChips && !lockExceptResponsible ? (
                            <FormRow
                                label="Alternates"
                                value={
                                    alternation === 'same_day'
                                        ? 'Same day'
                                        : alternation === 'previous_day'
                                          ? 'Overnight'
                                          : 'Off'
                                }
                                muted={!alternation}
                                chevron
                                onPress={() => setAlternationPickerOpen(true)}
                                disabled={locked}
                            />
                        ) : null}

                        {/* FOR CHILD(REN) sub-block. Same 14/12 inset as
                            the RESPONSIBLE block so chip leading edges
                            align with the FormRow labels above and
                            below it. */}
                        {children.length > 0 ? (
                            <View
                                style={[
                                    styles.whoSubBlock,
                                    {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.fieldMonoLabel,
                                        { color: colors.textSecondary },
                                    ]}>
                                    FOR CHILD(REN)
                                </ThemedText>
                                <View style={styles.chipRow}>
                                    {children.map((c) => {
                                        const selected = selectedChildIds.has(
                                            c.id,
                                        );
                                        return (
                                            <PersonChip
                                                key={c.id}
                                                name={c.display_name}
                                                color={c.color}
                                                selected={selected}
                                                onPress={
                                                    locked
                                                        ? undefined
                                                        : () => toggleChild(c.id)
                                                }
                                            />
                                        );
                                    })}
                                </View>
                            </View>
                        ) : null}

                        {/* Mark private — converted from a custom
                            smallBold-typography row to a real FormRow so
                            its label uses the same 14/500/-0.2 vocabulary
                            as Starts / Ends / All day / Alternates. The
                            FormSwitch sits in the value slot exactly like
                            All day. last={!isPrivate} suppresses the
                            bottom hairline when no caption follows, so
                            the card edge sits flush below the row. */}
                        <FormRow
                            label="Mark private"
                            value={
                                <FormSwitch
                                    value={isPrivate}
                                    onValueChange={setIsPrivate}
                                    disabled={locked}
                                />
                            }
                            last={!isPrivate}
                        />
                        {/* Caption only renders on the ON state. The
                            OFF state ("Visible to everyone in the
                            household.") was redundant — that's just the
                            normal event behavior; surfacing it as caption
                            copy made the section feel cluttered with no
                            informational gain. */}
                        {isPrivate ? (
                            <View style={styles.privacyCaptionWrap}>
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small">
                                    Other adults see this slot as Busy.
                                    Tagged people see the full event.
                                </ThemedText>
                            </View>
                        ) : null}
                    </FormGroup>

                    {/* ─── WHERE ────────────────────────────────────────── */}
                    {/* Single card holding the saved-locations list and
                        the search bar at the bottom. They share one
                        surface (same bg, same outer border, same width
                        — the search bar isn't recessed inside any inner
                        padding) so the section reads as "the Where
                        list" with search affordance at the foot.
                        A hairline divider above the search row provides
                        the clear delineation between picking-an-existing
                        and searching-for-new. We use a custom card view
                        (not FormGroup) because FormGroup uses
                        `overflow: hidden` which would clip the Places
                        suggestions dropdown — here we want the dropdown
                        to extend naturally past the card's bottom edge.
                        The trade-off is that a selected
                        LocationSuggestionRow's accent tint can bleed
                        a hairline past the card's rounded top corners;
                        at the tint's ~5.5% alpha that bleed is
                        imperceptible. */}
                    <FormSectionLabel>Where (optional)</FormSectionLabel>
                    <View
                        style={[
                            styles.whereCard,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {locations.length > 0 ? (
                            <View style={styles.whereListClip}>
                                <ScrollView
                                    // 3 rows × ~58px each = 174.
                                    style={{ maxHeight: 174 }}
                                    nestedScrollEnabled
                                    showsVerticalScrollIndicator>
                                    {locations.map((loc, idx) => {
                                        const selected =
                                            matchedLocation?.id === loc.id;
                                        const last =
                                            idx === locations.length - 1;
                                        return (
                                            <LocationSuggestionRow
                                                key={loc.id}
                                                title={loc.name}
                                                sub={
                                                    loc.formatted_address ||
                                                    undefined
                                                }
                                                selected={selected}
                                                tagLabel={
                                                    selected ? 'SAVED' : undefined
                                                }
                                                tagTone="neutral"
                                                last={last}
                                                onPress={
                                                    locked
                                                        ? undefined
                                                        : () => {
                                                              // Same selection
                                                              // logic the old
                                                              // chip path used.
                                                              setLocationName(
                                                                  loc.formatted_address ||
                                                                      loc.name,
                                                              );
                                                              setLocationMapsUrl(
                                                                  loc.google_maps_url ??
                                                                      '',
                                                              );
                                                              if (
                                                                  loc.google_place_id
                                                              ) {
                                                                  setPickedPlace(
                                                                      {
                                                                          placeId:
                                                                              loc.google_place_id,
                                                                          formattedAddress:
                                                                              loc.formatted_address ??
                                                                              '',
                                                                      },
                                                                  );
                                                                  setPickedPlaceAddress(
                                                                      loc.formatted_address ??
                                                                          '',
                                                                  );
                                                              } else {
                                                                  setPickedPlace(
                                                                      null,
                                                                  );
                                                                  setPickedPlaceAddress(
                                                                      '',
                                                                  );
                                                              }
                                                          }
                                                }
                                            />
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        ) : null}

                        {/* Search bar — last row in the card, with a
                            top hairline divider when a list precedes
                            it. The padding (12/9) lives on this wrapper
                            so PlacesAutocomplete can render a bare
                            icon-plus-input row inside (and the
                            suggestions dropdown extends naturally
                            below). Width = full card content width
                            minus the 12px horizontal padding — i.e. the
                            bar reads at the same visual extent as the
                            LocationSuggestionRows above. */}
                        <View
                            style={[
                                styles.whereSearchInline,
                                locations.length > 0 && {
                                    // Section-break divider — needs to
                                    // read as visibly heavier than the
                                    // hairlines between individual
                                    // LocationSuggestionRows above it.
                                    // First attempt used `inkFaint @
                                    // 0.4` but inkFaint is a light gray
                                    // (#BCC4BE) — at 40% on a white
                                    // card it ended up PALER than the
                                    // row hairlines (which are based on
                                    // near-black @ 10%). Tinting with
                                    // the text color directly at 18%
                                    // alpha gives a divider that's ~1.8×
                                    // the saturation of the row
                                    // hairlines, AND we widen to 2px so
                                    // it doesn't get swallowed by sub-
                                    // pixel rounding on web.
                                    borderTopColor: withAlpha(
                                        colors.text,
                                        0.18,
                                    ),
                                    borderTopWidth: 2,
                                },
                            ]}>
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
                            placeholderTextColor={colors.inkFaint}
                            // Search-bar vocabulary (matches the Lists tab's
                            // search input — hairline border, backgroundElement
                            // fill, radius 10, leading search glyph, mono
                            // 12pt input). Shell styling lives on `barStyle`
                            // so the dropdown below doesn't inherit it; the
                            // TextInput's text styling lives on `inputStyle`
                            // (mono regular, color, web outline-none). This
                            // brings the location field in line with the
                            // app's other search affordances rather than
                            // reading as a generic form input.
                            leadingIcon={
                                <Feather
                                    name="search"
                                    size={14}
                                    color={colors.textSecondary}
                                />
                            }
                            inputStyle={[
                                styles.searchBarInput,
                                {
                                    color: colors.text,
                                    fontFamily: FontFamily.monoRegular,
                                },
                                // RN-Web: strip the default browser input
                                // outline so the field reads as part of
                                // the card surface (same trick the Lists
                                // + Contacts search bars use).
                                Platform.OS === 'web'
                                    ? ({ outlineStyle: 'none' } as object)
                                    : null,
                            ]}
                            editable={!locked}
                            // Don't ask Google to autocomplete a value that's already a
                            // resolved saved entry (chip pick) — Google has no idea what
                            // "Nadim's home" is, and showing "no results" on the dropdown
                            // is worse than no dropdown at all. Memoized at the top of
                            // the component so the autocomplete's debounce timer doesn't
                            // reset on every parent re-render.
                            skipFetchValues={skipFetchValues}
                        />
                        </View>
                    </View>

                    {/* "Picked location" confirmation card — rendered only
                        when a place is actually in play. Wraps the
                        resolved address + "Open in Google Maps" link in
                        a small bordered sub-card so they read as a
                        contained block of confirmation copy rather than
                        loose text floating on the page background.
                        The legacy inline manual Maps URL field was
                        dropped (it surfaced while the user was still
                        typing, before they'd committed to a brand-new
                        place — visually distracting). Custom-with-URL
                        creation lives in Settings → Locations where it
                        belongs; events created with a brand-new name
                        save as plain text locations. */}
                    {pickedPlaceAddress ||
                    matchedLocation?.formatted_address ||
                    matchedLocation?.google_maps_url ? (
                        <View
                            style={[
                                styles.whereMetaBlock,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            {pickedPlaceAddress ||
                            matchedLocation?.formatted_address ? (
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small">
                                    {pickedPlaceAddress ||
                                        matchedLocation?.formatted_address}
                                </ThemedText>
                            ) : null}

                            {matchedLocation?.google_maps_url ? (
                                <Pressable
                                    onPress={() =>
                                        openMaps(matchedLocation.google_maps_url!)
                                    }
                                    accessibilityRole="link"
                                    accessibilityLabel="Open in Google Maps"
                                    style={({ pressed }) => [
                                        styles.mapsLink,
                                        pressed && styles.pressed,
                                    ]}>
                                    {/* Feather map-pin icon (accent-tinted)
                                        replaces the prior 📍 system emoji,
                                        which always rendered in the OS's
                                        native red-pin palette and made the
                                        link read as half-red / half-green
                                        instead of a single cohesive accent
                                        link. Both icon + label now share
                                        colors.accent (#2D8B6E light /
                                        #3FC198 dark — the forest accent
                                        from the palette). */}
                                    <Feather
                                        name="map-pin"
                                        size={13}
                                        color={colors.accent}
                                    />
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: colors.accent,
                                            fontWeight: '600',
                                        }}>
                                        Open in Google Maps
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}

                    {/* ─── ATTACH ───────────────────────────────────────── */}
                    {/* Spec 04.2 canvas splits Attach into two chevron
                        rows in a single card: "To-do list" + "Quick
                        tasks". To-do list = pick an existing list whose
                        id seeds new quick tasks' listIds (so anything
                        added inline lands in that list). Quick tasks =
                        the inline editor, kept visible below the card
                        when the user has expanded it.
                        Hidden in occurrence-override mode because tasks
                        are series-level.
                        Schema note: the picked To-do list isn't FK'd to
                        the event row (no `events.linked_list_id`
                        column). It's a UI default for the quick tasks
                        editor only. A future schema migration could
                        store the link if "auto-attach all tasks in the
                        list to this event" is wanted. */}
                    {!lockExceptResponsible ? (
                        <>
                            <FormSectionLabel>Attach</FormSectionLabel>
                            <FormGroup flush>
                                <FormRow
                                    label="To-do list"
                                    value={
                                        defaultListId
                                            ? lists.find(
                                                  (l) => l.id === defaultListId,
                                              )?.name ?? 'Picked'
                                            : 'None'
                                    }
                                    muted={!defaultListId}
                                    chevron
                                    onPress={() => setListPickerOpen(true)}
                                />
                                <FormRow
                                    label="Quick tasks"
                                    value={
                                        tasks.length > 0
                                            ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}`
                                            : 'None yet · tap to add'
                                    }
                                    muted={tasks.length === 0}
                                    chevron
                                    onPress={() =>
                                        setQuickTasksExpanded((v) => !v)
                                    }
                                    last
                                />
                            </FormGroup>
                            {quickTasksExpanded ? (
                                // EventTaskSection owns its own FormGroup
                                // flush card + dashed "+ Add a task"
                                // affordance now — no outer FormGroup
                                // wrapper here (previously double-wrapped,
                                // which read as a card-inside-a-card).
                                <EventTaskSection
                                    value={tasks}
                                    onChange={setTasks}
                                    members={members}
                                    colorMap={colorMap}
                                    currentUserId={currentUserId}
                                    lists={lists}
                                    children={children}
                                    defaultChildIds={Array.from(
                                        selectedChildIds,
                                    )}
                                    defaultListIds={
                                        defaultListId ? [defaultListId] : []
                                    }
                                    onCompleteImmediate={
                                        onCompleteTaskImmediate
                                    }
                                    defaultDueAt={(() => {
                                        const dateStr = allDay
                                            ? `${date}T00:00`
                                            : `${date}T${startTime}`;
                                        const d = new Date(dateStr);
                                        return Number.isNaN(d.getTime())
                                            ? null
                                            : d.toISOString();
                                    })()}
                                />
                            ) : null}
                        </>
                    ) : null}

                    {/* ─── NOTIFICATIONS ───────────────────────────────────
                        Spec 04.2 canvas: two FormRows under "Notifications".
                          • "Remind me" — per-recipient reminder lead time
                            (#419). Stays "Coming soon" until that lands;
                            the picker shape is correct but the schema
                            (per_recipient_reminder_offsets) isn't built yet.
                          • "Also notify other parent" — persisted to
                            events.notify_other_parent (#322 / migration
                            0046). The actual fire path lands with #308,
                            but the column stores the user's intent so the
                            reminder dispatcher picks it up automatically
                            when #308 ships. */}
                    <FormSectionLabel>Notifications</FormSectionLabel>
                    <FormGroup flush>
                        <FormRow
                            label="Remind me"
                            value="Coming soon"
                            muted
                            chevron
                        />
                        <FormRow
                            label="Also notify other parent"
                            value={
                                <FormSwitch
                                    value={notifyOtherParent}
                                    onValueChange={setNotifyOtherParent}
                                    disabled={locked}
                                />
                            }
                            last
                        />
                    </FormGroup>

                    {/* ─── NOTES ────────────────────────────────────────── */}
                    {/* FormGroup is `flush` and the TextInput fills the
                        card directly — no inner field-wrapper, no inner
                        input border. Previously the layout was a
                        FormGroup card (border + 12px padding) containing
                        a TextInput that ALSO had its own border + radius
                        + padding, which read as a recessed box-inside-a-
                        box. Now the FormGroup IS the textarea's visual
                        shell; the input just contributes text padding +
                        multiline height. */}
                    <FormSectionLabel>Notes</FormSectionLabel>
                    <FormGroup flush>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Any details to remember"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={3}
                            style={[
                                styles.notesTextarea,
                                {
                                    color: colors.text,
                                    fontFamily: FontFamily.sansRegular,
                                },
                                // RN-Web: strip the default browser
                                // input outline so focus doesn't draw
                                // a competing blue ring against the
                                // FormGroup's own hairline edge.
                                Platform.OS === 'web'
                                    ? ({ outlineStyle: 'none' } as object)
                                    : null,
                            ]}
                            editable={!locked}
                        />
                    </FormGroup>

                    {/* ─── SMART SUGGESTION ──────────────────────────────
                        Spec 04.2 canvas: dashed-border accent card with a
                        sparkle glyph, recurrence-detection copy, and two
                        CTAs (Yes, automate / Not now). Pattern detection
                        needs an AI/heuristic backend that isn't wired yet
                        (#303 / #329); this is a visual scaffold so the
                        affordance shape reads as present. */}
                    <View style={styles.smartSuggestionWrap}>
                        <View
                            style={[
                                styles.smartSuggestionCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: withAlpha(
                                        colors.accent,
                                        0x66 / 255,
                                    ),
                                },
                            ]}>
                            <Feather
                                name="zap"
                                size={14}
                                color={colors.accent}
                                style={{ marginTop: 1 }}
                            />
                            <View style={{ flex: 1 }}>
                                <ThemedText
                                    style={[
                                        styles.smartSuggestionTitle,
                                        { color: colors.text },
                                    ]}>
                                    Smart suggestions
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.smartSuggestionSub,
                                        { color: colors.inkFaint },
                                    ]}>
                                    We'll surface "recurs every Tuesday?" +
                                    auto-attach prompts here once the AI
                                    parse integration lands.
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}
                </ScrollView>

                {/* Sticky bottom action bar for destructive actions. Renders only
                    when there's something to render — `onDelete` in series mode, or
                    the override-remove path in occurrence mode (mutually exclusive
                    by their conditions). Save stays in the top bar so this bar is
                    single-purpose; the affirmative + destructive actions are
                    intentionally separated by surface. */}
                {(onDelete && !lockExceptResponsible) ||
                (lockExceptResponsible &&
                    hasExistingOccurrenceOverride &&
                    onRemoveOccurrenceOverride) ? (
                    <View
                        style={[
                            styles.bottomActionBar,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderTopColor: colors.hair,
                            },
                        ]}>
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
                    </View>
                ) : null}
            </SafeAreaView>
            </KeyboardAvoidingView>

            {/* Starts picker — single-shot date+time sheet. Save
                bumps endDate forward if the user moves start past it
                (preserves the existing "no inverted ranges" guard). */}
            <DateTimePickerSheet
                open={startsPickerOpen}
                title="Starts"
                initialDate={date}
                initialTime={startTime}
                allDay={allDay}
                onSave={({ date: nextDate, time: nextTime }) => {
                    setDate(nextDate);
                    if (!allDay) setStartTime(nextTime);
                    if (nextDate && endDate && nextDate > endDate) {
                        setEndDate(nextDate);
                    }
                    setStartsPickerOpen(false);
                }}
                onClose={() => setStartsPickerOpen(false)}
            />

            {/* Ends picker — same shape. For all-day events this edits
                the end date; for timed events it edits the end time
                (the underlying end date is the same as start). */}
            <DateTimePickerSheet
                open={endsPickerOpen}
                title="Ends"
                initialDate={allDay ? endDate || date : date}
                initialTime={endTime}
                allDay={allDay}
                onSave={({ date: nextDate, time: nextTime }) => {
                    if (allDay) {
                        setEndDate(nextDate);
                    }
                    if (!allDay) setEndTime(nextTime);
                    setEndsPickerOpen(false);
                }}
                onClose={() => setEndsPickerOpen(false)}
            />

            {/* Repeats picker — preset list + weekday chips + UNTIL.
                Parses the saved rule back into the form's recurrence
                state so the existing save path (which builds the rule
                from preset + customDays + recurrenceEndDate) keeps
                working unchanged. */}
            <RepeatsPickerSheet
                open={repeatsPickerOpen}
                value={buildRRule(
                    recurrencePreset,
                    recurrencePreset === 'custom'
                        ? Array.from(customDays)
                        : undefined,
                    recurrenceEndDate.trim() || null,
                )}
                startDate={date}
                onSave={(rule) => {
                    const parsed = parseRecurrence(rule);
                    setRecurrencePreset(parsed.preset);
                    setCustomDays(new Set(parsed.byday));
                    setRecurrenceEndDate(parsed.until ?? '');
                    setRepeatsPickerOpen(false);
                }}
                onClose={() => setRepeatsPickerOpen(false)}
            />

            {/* Alternation picker — 3 options (Off / Alternates /
                Alternates overnight). Not in canvas 04.2 but preserved
                because separated households use it heavily. Rendered
                via the same options-sheet vocabulary the other
                FormRow chevrons use. */}
            <SheetShell
                open={alternationPickerOpen}
                onClose={() => setAlternationPickerOpen(false)}
                title="Alternates"
                sub="Per-occurrence responsibility from the custody schedule."
                secondary="Cancel"
                onSecondary={() => setAlternationPickerOpen(false)}
                height={420}>
                <View style={styles.listPickerCard}>
                    {(
                        [
                            { id: null, label: 'Off' },
                            {
                                id: 'same_day' as const,
                                label: 'Alternates',
                                sub: 'Same-day handoff — responsibility comes from the custody schedule for that day.',
                            },
                            {
                                id: 'previous_day' as const,
                                label: 'Alternates (overnight)',
                                sub: 'Overnight handoff — responsibility comes from the custody schedule for the night before. Good for morning drop-offs.',
                            },
                        ] as Array<{
                            id: 'same_day' | 'previous_day' | null;
                            label: string;
                            sub?: string;
                        }>
                    ).map((opt, idx, arr) => {
                        const selected = alternation === opt.id;
                        const last = idx === arr.length - 1;
                        return (
                            <Pressable
                                key={opt.id ?? 'off'}
                                onPress={() => {
                                    pickAlternation(opt.id);
                                    setAlternationPickerOpen(false);
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: selected }}
                                accessibilityLabel={opt.label}
                                style={({ pressed }) => [
                                    styles.alternationRow,
                                    !last && {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                    selected && {
                                        backgroundColor: withAlpha(
                                            colors.accent,
                                            0x0e / 255,
                                        ),
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <View style={{ flex: 1 }}>
                                    <ThemedText
                                        style={{
                                            ...Typography.body,
                                            color: colors.text,
                                        }}>
                                        {opt.label}
                                    </ThemedText>
                                    {opt.sub ? (
                                        <ThemedText
                                            style={{
                                                color: colors.inkFaint,
                                                fontSize: 11,
                                                lineHeight: 16,
                                                marginTop: 4,
                                            }}>
                                            {opt.sub}
                                        </ThemedText>
                                    ) : null}
                                </View>
                                <View
                                    style={[
                                        styles.listPickerDot,
                                        {
                                            borderColor: selected
                                                ? colors.accent
                                                : colors.inkFaint,
                                            backgroundColor: selected
                                                ? colors.accent
                                                : 'transparent',
                                        },
                                    ]}
                                />
                            </Pressable>
                        );
                    })}
                </View>
            </SheetShell>

            {/* To-do list picker — single-select sheet that surfaces
                the household's lists. Picking "None" clears the
                default; picking a list seeds new quick tasks added
                inline with that list_id. */}
            <SheetShell
                open={listPickerOpen}
                onClose={() => setListPickerOpen(false)}
                title="To-do list"
                sub="New quick tasks added below will land in this list."
                secondary="Cancel"
                onSecondary={() => setListPickerOpen(false)}
                height={520}>
                <View style={styles.listPickerCard}>
                    <Pressable
                        onPress={() => {
                            setDefaultListId(null);
                            setListPickerOpen(false);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: defaultListId === null }}
                        accessibilityLabel="None"
                        style={({ pressed }) => [
                            styles.listPickerRow,
                            {
                                borderBottomColor: colors.hair,
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                backgroundColor:
                                    defaultListId === null
                                        ? withAlpha(colors.accent, 0x0e / 255)
                                        : 'transparent',
                            },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                ...Typography.body,
                                color: colors.text,
                            }}>
                            None
                        </ThemedText>
                        <View
                            style={[
                                styles.listPickerDot,
                                {
                                    borderColor:
                                        defaultListId === null
                                            ? colors.accent
                                            : colors.inkFaint,
                                    backgroundColor:
                                        defaultListId === null
                                            ? colors.accent
                                            : 'transparent',
                                },
                            ]}
                        />
                    </Pressable>
                    {lists.map((l, idx) => {
                        const selected = defaultListId === l.id;
                        const last = idx === lists.length - 1;
                        return (
                            <Pressable
                                key={l.id}
                                onPress={() => {
                                    setDefaultListId(l.id);
                                    setListPickerOpen(false);
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: selected }}
                                accessibilityLabel={l.name}
                                style={({ pressed }) => [
                                    styles.listPickerRow,
                                    !last && {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                    },
                                    selected && {
                                        backgroundColor: withAlpha(
                                            colors.accent,
                                            0x0e / 255,
                                        ),
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <View
                                    style={[
                                        styles.listPickerColorDot,
                                        { backgroundColor: l.color },
                                    ]}
                                />
                                <ThemedText
                                    style={{
                                        ...Typography.body,
                                        flex: 1,
                                        color: colors.text,
                                    }}
                                    numberOfLines={1}>
                                    {l.name}
                                </ThemedText>
                                <View
                                    style={[
                                        styles.listPickerDot,
                                        {
                                            borderColor: selected
                                                ? colors.accent
                                                : colors.inkFaint,
                                            backgroundColor: selected
                                                ? colors.accent
                                                : 'transparent',
                                        },
                                    ]}
                                />
                            </Pressable>
                        );
                    })}
                    {/* "+ NEW LIST" inline-create row (#468). Visible only
                        when the caller provided onCreateList. Tap toggles
                        into a TextInput; submit calls the parent's
                        createList wrapper, which returns the new List —
                        we mark it as the default and dismiss the sheet.
                        Cancel button (X) bails back to the picker. */}
                    {onCreateList && !newListMode ? (
                        <Pressable
                            onPress={() => setNewListMode(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Create a new list"
                            style={({ pressed }) => [
                                styles.listPickerRow,
                                pressed && styles.pressed,
                            ]}>
                            <Feather
                                name="plus"
                                size={14}
                                color={colors.accent}
                                style={styles.listPickerPlusIcon}
                            />
                            <ThemedText
                                style={{
                                    flex: 1,
                                    color: colors.accent,
                                    fontFamily: FontFamily.monoSemiBold,
                                    fontSize: 12,
                                    letterSpacing: 0.3,
                                    textTransform: 'uppercase',
                                }}>
                                New list
                            </ThemedText>
                        </Pressable>
                    ) : null}
                    {onCreateList && newListMode ? (
                        <View
                            style={[
                                styles.listPickerRow,
                                {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0x0e / 255,
                                    ),
                                },
                            ]}>
                            <Feather
                                name="plus"
                                size={14}
                                color={colors.accent}
                                style={styles.listPickerPlusIcon}
                            />
                            <TextInput
                                value={newListName}
                                onChangeText={setNewListName}
                                onSubmitEditing={handleNewListSubmit}
                                placeholder="List name"
                                placeholderTextColor={colors.inkFaint}
                                autoFocus
                                returnKeyType="done"
                                editable={!newListSaving}
                                style={{
                                    ...Typography.body,
                                    flex: 1,
                                    color: colors.text,
                                    paddingVertical: 0,
                                }}
                            />
                            <Pressable
                                onPress={() => {
                                    setNewListMode(false);
                                    setNewListName('');
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel new list"
                                hitSlop={6}
                                disabled={newListSaving}
                                style={({ pressed }) => [
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="x"
                                    size={14}
                                    color={colors.inkFaint}
                                />
                            </Pressable>
                        </View>
                    ) : null}
                </View>
            </SheetShell>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    // Custom sub-block inside the WHO card (now `flush`, padding 0).
    // Vertical (12) and horizontal (14) padding match FormRow's own
    // 13/14 — so the mono-caps label and chip leading edge align
    // exactly with the FormRow labels (Alternates, Mark private)
    // sitting above/below the block, which in turn align with the
    // Starts/Ends/All day/Repeats rows in the WHEN card. Gap 6 keeps
    // the mono caps label tight against the chip cluster (matches the
    // prior `fieldMonoLabel.marginBottom: 2` + `field.gap: 4` math).
    whoSubBlock: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 6,
    },
    // Caption shown under the Mark-private FormRow when isPrivate is
    // on. Same 14px horizontal inset as the FormRow so the copy lines
    // up with "Mark private" above it; negative top margin pulls it
    // tight against the row without the FormRow's bottom hairline
    // showing through.
    privacyCaptionWrap: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        marginTop: -6,
    },
    // Custom card wrapper for the Where section — mimics FormGroup's
    // visual styling (hairline border, radius 12, backgroundElement bg)
    // but WITHOUT `overflow: hidden`. We need the Places suggestions
    // dropdown to extend naturally past the card's bottom edge when
    // active, and overflow:hidden would clip it. The trade-off is that
    // a selected LocationSuggestionRow's accent tint can bleed past
    // the card's rounded top corners by a hairline; at ~5.5% alpha
    // that bleed is imperceptible.
    whereCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    // Clipping wrapper around the saved-locations ScrollView so the
    // first row's accent tint (when selected) respects the card's
    // rounded TOP corners. Bottom corners are flat — the search row
    // sits below, so the list's bottom edge meets the hairline
    // divider above the search bar (no rounding needed at that seam).
    whereListClip: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        overflow: 'hidden',
    },
    // Search-bar row wrapping PlacesAutocomplete inside the Where
    // card. paddingVertical 11 matches LocationSuggestionRow's vertical
    // rhythm so the search row reads at the same height as the saved-
    // location rows above it (was 9; bumped per UX feedback that the
    // input felt cramped).
    whereSearchInline: {
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    // Meta affordances under the Where card — formatted address +
    // Open-in-Maps link. Wrapped in a small bordered card so the
    // address text and accent link don't float as loose text on the
    // page background after a location is picked. Same border + radius
    // + bg vocabulary as the Where card itself but at smaller padding
    // so it reads as a sub-card / confirmation strip.
    whereMetaBlock: {
        marginTop: Spacing.two,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 4,
    },
    // Text styling for the location search field's TextInput — mirrors
    // the Lists tab's quickAddInput (fontSize 12, mono, letterSpacing
    // -0.2, paddingVertical 0 since the wrapping `whereSearchInline`
    // already provides the row's breathing room). Color + fontFamily +
    // web outline are applied at the call site so the light/dark
    // injection stays simple.
    searchBarInput: {
        fontSize: 12,
        letterSpacing: -0.2,
        paddingVertical: 0,
    },
    alternationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    // To-do list picker (Attach section).
    listPickerCard: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    listPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    listPickerColorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    listPickerDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        flexShrink: 0,
    },
    // Leading + glyph for the inline "+ NEW LIST" row (#468). Sized to
    // match the listPickerColorDot's 10px footprint so the new row
    // aligns left-edge-wise with the existing list rows above it.
    listPickerPlusIcon: { width: 14, height: 14, flexShrink: 0 },

    // Smart-suggestion card — dashed accent border, sparkle glyph, copy.
    // Visual scaffold; AI/recurrence-detection backend wires up under
    // #303 / #329 / #444. No horizontal padding here — the parent
    // ScrollView's `padding: 16` already insets the card to match
    // every other FormGroup-wrapped section's horizontal extent.
    smartSuggestionWrap: { paddingBottom: 18 },
    smartSuggestionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    smartSuggestionTitle: {
        fontSize: 12.5,
        fontWeight: '500',
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    smartSuggestionSub: { fontSize: 11, lineHeight: 16 },
    container: { flex: 1 },
    safe: { flex: 1 },
    // Bottom padding leaves clear runway for the sticky bottom action bar so
    // the last section (Notes) isn't covered when the user scrolls to the end.
    // ~80px = bar padding (Spacing.three top + bottom) + deleteBtn (~44px) + a
    // bit of breathing room.
    scroll: { padding: Spacing.four, gap: Spacing.two, paddingBottom: 80 },
    // Field row gap tightened from Spacing.two (8) to 4 so a section's
    // sub-label, chip strip, and follow-on row (Alternates, etc.) read
    // as one cluster instead of three loosely-stacked elements. Other
    // sections inherit this — Notes' textarea sits 4px under its label
    // now, etc. Tighter feel without losing legibility.
    field: { gap: 4 },
    // Large/focused title input per design (screens-extra-2.jsx:433-446).
    // No box border — just a 1.5px accent underline. fontSize/weight/letter-
    // spacing inlined here; fontFamily is added at the call site so the
    // light/dark color injection can stay simple.
    titleInput: {
        fontSize: 22,
        fontWeight: '600',
        letterSpacing: -0.7,
        lineHeight: 26,
        paddingVertical: 4,
        paddingHorizontal: 0,
        borderBottomWidth: 1.5,
    },
    // Notes textarea — fills the flush FormGroup directly (no inner
    // border/recess). Padding 14/12 matches FormRow's 14 horizontal /
    // 13 vertical rhythm so the Notes text baseline aligns with every
    // FormRow label and `whoSubBlock` mono label in the form.
    // minHeight 96 gives ~3 lines of breathing room at 20px line-height
    // plus the 24px vertical padding total; the field grows naturally
    // past that as the user types more.
    notesTextarea: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13.5,
        letterSpacing: -0.2,
        lineHeight: 20,
        minHeight: 96,
        textAlignVertical: 'top',
    },
    // 6px gap matches the design's chip rows (screens-extra-2.jsx:496);
    // tighter than Spacing.two (8) so chips read as a cluster, not a
    // sparse row. The form's other chip groups (alternation, recurrence,
    // children, locations) share this row style — keeping them all on the
    // same gap maintains visual rhythm.
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    // Mono-caps section sub-label inside a FormGroup row — used for
    // RESPONSIBLE / FOR CHILD(REN) / TITLE etc. Pulls typography from
    // the shared Typography.monoCaps preset (10/600/0.4/uppercase mono
    // semibold) so a future palette / type refresh ripples to every
    // form sub-label in one place. Only the marginBottom is per-call:
    // 2px keeps the cluster tight against the chip row below (parent
    // field's 4px gap + this 2px = ~6px label-baseline → chip-top
    // distance).
    fieldMonoLabel: {
        ...Typography.monoCaps,
        marginBottom: 2,
    },
    // Top-of-form card containing the "Apply changes to: series / occurrence" toggle.
    // Only rendered when editing a specific instance of a recurring event.
    applyToCard: {
        padding: Spacing.three,
        borderRadius: Spacing.two,
        gap: Spacing.two,
    },
    // Apply-to toggle chips inside the applyToCard. Pill-shape with a
    // colored border + transparent/accent-fill swap on selection.
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    // "Open in Google Maps" link — flex row laying out the accent-tinted
    // Feather map-pin icon + the accent-colored label with 6px between.
    // Both children share colors.accent (the palette's forest green) so
    // the link reads as one cohesive tap target, not a half-red-emoji /
    // half-green-label mix as it did with the prior 📍 emoji prefix.
    mapsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: Spacing.one,
    },
    errorText: { color: BrandColors.error },
    deleteBtn: {
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: BrandColors.errorBackground,
        alignItems: 'center',
    },
    deleteText: { color: BrandColors.error, fontWeight: '600' },
    // Sticky bottom bar holding destructive actions. Pinned to the SafeAreaView's
    // bottom edge via position:absolute so the ScrollView above it gets a clean
    // 0..containerHeight scrollable area, and the bar always reads as a separate
    // surface (with its own hairline top border + theme background).
    bottomActionBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.three,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: Spacing.two,
    },
    pressed: { opacity: 0.7 },
});
