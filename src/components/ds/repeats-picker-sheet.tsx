// RepeatsPickerSheet — recurrence picker for EventCreate's "Repeats"
// FormRow. Mirrors the EventRecurrenceSheet shape (radio row list +
// weekday chips + UNTIL date) but in stateless "draft" mode for the
// create flow (no Event row exists yet).
//
// Tapping the FormRow in EventForm opens this sheet. Picking a row
// stages the new RRULE; Save commits via onSave. The caller is
// responsible for persisting the rule into the event on form save.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/datetime-fields';
import { RadioBubble } from '@/components/task/radio-bubble';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import {
    WEEKDAY_OPTIONS,
    buildRRule,
    parseRecurrence,
    type RecurrencePresetId,
    type WeekdayCode,
} from '@/lib/recurrence';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

import { SheetShell } from './sheet-shell';

type Props = {
    open: boolean;
    /** Current RRULE string (null = no repeat). */
    value: string | null;
    /** The event's start date as YYYY-MM-DD — used to seed the
     *  recurrence anchor weekday when the user picks Custom. */
    startDate: string;
    onSave: (rule: string | null) => void;
    onClose: () => void;
};

const ROW_ORDER: RecurrencePresetId[] = [
    'none',
    'daily',
    'weekly',
    'weekdays',
    'monthly',
    'custom',
];

const ROW_LABELS: Record<RecurrencePresetId, string> = {
    none: 'Does not repeat',
    daily: 'Daily',
    weekly: 'Weekly',
    weekdays: 'Every weekday',
    monthly: 'Monthly',
    custom: 'Custom',
};

// Mirror lib/recurrence's internal day-of-week lookup so we don't need
// to export it. ISO week order from getDay() (0 = Sun).
const WEEKDAY_BY_GETDAY: readonly WeekdayCode[] = [
    'SU',
    'MO',
    'TU',
    'WE',
    'TH',
    'FR',
    'SA',
];

function parseYmd(s: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function RepeatsPickerSheet({
    open,
    value,
    startDate,
    onSave,
    onClose,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [preset, setPreset] = useState<RecurrencePresetId>('none');
    const [customDays, setCustomDays] = useState<Set<WeekdayCode>>(new Set());
    const [untilDate, setUntilDate] = useState('');

    useEffect(() => {
        if (!open) return;
        const parsed = parseRecurrence(value);
        setPreset(parsed.preset);
        setCustomDays(new Set(parsed.byday));
        setUntilDate(parsed.until ?? '');
    }, [open, value]);

    const handleSelect = (id: RecurrencePresetId) => {
        setPreset(id);
        if (id === 'custom' && customDays.size === 0) {
            const dow = parseYmd(startDate).getDay();
            setCustomDays(new Set([WEEKDAY_BY_GETDAY[dow]]));
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

    const handleSave = () => {
        const until = untilDate.trim() || null;
        let rule: string | null;
        if (preset === 'custom') {
            rule =
                customDays.size === 0
                    ? null
                    : buildRRule('custom', Array.from(customDays), until);
        } else {
            rule = buildRRule(preset, undefined, until);
        }
        onSave(rule);
    };

    const saveDisabled = preset === 'custom' && customDays.size === 0;

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Repeats"
            sub="The selected rule applies to every future occurrence."
            primary={`Save · ${ROW_LABELS[preset]}`}
            secondary="Cancel"
            onPrimary={handleSave}
            onSecondary={onClose}
            primaryDisabled={saveDisabled}
            height={preset === 'custom' ? 640 : 580}>
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
                            onPress={() => handleSelect(id)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={ROW_LABELS[id]}
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
                            <ThemedText
                                style={[
                                    styles.rowLabel,
                                    { color: colors.text },
                                ]}>
                                {ROW_LABELS[id]}
                            </ThemedText>
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
                    <ThemedText
                        style={[
                            styles.sectionLabel,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        ON THESE DAYS
                    </ThemedText>
                    <View style={styles.weekdayRow}>
                        {WEEKDAY_OPTIONS.map((opt) => {
                            const selected = customDays.has(opt.code);
                            return (
                                <Pressable
                                    key={opt.code}
                                    onPress={() => toggleDay(opt.code)}
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
                    <ThemedText
                        style={[
                            styles.sectionLabel,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        ENDS ON (OPTIONAL)
                    </ThemedText>
                    <DateField value={untilDate} onChange={setUntilDate} />
                </View>
            ) : null}
        </SheetShell>
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
    rowLabel: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    section: { marginTop: 14, gap: 8 },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
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
    pressed: { opacity: 0.7 },
});
