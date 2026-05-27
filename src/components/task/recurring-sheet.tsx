// RecurringSheet — TaskDetail v2 field-edit sheet for the Recurring row.
// Design source: screens-task-edit.jsx RecurringSheet (~780-837).
//
// Seven-row radio list. Task-level recurrence isn't in the schema yet
// (only events have a recurrence_rule column), so non-"One-time" options
// surface a "coming soon" hint on save and bail without mutating the
// task. Renders the full picker so the design's affordance shape is
// preserved without lying about behavior.
//
// When task recurrence lands, the save handler swaps out the "coming
// soon" alert for an updateTask call that writes the rule into a new
// `recurrence_rule` column on tasks.

import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { type Task } from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';

import { RadioBubble } from './radio-bubble';

type RecurrenceOptionId =
    | 'one-time'
    | 'daily'
    | 'weekdays'
    | 'weekly'
    | 'bi-weekly'
    | 'monthly'
    | 'custom';

const OPTIONS: Array<{
    id: RecurrenceOptionId;
    label: string;
    sub: string;
}> = [
    { id: 'one-time', label: 'One-time', sub: 'No repeat' },
    { id: 'daily', label: 'Daily', sub: 'Every day' },
    { id: 'weekdays', label: 'Weekdays', sub: 'Mon–Fri' },
    { id: 'weekly', label: 'Weekly', sub: 'Every Wed' },
    {
        id: 'bi-weekly',
        label: 'Bi-weekly',
        sub: 'Every other Wed · matches custody',
    },
    { id: 'monthly', label: 'Monthly', sub: 'On the 27th' },
    { id: 'custom', label: 'Custom…', sub: 'Pick days, interval, end' },
];

export function RecurringSheet({
    open,
    onClose,
    onSaved,
    task,
}: {
    open: boolean;
    onClose: () => void;
    /** Wired for parity with sibling sheets — won't fire until task
     *  recurrence lands in the schema. */
    onSaved: () => void;
    task: Task;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [selected, setSelected] = useState<RecurrenceOptionId>('one-time');
    useEffect(() => {
        if (open) setSelected('one-time');
    }, [open]);
    void task;
    void onSaved;

    const handleSave = () => {
        if (selected === 'one-time') {
            onClose();
            return;
        }
        // Backend deferred — surface honest "coming soon" and bail.
        const msg =
            'Recurring tasks are coming soon — task scheduling will land in a future update. Saved as one-time for now.';
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') window.alert(msg);
        } else {
            Alert.alert('Recurring tasks', msg);
        }
        onClose();
    };

    const selectedOption = OPTIONS.find((o) => o.id === selected);

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Repeats"
            sub="The new instance inherits notes, lists, and priority."
            height={560}
            primary={`Save · ${selectedOption?.label ?? 'One-time'}`}
            onPrimary={handleSave}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                {OPTIONS.map((o, idx) => {
                    const isSelected = selected === o.id;
                    const isLast = idx === OPTIONS.length - 1;
                    return (
                        <Pressable
                            key={o.id}
                            onPress={() => setSelected(o.id)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={o.label}
                            style={({ pressed }) => [
                                styles.row,
                                !isLast && {
                                    borderBottomColor: colors.hair,
                                    borderBottomWidth:
                                        StyleSheet.hairlineWidth,
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
                                    {o.label}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.subLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {o.sub}
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
    pressed: { opacity: 0.7 },
});
