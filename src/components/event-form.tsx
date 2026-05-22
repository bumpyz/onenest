import { useMemo, useState } from 'react';
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

import { DateField, TimeField } from '@/components/datetime-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import {
    UNASSIGNED_COLOR,
    colorForResponsible,
    memberColorMap,
} from '@/lib/colors';
import type { HouseholdMember, Location, NewEventInput } from '@/lib/db';
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
};

export type EventFormValues = {
    title: string;
    date: string; // YYYY-MM-DD
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
};

type Props = {
    headerTitle: string;
    submitLabel?: string;
    members: HouseholdMember[];
    locations: Location[];
    currentUserId: string;
    initialValues: EventFormValues;
    onSubmit: (input: EventFormSubmitInput) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

export function EventForm({
    headerTitle,
    submitLabel = 'Save',
    members,
    locations,
    currentUserId,
    initialValues,
    onSubmit,
    onDelete,
    onCancel,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [title, setTitle] = useState(initialValues.title);
    const [date, setDate] = useState(initialValues.date);
    const [startTime, setStartTime] = useState(initialValues.startTime);
    const [endTime, setEndTime] = useState(initialValues.endTime);
    const [allDay, setAllDay] = useState(initialValues.allDay);
    const [locationName, setLocationName] = useState(initialValues.locationName);
    const [locationMapsUrl, setLocationMapsUrl] = useState(initialValues.locationMapsUrl);
    const [notes, setNotes] = useState(initialValues.notes);
    const [responsibleId, setResponsibleId] = useState<string | null>(
        initialValues.responsibleProfileId,
    );
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

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    // If the current name (case-insensitive) matches a saved location, treat it as picked:
    // its Maps URL is the source of truth, and we hide the Maps URL input field.
    const matchedLocation = useMemo<Location | null>(() => {
        const t = locationName.trim().toLowerCase();
        if (!t) return null;
        return locations.find((l) => l.name.toLowerCase() === t) ?? null;
    }, [locations, locationName]);

    const showMapsUrlField =
        locationName.trim().length > 0 && matchedLocation === null;

    const busy = submitting || deleting;
    const canSubmit = title.trim().length > 0 && !busy;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            let startsAt: Date;
            let endsAt: Date;
            if (allDay) {
                startsAt = new Date(`${date}T00:00`);
                endsAt = new Date(startsAt);
                endsAt.setDate(endsAt.getDate() + 1);
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
            let recurrenceRule: string | null;
            if (recurrencePreset === 'custom') {
                if (customDays.size === 0) {
                    recurrenceRule = initialValues.recurrenceRule;
                } else {
                    recurrenceRule = buildRRule('custom', Array.from(customDays));
                }
            } else {
                recurrenceRule = buildRRule(recurrencePreset);
            }

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
                locationName: locationName.trim(),
                locationMapsUrl: locationMapsUrl.trim(),
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
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Title</ThemedText>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Soccer practice"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoFocus
                            editable={!busy}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Responsible parent</ThemedText>
                        <View style={styles.chipRow}>
                            {members.map((m) => {
                                const color = colorForResponsible(m.profile_id, colorMap);
                                const selected = responsibleId === m.profile_id;
                                const label = currentUserId === m.profile_id ? 'Me' : m.display_name;
                                return (
                                    <Pressable
                                        key={m.profile_id}
                                        onPress={() => setResponsibleId(m.profile_id)}
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
                                onPress={() => setResponsibleId(null)}
                                disabled={busy}
                                style={({ pressed }) => [
                                    styles.chip,
                                    {
                                        borderColor: UNASSIGNED_COLOR,
                                        backgroundColor:
                                            responsibleId === null ? UNASSIGNED_COLOR : 'transparent',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <View style={[styles.chipDot, { backgroundColor: UNASSIGNED_COLOR }]} />
                                <ThemedText
                                    type="small"
                                    style={{
                                        color: responsibleId === null ? '#fff' : colors.text,
                                        fontWeight: '500',
                                    }}>
                                    Anyone
                                </ThemedText>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Type</ThemedText>
                        <View style={styles.chipRow}>
                            <Pressable
                                onPress={() => setEventType(null)}
                                disabled={busy}
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
                                        disabled={busy}
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

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Date</ThemedText>
                        <DateField value={date} onChange={setDate} />
                    </View>

                    <View style={styles.allDayRow}>
                        <ThemedText type="smallBold">All day</ThemedText>
                        <Switch value={allDay} onValueChange={setAllDay} disabled={busy} />
                    </View>

                    {!allDay ? (
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
                    ) : null}

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
                                        disabled={busy}
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
                                            disabled={busy}
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
                            <ThemedText themeColor="textSecondary" type="small">
                                {recurrencePreset === 'custom' && customDays.size === 0
                                    ? 'Pick at least one day, or change to Does not repeat to remove recurrence.'
                                    : 'Editing or deleting affects every occurrence in the series.'}
                            </ThemedText>
                        ) : null}
                    </View>

                    {/* Location */}
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Location (optional)</ThemedText>

                        {locations.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.locationChipRow}>
                                {locations.map((loc) => {
                                    const selected = matchedLocation?.id === loc.id;
                                    return (
                                        <Pressable
                                            key={loc.id}
                                            onPress={() => {
                                                setLocationName(loc.name);
                                                setLocationMapsUrl(loc.google_maps_url ?? '');
                                            }}
                                            disabled={busy}
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
                        ) : null}

                        <TextInput
                            value={locationName}
                            onChangeText={(t) => {
                                setLocationName(t);
                                // When typing away from the currently-matched saved location, clear
                                // the URL so we don't carry a stale link from the previous place
                                // into the new entry's URL field.
                                if (
                                    matchedLocation &&
                                    t.trim().toLowerCase() !==
                                        matchedLocation.name.toLowerCase()
                                ) {
                                    setLocationMapsUrl('');
                                }
                            }}
                            placeholder={
                                locations.length > 0 ? 'Pick a saved place or type a new one' : 'e.g. School field'
                            }
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            editable={!busy}
                        />

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
                                    editable={!busy}
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
                            editable={!busy}
                        />
                    </View>

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {onDelete ? (
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
