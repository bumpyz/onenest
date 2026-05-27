// EventRecurrenceSheet — field-edit sheet for the Repeats row.
//
// Rebuilt around the TaskDetail v2 RecurringSheet vocabulary (#425): a
// radio-row list with sentence-case labels + mono sublabels describing
// each rule. Mirrors how every other field sheet in this family is
// organized so the editing experience reads as one coherent surface.
//
// Layout, top to bottom:
//   1. Row list — Does not repeat / Daily / Weekly / Every weekday /
//      Monthly / Custom. Each row carries an event-aware mono sublabel
//      ("Every Mon" derived from the event's start weekday, "On the
//      27th" derived from the event's day-of-month) so the user can see
//      what the rule will do without having to think through RFC 5545.
//   2. ON THESE DAYS — weekday chip strip, shown only when Custom is
//      selected.
//   3. ENDS ON (OPTIONAL) — UNTIL date picker, shown for any non-"none"
//      preset.
//
// Save behavior writes the resolved RRULE string back to
// events.recurrence_rule. Every other field on the event row is round-
// tripped verbatim via updateEvent. Custom + zero days resolves to
// `rule = null` (matches buildRRule's own null return for that case) and
// is also blocked by primaryDisabled as belt-and-braces.

import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/datetime-fields';
import { SheetShell } from '@/components/ds';
import { RadioBubble } from '@/components/task/radio-bubble';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import {
    updateEvent,
    type Event,
    type NewEventResponsibleInput,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import {
    WEEKDAY_OPTIONS,
    buildRRule,
    parseRecurrence,
    weekdayForDate,
    type RecurrencePresetId,
    type WeekdayCode,
} from '@/lib/recurrence';
import { useAppColorScheme } from '@/providers/theme-provider';

// Indexed by getDay() — used to translate a tz-resolved weekday back to a
// WeekdayCode. Mirrors the table in lib/recurrence.ts (kept here to avoid
// exporting that internal).
const WEEKDAY_BY_GETDAY: readonly WeekdayCode[] = [
    'SU',
    'MO',
    'TU',
    'WE',
    'TH',
    'FR',
    'SA',
];

// Resolve the event's anchor weekday + day-of-month against `event.timezone`
// (QA #3). The raw `new Date(event.starts_at).getDay()` reads the LOCAL
// weekday of the UTC instant — wrong for a tz-anchored recurring event
// being viewed from a different tz. Example: a NYC Sat 22:00 event
// stored as 2026-05-31T02:00:00Z would read as "Sun" via getDay() on a
// UTC+2 phone, but the user thinks of it as "Saturday" because that's
// the NYC wall clock. Luxon resolves it correctly.
function weekdayCodeForEvent(event: Event): WeekdayCode {
    if (event.timezone) {
        const dt = DateTime.fromISO(event.starts_at, { zone: event.timezone });
        if (dt.isValid) {
            // luxon.weekday: 1=Mon..7=Sun. Map to getDay()-style 0..6.
            const jsDay = dt.weekday === 7 ? 0 : dt.weekday;
            return WEEKDAY_BY_GETDAY[jsDay];
        }
    }
    return weekdayForDate(new Date(event.starts_at));
}

function dayOfMonthForEvent(event: Event): number {
    if (event.timezone) {
        const dt = DateTime.fromISO(event.starts_at, { zone: event.timezone });
        if (dt.isValid) return dt.day;
    }
    return new Date(event.starts_at).getDate();
}

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    event: Event;
};

// Order matters — this is the visual order of the radio rows. We diverge
// from RECURRENCE_PRESET_OPTIONS' order (which has Custom last with an
// ellipsis) only to keep the row list sentence-case + uniform.
const ROW_ORDER: RecurrencePresetId[] = [
    'none',
    'daily',
    'weekly',
    'weekdays',
    'monthly',
    'custom',
];

// Sentence-case labels for the row list. Departs slightly from the
// canonical RECURRENCE_PRESET_OPTIONS labels ("Custom…" → "Custom") to
// match the row-list visual rhythm.
const ROW_LABELS: Record<RecurrencePresetId, string> = {
    none: 'Does not repeat',
    daily: 'Daily',
    weekly: 'Weekly',
    weekdays: 'Every weekday',
    monthly: 'Monthly',
    custom: 'Custom',
};

// English-ordinal suffix for "On the 27th" style monthly sublabels.
function ordinalSuffix(n: number): string {
    const rem10 = n % 10;
    const rem100 = n % 100;
    if (rem10 === 1 && rem100 !== 11) return 'st';
    if (rem10 === 2 && rem100 !== 12) return 'nd';
    if (rem10 === 3 && rem100 !== 13) return 'rd';
    return 'th';
}

export function EventRecurrenceSheet({ open, onClose, onSaved, event }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Memoize parse so it runs once per rule change instead of on every
    // render (QA #4). The useState initializers below close over this
    // memo's first value; the open-effect re-syncs draft state.
    const parsedInitial = useMemo(
        () => parseRecurrence(event.recurrence_rule),
        [event.recurrence_rule],
    );
    const [preset, setPreset] = useState<RecurrencePresetId>(parsedInitial.preset);
    const [customDays, setCustomDays] = useState<Set<WeekdayCode>>(
        () => new Set(parsedInitial.byday),
    );
    const [untilDate, setUntilDate] = useState<string>(parsedInitial.until ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        // Re-sync from parsedInitial so a mid-open prop refresh of
        // event.recurrence_rule lands in the draft on next open.
        setPreset(parsedInitial.preset);
        setCustomDays(new Set(parsedInitial.byday));
        setUntilDate(parsedInitial.until ?? '');
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Compute event-aware mono sublabels so each row tells the user what
    // the rule will do for THIS event (e.g. "Every Mon", "On the 27th")
    // rather than abstract preset descriptions. Resolves weekday + day-
    // of-month against event.timezone (QA #3).
    const sublabels = useMemo<Record<RecurrencePresetId, string>>(() => {
        const code = weekdayCodeForEvent(event);
        const dayLabel =
            WEEKDAY_OPTIONS.find((o) => o.code === code)?.label ?? 'day';
        const dom = dayOfMonthForEvent(event);
        return {
            none: 'One-time',
            daily: 'Every day',
            weekly: `Every ${dayLabel}`,
            weekdays: 'Mon to Fri',
            monthly: `On the ${dom}${ordinalSuffix(dom)}`,
            custom:
                customDays.size === 0
                    ? 'Pick days'
                    : Array.from(customDays)
                          .map(
                              (c) =>
                                  WEEKDAY_OPTIONS.find((o) => o.code === c)
                                      ?.label ?? c,
                          )
                          .join(' · '),
        };
    }, [event, customDays]);

    const handlePresetSelect = (id: RecurrencePresetId) => {
        setPreset(id);
        if (id === 'custom' && customDays.size === 0) {
            // Seed Custom with the event's own weekday so the picker has
            // a sensible default instead of "no days selected" the user
            // immediately has to fix. tz-resolved to match the sublabel
            // ("Every Mon" must seed Mon, not Sun, for a NYC Sat 22:00
            // event viewed from a UTC+2 phone — QA #3).
            setCustomDays(new Set([weekdayCodeForEvent(event)]));
        }
    };

    const toggleDay = (code: WeekdayCode) => {
        setCustomDays((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        setError(null);
        try {
            const startDate = event.starts_at.slice(0, 10);
            const until = untilDate.trim() || null;
            if (until && until < startDate) {
                throw new Error(
                    "Recurrence end date must be on or after the event's start date.",
                );
            }
            let rule: string | null;
            if (preset === 'custom') {
                if (customDays.size === 0) {
                    // QA-found: silently re-saving the previous rule made
                    // the chip look "schizo" — user picked Custom + no
                    // days, but on reopen the picker said Weekly.
                    // Resolve to null to match buildRRule's own behavior
                    // for this case; primaryDisabled blocks the path too.
                    rule = null;
                } else {
                    rule = buildRRule('custom', Array.from(customDays), until);
                }
            } else {
                rule = buildRRule(preset, undefined, until);
            }
            const responsibles: NewEventResponsibleInput[] =
                event.responsibles.length > 0
                    ? event.responsibles.map((r) => ({
                          profileId: r.profile_id,
                          isLead: r.is_lead,
                      }))
                    : event.responsible_profile_id
                      ? [{ profileId: event.responsible_profile_id, isLead: true }]
                      : [];
            await updateEvent(event.id, {
                title: event.title,
                startsAt: new Date(event.starts_at),
                endsAt: new Date(event.ends_at),
                allDay: event.all_day,
                description: event.description,
                location: event.location,
                locationId: event.location_id,
                recurrenceRule: rule,
                eventType: event.event_type,
                timezone: event.timezone,
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

    const summary = `Save · ${ROW_LABELS[preset]}`;

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Repeats"
            sub="The selected rule applies to every future occurrence."
            primary={saving ? 'Saving…' : summary}
            secondary="Cancel"
            onPrimary={handleSave}
            onSecondary={onClose}
            // Tall enough for: row list (~340) + weekday strip (~70) +
            // UNTIL field (~80) + padding. Slightly shorter when Custom
            // isn't open so the picker doesn't drift into dead space.
            height={preset === 'custom' ? 640 : 580}
            // Disable Save when the user is on Custom but hasn't picked
            // any weekdays — that combination is meaningless (no rule
            // can be built) and was previously silently re-saving the
            // prior rule on commit.
            primaryDisabled={
                saving || (preset === 'custom' && customDays.size === 0)
            }>
            {/* Row list — single rounded card with hairline-separated
                rows. Mirrors RecurringSheet's pattern for visual
                consistency across sheet types. */}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                {ROW_ORDER.map((id, idx) => {
                    const isSelected = preset === id;
                    const isLast = idx === ROW_ORDER.length - 1;
                    return (
                        <Pressable
                            key={id}
                            onPress={() => handlePresetSelect(id)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={`${ROW_LABELS[id]}, ${sublabels[id]}`}
                            disabled={saving}
                            style={({ pressed }) => [
                                styles.row,
                                !isLast && {
                                    borderBottomColor: colors.hair,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                },
                                isSelected && {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0x0e / 255,
                                    ),
                                },
                                pressed && styles.pressed,
                            ]}>
                            <View style={styles.rowBody}>
                                <ThemedText
                                    style={[
                                        styles.label,
                                        { color: colors.text },
                                    ]}>
                                    {ROW_LABELS[id]}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.subLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {sublabels[id]}
                                </ThemedText>
                            </View>
                            <RadioBubble
                                selected={isSelected}
                                accentColor={colors.accent}
                                onAccentColor={colors.onAccent}
                                inactiveColor={colors.inkFaint}
                            />
                        </Pressable>
                    );
                })}
            </View>

            {preset === 'custom' ? (
                <View style={styles.section}>
                    <SectionLabel label="On these days" colors={colors} />
                    <View style={styles.weekdayRow}>
                        {WEEKDAY_OPTIONS.map((opt) => {
                            const selected = customDays.has(opt.code);
                            return (
                                <Pressable
                                    key={opt.code}
                                    onPress={() => toggleDay(opt.code)}
                                    disabled={saving}
                                    accessibilityRole="button"
                                    accessibilityLabel={opt.label}
                                    accessibilityState={{ selected }}
                                    style={({ pressed }) => [
                                        styles.weekdayBtn,
                                        {
                                            borderColor: selected
                                                ? colors.accent
                                                : colors.hair,
                                            backgroundColor: selected
                                                ? colors.accent
                                                : 'transparent',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={{
                                            fontSize: 11,
                                            fontWeight: '600',
                                            color: selected
                                                ? colors.onAccent
                                                : colors.text,
                                        }}>
                                        {opt.label}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            ) : null}

            {preset !== 'none' ? (
                <View style={styles.section}>
                    <SectionLabel label="Ends on (optional)" colors={colors} />
                    <DateField value={untilDate} onChange={setUntilDate} />
                    {untilDate ? (
                        <Pressable
                            onPress={() => setUntilDate('')}
                            accessibilityRole="button"
                            accessibilityLabel="Clear end date"
                            style={({ pressed }) => [
                                styles.clearEndChip,
                                {
                                    backgroundColor: colors.backgroundInset,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.clearEndChipText,
                                    { color: colors.text },
                                ]}>
                                Clear end date
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            {error ? (
                <ThemedText style={[styles.errorText, { color: colors.alert }]}>
                    {error}
                </ThemedText>
            ) : null}
        </SheetShell>
    );
}

function SectionLabel({
    label,
    colors,
}: {
    label: string;
    colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
}) {
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

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    rowBody: { flex: 1, minWidth: 0 },
    label: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    subLabel: {
        fontSize: 11,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    section: {
        marginTop: 14,
    },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    weekdayBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        minWidth: 44,
        alignItems: 'center',
    },
    // Clear-end chip — small secondary-style pill sitting below the
    // UNTIL DateField, same vocabulary as the EventWhenSheet "Same day"
    // affordance so chip semantics stay consistent across sheets.
    clearEndChip: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    clearEndChipText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    errorText: { fontSize: 12, marginTop: Spacing.one },
    pressed: { opacity: 0.7 },
});
