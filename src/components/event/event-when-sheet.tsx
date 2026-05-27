// EventWhenSheet — field-edit sheet for the WHEN row.
//
// Rebuilt around the TaskDetail v2 DuePickerSheet vocabulary (#424): a
// quick-preset chip grid + MiniCalendar for the date, and big-mono time
// cards with quick-chip strips for the time. Mirrors the surface language
// of every other field sheet (Repeats / For whom / Location) so the
// EventDetail editing experience reads as a coherent set.
//
// Layout, top to bottom:
//   1. All-day toggle — flips the body between date-only and date+time.
//   2. QUICK PRESETS — 2×2 chip grid (Today / Tomorrow / This weekend /
//      Next week). Each preset moves the START date forward; the time of
//      day is preserved so a recurring 19:00 dinner stays at 19:00 when
//      you nudge it to "Tomorrow".
//   3. DATE · MMM YYYY — MiniCalendar grid for the start day.
//   4. (all-day only) ENDS ON — inline DateField for multi-day all-day
//      ranges. Defaults to the start date when collapsed.
//   5. (timed only) START TIME + END TIME — two cards with a big mono
//      HH:MM readout and a quick-chip strip each. START chips are
//      absolute (08:00 / 12:00 / 17:00 / 20:00); END chips are relative
//      durations (+30m / +1h / +2h / +4h) measured from START.
//
// Save behavior preserves every other field on the event row verbatim
// (recurrence, location, responsibles, child_ids, …). Cross-midnight
// timed events are rolled forward by a day at save time to keep duration
// positive — every modern calendar (Google, Apple) uses this convention.
// All-day rows are UTC-midnight anchored (QA-005 / QA-014) with the
// inclusive UI end date converted to an exclusive ends_at by +1 day.

import { addDays, format, isSameDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { DateField } from '@/components/datetime-fields';
import { MiniCalendar, SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { updateEvent, type Event, type NewEventResponsibleInput } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    event: Event;
};

// Start-time chips — common event start hours, mono'd in the readout.
const START_TIME_CHIPS = ['08:00', '12:00', '17:00', '20:00'] as const;
// End-time chips — relative durations from start. Cleaner than absolute
// end hours because it expresses what the user actually picks ("how long
// does this last"), which is the right vocabulary for an event.
const END_DURATION_CHIPS = [
    { label: '+30m', minutes: 30 },
    { label: '+1h', minutes: 60 },
    { label: '+2h', minutes: 120 },
    { label: '+4h', minutes: 240 },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
    // Local-midnight Date for the given YYYY-MM-DD. Used as the
    // MiniCalendar's selected anchor so highlighting + isSameDay land on
    // the right cell regardless of timezone.
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function hhmm(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addOneDayYmd(s: string): string {
    // Pure-YYYY-MM-DD day-shift, avoids the local/UTC mutator confusion
    // that bit the cross-midnight save path (QA #1 — `setUTCDate` on a
    // locally-constructed Date misbehaves in any TZ east of UTC where
    // the local day differs from the UTC day).
    const d = parseYmd(s);
    d.setDate(d.getDate() + 1);
    return ymd(d);
}

function addMinutesToTime(time: string, minutes: number): string {
    const [hStr, mStr] = time.split(':');
    const total = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + minutes;
    // Wrap into 24h — cross-midnight is handled in save (we keep the
    // wall-clock and let the save path roll the date forward).
    const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function compareTimeStrings(a: string, b: string): number {
    // Lexicographic compare works for zero-padded HH:MM, so use it.
    return a.localeCompare(b);
}

function weekendStartFrom(now: Date): Date {
    // Next Saturday. If today is Sat or Sun, snap to today (this
    // "weekend" still applies).
    const day = now.getDay();
    const daysToSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
    return addDays(now, daysToSat);
}

function nextMondayFrom(now: Date): Date {
    const day = now.getDay();
    const daysToMon = day === 0 ? 1 : 8 - day;
    return addDays(now, daysToMon);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EventWhenSheet({ open, onClose, onSaved, event }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Draft state seeded from the event row on every (re-)open so a stale
    // value from a previous edit can't leak in.
    const initialStartDate = event.starts_at.slice(0, 10);
    const computeAllDayEndDate = (): string => {
        // ends_at is exclusive for all-day rows (Wed 00:00 covers Tue).
        // Subtract one day to get the inclusive end date the UI shows.
        const end = new Date(event.ends_at);
        end.setUTCDate(end.getUTCDate() - 1);
        return end.toISOString().slice(0, 10);
    };
    // Seed end date from the event row for BOTH branches (QA #2).
    // Previously timed events collapsed to start-day-only, silently
    // shortening multi-day timed events (e.g. a 09:00 May 25 → 17:00
    // May 26 conference) when the user re-saved without touching
    // anything.
    const initialEndDate = event.all_day
        ? computeAllDayEndDate()
        : event.ends_at.slice(0, 10);
    const initialStartTime = hhmm(new Date(event.starts_at));
    const initialEndTime = hhmm(new Date(event.ends_at));

    const [allDay, setAllDay] = useState(event.all_day);
    const [date, setDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState(initialEndTime);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setAllDay(event.all_day);
        setDate(initialStartDate);
        setEndDate(initialEndDate);
        setStartTime(initialStartTime);
        setEndTime(initialEndTime);
        setError(null);
        // intentional: snapshot on open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // ─── Preset + cell handlers ─────────────────────────────────────────────

    // Shift endDate by the same delta as start moved — preserves the
    // user's existing range (a 3-day all-day event stays 3 days when
    // the user nudges start by a week). Falls back to `next` if there
    // was no end date or the parse failed.
    const shiftEndDateRelative = (
        prevStart: string,
        nextStart: string,
    ): string => {
        if (!endDate) return nextStart;
        const prev = parseYmd(prevStart);
        const newStart = parseYmd(nextStart);
        const deltaMs = newStart.getTime() - prev.getTime();
        if (Number.isNaN(deltaMs) || deltaMs === 0) return endDate;
        const newEnd = new Date(parseYmd(endDate).getTime() + deltaMs);
        return ymd(newEnd);
    };

    const applyDatePreset = (
        kind: 'today' | 'tomorrow' | 'weekend' | 'next-week',
    ) => {
        const now = new Date();
        let target: Date;
        if (kind === 'today') target = now;
        else if (kind === 'tomorrow') target = addDays(now, 1);
        else if (kind === 'weekend') target = weekendStartFrom(now);
        else target = nextMondayFrom(now);
        const nextStart = ymd(target);
        setEndDate(shiftEndDateRelative(date, nextStart));
        setDate(nextStart);
    };

    const setDay = (d: Date) => {
        const next = ymd(d);
        setEndDate(shiftEndDateRelative(date, next));
        setDate(next);
    };

    const setStartChip = (time: string) => {
        setStartTime(time);
        // If end is now at-or-before start, push it out by 1h preserving
        // the user's chosen duration semantics. They can still override
        // end with their own chip if they want a custom duration.
        if (compareTimeStrings(endTime, time) <= 0) {
            setEndTime(addMinutesToTime(time, 60));
        }
    };

    const setEndDurationChip = (minutes: number) => {
        setEndTime(addMinutesToTime(startTime, minutes));
    };

    const isPresetActive = (
        kind: 'today' | 'tomorrow' | 'weekend' | 'next-week',
    ): boolean => {
        if (!date) return false;
        const d = parseYmd(date);
        const now = new Date();
        if (kind === 'today') return isSameDay(d, now);
        if (kind === 'tomorrow') return isSameDay(d, addDays(now, 1));
        if (kind === 'weekend') return isSameDay(d, weekendStartFrom(now));
        return isSameDay(d, nextMondayFrom(now));
    };

    const isStartChipActive = (time: string): boolean => startTime === time;
    const isEndChipActive = (minutes: number): boolean =>
        addMinutesToTime(startTime, minutes) === endTime;

    // ─── Save ───────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        setError(null);
        try {
            let startsAt: Date;
            let endsAt: Date;
            if (allDay) {
                // UTC-midnight anchored (QA-005). Inclusive UI end →
                // exclusive ends_at via +1 day.
                startsAt = new Date(`${date}T00:00:00Z`);
                const effectiveEnd = endDate && endDate >= date ? endDate : date;
                endsAt = new Date(`${effectiveEnd}T00:00:00Z`);
                endsAt.setUTCDate(endsAt.getUTCDate() + 1);
            } else {
                startsAt = new Date(`${date}T${startTime}`);
                // Multi-day timed support (QA #2): use the seeded /
                // shift-preserved endDate so pre-existing multi-day
                // timed events don't collapse to a single day on save.
                // Falls back to `date` for the common single-day case.
                let effectiveEndDate = endDate || date;
                // Cross-midnight timed event (e.g. 22:00 → 02:00) on a
                // single-day range: the wall-clock end is "earlier"
                // than start, so roll the end DATE forward one day.
                // Done via the YMD helper (not setUTCDate on a local
                // Date — QA #1: that mutator misbehaves in any TZ east
                // of UTC, blocking save in JST etc.).
                if (
                    effectiveEndDate === date &&
                    compareTimeStrings(endTime, startTime) <= 0
                ) {
                    effectiveEndDate = addOneDayYmd(date);
                }
                endsAt = new Date(`${effectiveEndDate}T${endTime}`);
                if (endsAt.getTime() <= startsAt.getTime()) {
                    throw new Error('End time must be after the start time.');
                }
            }
            // Preserve every other field on the event row.
            const responsibles: NewEventResponsibleInput[] =
                event.responsibles.length > 0
                    ? event.responsibles.map((r) => ({
                          profileId: r.profile_id,
                          isLead: r.is_lead,
                      }))
                    : event.responsible_profile_id
                      ? [
                            {
                                profileId: event.responsible_profile_id,
                                isLead: true,
                            },
                        ]
                      : [];
            // All-day events anchor at UTC for storage tz too (QA-014).
            const submitTimezone = allDay ? 'UTC' : event.timezone;
            await updateEvent(event.id, {
                title: event.title,
                startsAt,
                endsAt,
                allDay,
                description: event.description,
                location: event.location,
                locationId: event.location_id,
                recurrenceRule: event.recurrence_rule,
                eventType: event.event_type,
                timezone: submitTimezone,
                childIds: event.child_ids,
                responsibleAlternation: event.responsible_alternation,
                responsibles,
            });
            onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    // ─── Dynamic chip labels ────────────────────────────────────────────────

    const summary = useMemo(() => {
        const d = parseYmd(date);
        if (Number.isNaN(d.getTime())) return 'Save';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDay = new Date(d);
        dueDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
            (dueDay.getTime() - today.getTime()) / 86400000,
        );
        const dayLabel =
            diffDays === 0
                ? 'Today'
                : diffDays === 1
                  ? 'Tomorrow'
                  : diffDays > 1 && diffDays <= 6
                    ? format(d, 'EEE')
                    : format(d, 'MMM d');
        if (allDay) {
            if (endDate && endDate > date) {
                const e = parseYmd(endDate);
                return `Save · ${dayLabel} → ${format(e, 'MMM d')}`;
            }
            return `Save · ${dayLabel}`;
        }
        return `Save · ${dayLabel} ${startTime}`;
    }, [date, endDate, allDay, startTime]);

    const sub = useMemo(() => {
        // Show the row's current value so the user can compare against
        // what they're about to commit to. Mirrors DueDateSheet's sub.
        const start = new Date(event.starts_at);
        const end = new Date(event.ends_at);
        if (event.all_day) {
            // Walk end back to its inclusive UI form.
            const inclusiveEnd = new Date(end);
            inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
            const startStr = start.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
            const sameDay = isSameDay(start, inclusiveEnd);
            if (sameDay) return `Currently ${startStr} · All day`;
            const endStr = inclusiveEnd.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
            return `Currently ${startStr} → ${endStr}`;
        }
        const sameDay = isSameDay(start, end);
        if (sameDay) {
            return `Currently ${start.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            })} · ${hhmm(start)} – ${hhmm(end)}`;
        }
        return `Currently ${start.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })} ${hhmm(start)} → ${end.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })} ${hhmm(end)}`;
    }, [event.starts_at, event.ends_at, event.all_day]);

    // MiniCalendar anchor: keep navigating around the user's selection
    // rather than today so editing a far-future event lands on the right
    // month immediately.
    const calendarSelected = useMemo(() => parseYmd(date), [date]);
    const calendarAnchor = calendarSelected;

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="When"
            sub={sub}
            primary={saving ? 'Saving…' : summary}
            secondary="Cancel"
            onPrimary={handleSave}
            onSecondary={onClose}
            height={640}
            primaryDisabled={saving}>
            {/* All-day toggle row — radius + padding rhythm matches the
                rest of the surface vocabulary (timeCard, DueChip). */}
            <View
                style={[
                    styles.row,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <ThemedText style={[styles.rowLabel, { color: colors.text }]}>
                    All day
                </ThemedText>
                <Switch value={allDay} onValueChange={setAllDay} disabled={saving} />
            </View>

            {/* Quick presets */}
            <SectionLabel label="Quick presets" colors={colors} />
            <View style={styles.presetGrid}>
                <PresetChip
                    label="Today"
                    selected={isPresetActive('today')}
                    onPress={() => applyDatePreset('today')}
                    colors={colors}
                />
                <PresetChip
                    label="Tomorrow"
                    selected={isPresetActive('tomorrow')}
                    onPress={() => applyDatePreset('tomorrow')}
                    colors={colors}
                />
                <PresetChip
                    label="This weekend"
                    sub="Sat"
                    selected={isPresetActive('weekend')}
                    onPress={() => applyDatePreset('weekend')}
                    colors={colors}
                />
                <PresetChip
                    label="Next week"
                    sub="Mon"
                    selected={isPresetActive('next-week')}
                    onPress={() => applyDatePreset('next-week')}
                    colors={colors}
                />
            </View>

            {/* MiniCalendar */}
            <View style={styles.section}>
                <SectionLabel
                    label={`Date · ${format(calendarAnchor, 'MMM yyyy')}`}
                    colors={colors}
                />
                <MiniCalendar
                    monthAnchor={calendarAnchor}
                    selected={calendarSelected}
                    onSelect={setDay}
                    colors={colors}
                />
            </View>

            {allDay ? (
                <View style={styles.section}>
                    <SectionLabel
                        label="Ends on (optional)"
                        colors={colors}
                    />
                    <DateField value={endDate} onChange={setEndDate} />
                    {endDate && endDate > date ? (
                        // Same-day chip — uses the secondaryBtn vocabulary
                        // (hairline, backgroundInset, radius 10) so it
                        // sits in the same chip family as everything else
                        // on the sheet (audit #5).
                        <Pressable
                            onPress={() => setEndDate(date)}
                            accessibilityRole="button"
                            accessibilityLabel="Collapse multi-day range to a single day"
                            style={({ pressed }) => [
                                styles.sameDayChip,
                                {
                                    backgroundColor: colors.backgroundInset,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.sameDayChipText,
                                    { color: colors.text },
                                ]}>
                                Same day
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </View>
            ) : (
                <>
                    <View style={styles.section}>
                        <SectionLabel label="Start time" colors={colors} />
                        <TimeCard
                            value={startTime}
                            chips={START_TIME_CHIPS.map((t) => ({
                                label: t,
                                a11yLabel: `Start at ${t}`,
                                active: isStartChipActive(t),
                                onPress: () => setStartChip(t),
                            }))}
                            colors={colors}
                        />
                    </View>
                    <View style={styles.section}>
                        <SectionLabel label="End time" colors={colors} />
                        <TimeCard
                            value={endTime}
                            chips={END_DURATION_CHIPS.map((c) => ({
                                label: c.label,
                                a11yLabel: `End ${c.minutes} minutes after start`,
                                active: isEndChipActive(c.minutes),
                                onPress: () => setEndDurationChip(c.minutes),
                            }))}
                            colors={colors}
                        />
                    </View>
                </>
            )}

            {error ? (
                <ThemedText style={[styles.errorText, { color: colors.alert }]}>
                    {error}
                </ThemedText>
            ) : null}
        </SheetShell>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ label, colors }: { label: string; colors: Palette }) {
    return (
        <ThemedText
            style={[
                styles.sectionLabel,
                {
                    color: colors.inkFaint,
                    fontFamily: FontFamily.monoSemiBold,
                },
            ]}>
            {label.toUpperCase()}
        </ThemedText>
    );
}

function PresetChip({
    label,
    sub,
    selected,
    onPress,
    colors,
}: {
    label: string;
    sub?: string;
    selected: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={sub ? `${label} (${sub})` : label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
                styles.presetChip,
                {
                    backgroundColor: selected
                        ? withAlpha(colors.accent, 0x14 / 255)
                        : colors.backgroundInset,
                    borderColor: selected ? colors.accent : colors.hair,
                    borderWidth: selected ? 1.2 : StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            <ThemedText
                style={[styles.presetChipLabel, { color: colors.text }]}>
                {label}
            </ThemedText>
            {sub ? (
                <ThemedText
                    style={[
                        styles.presetChipSub,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {sub}
                </ThemedText>
            ) : null}
        </Pressable>
    );
}

type ChipDescriptor = {
    label: string;
    /** Optional richer a11y label — falls back to `label` when omitted. */
    a11yLabel?: string;
    active: boolean;
    onPress: () => void;
};

function TimeCard({
    value,
    chips,
    colors,
}: {
    value: string;
    chips: ChipDescriptor[];
    colors: Palette;
}) {
    return (
        <View
            style={[
                styles.timeCard,
                {
                    backgroundColor: colors.backgroundInset,
                    borderColor: colors.hair,
                },
            ]}>
            <ThemedText
                style={[
                    styles.timeBig,
                    {
                        color: colors.text,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                {value || '—:—'}
            </ThemedText>
            <View style={{ flex: 1 }} />
            <View style={styles.timeChipRow}>
                {chips.map((c) => (
                    <Pressable
                        key={c.label}
                        onPress={c.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={c.a11yLabel ?? c.label}
                        accessibilityState={{ selected: c.active }}
                        style={({ pressed }) => [
                            styles.timeChip,
                            {
                                backgroundColor: c.active
                                    ? colors.accent
                                    : colors.backgroundElement,
                                borderColor: c.active
                                    ? colors.accent
                                    : colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.timeChipText,
                                {
                                    color: c.active
                                        ? colors.onAccent
                                        : colors.inkSec,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            {c.label}
                        </ThemedText>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // All-day toggle — radius 12 matches the leading-control silhouette
    // used by EventRecurrenceSheet's radio card so the two sheets share
    // a consistent "first thing you see" shape.
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: Spacing.two,
    },
    rowLabel: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    // SectionLabel already supplies the 8px gap to content via its own
    // marginBottom — adding `gap` here would double it (audit #2).
    section: {
        marginTop: 14,
    },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    presetChip: {
        flexBasis: '48%',
        flexGrow: 1,
        paddingVertical: 10,
        paddingHorizontal: 11,
        borderRadius: 10,
    },
    presetChipLabel: {
        fontSize: 12.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    presetChipSub: {
        fontSize: 10,
        marginTop: 2,
        letterSpacing: -0.1,
    },
    timeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    timeBig: {
        fontSize: 28,
        fontWeight: '600',
        letterSpacing: -1,
    },
    timeChipRow: {
        flexDirection: 'row',
        gap: 6,
    },
    timeChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    timeChipText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    // Same-day chip — small secondary-style pill sitting beneath the
    // end-date DateField when a multi-day range is active.
    sameDayChip: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    sameDayChipText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    errorText: { fontSize: 12, marginTop: Spacing.one },
    pressed: { opacity: 0.7 },
});
