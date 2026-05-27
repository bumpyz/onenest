// ReminderSheet — TaskDetail v2 field-edit sheet for the Reminder row.
// Design source: screens-task-edit.jsx ReminderSheet (~720-778).
//
// Eight-row radio list with a primary "Save · 30 min before"-style chip.
// Per-row sub-label shows the absolute time the reminder will fire so
// users see "21:00" / "20:55" / "20:45" etc. computed off the task's
// due_at — no second mental step required to translate "30 min before"
// into a clock time.
//
// Edge: if task.due_at is null, the absolute times can't be computed and
// reminders won't fire. We surface that as a sheet-level hint rather than
// disabling the sheet — the user can still see what the offsets are even
// if they need to set a due date first.

import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { updateTask, type Task } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import {
    REMINDER_PRESETS,
    computeReminderAt,
    presetForReminderAt,
    type ReminderPreset,
} from '@/lib/task-reminders';
import { useAppColorScheme } from '@/providers/theme-provider';

import { RadioBubble } from './radio-bubble';

// Sheet-only option id space: the preset id strings from
// task-reminders.ts PLUS three synthetic ids — 'off' (no reminder) and
// 'at_due' (reminder_at = due_at). The 'custom' id is rendered as a
// disabled "Pick exact time" row for now; v2 follow-up wires it to a
// system date picker.
type OptionId = 'off' | 'at_due' | string | 'custom';

export function ReminderSheet({
    open,
    onClose,
    onSaved,
    task,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    task: Task;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Seed from the current task on open. Reverse-map reminder_at into
    // either 'off' (null), 'at_due' (== due_at), or one of the preset
    // ids. Custom values that don't match any preset and aren't 'at_due'
    // fall back to 'off' for the picker shape (the saved reminder_at
    // stays intact until the user picks a new value).
    const seedOption = (): OptionId => {
        if (!task.reminder_at) return 'off';
        if (task.due_at && task.reminder_at === task.due_at) return 'at_due';
        const preset = presetForReminderAt(task.due_at, task.reminder_at);
        return preset?.id ?? 'off';
    };
    const [selected, setSelected] = useState<OptionId>(seedOption());
    useEffect(() => {
        if (open) setSelected(seedOption());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, task.reminder_at, task.due_at]);
    const [saving, setSaving] = useState(false);

    // Build the option list with absolute-time subs. When due_at is null
    // we render the same labels but skip the absolute time sub since it
    // can't be computed; the sheet's sub-copy explains the prerequisite.
    type Option = {
        id: OptionId;
        label: string;
        sub: string;
        muted?: boolean;
    };
    const options: Option[] = (() => {
        const due = task.due_at ? parseISO(task.due_at) : null;
        const at = (offsetMin: number): string => {
            if (!due) return '—';
            const fired = new Date(due.getTime() - offsetMin * 60_000);
            return format(fired, 'HH:mm');
        };
        const opts: Option[] = [
            { id: 'off', label: 'Off', sub: 'No reminder' },
            {
                id: 'at_due',
                label: 'At due time',
                sub: due ? format(due, 'HH:mm') : 'Set a due date',
                muted: !due,
            },
        ];
        // Pull from the canonical preset list so labels match the
        // existing reminder fixtures (5/15/30/1h/2h). Skip the 'at'
        // preset — it duplicates the synthetic 'at_due' row above
        // (both render as "At due time"). The synthetic row is the
        // one we keep because it carries the muted-when-no-due-date
        // affordance ("Set a due date" sub) that the preset row can't
        // express without a special case.
        for (const preset of REMINDER_PRESETS) {
            if (preset.id === 'at') continue;
            opts.push({
                id: preset.id,
                label: preset.label,
                sub: due ? at(preset.offsetMin) : 'Set a due date',
                muted: !due,
            });
        }
        opts.push({
            id: 'custom',
            label: 'Custom…',
            sub: 'Pick exact time',
            muted: true, // wheel picker is out of scope for v2; future enhancement
        });
        return opts;
    })();

    const handleSave = async () => {
        setSaving(true);
        try {
            // Compute the new reminder_at instant from the selection.
            //   'off'    → null
            //   'at_due' → due_at (or null if no due)
            //   preset id → computeReminderAt(due, preset)
            //   'custom' → not yet supported; treat as no-op (close sheet)
            let computedReminderAt: string | null;
            if (selected === 'off') {
                computedReminderAt = null;
            } else if (selected === 'at_due') {
                computedReminderAt = task.due_at;
            } else if (selected === 'custom') {
                onClose();
                return;
            } else {
                const preset: ReminderPreset | null =
                    REMINDER_PRESETS.find((p) => p.id === selected) ?? null;
                computedReminderAt = computeReminderAt(task.due_at, preset);
            }
            // QA-001: only patch reminder_at when it actually changed.
            const changed = computedReminderAt !== task.reminder_at;
            if (!changed) {
                onClose();
                return;
            }
            await updateTask(task.id, {
                title: task.title,
                notes: task.notes ?? undefined,
                eventId: task.event_id ?? undefined,
                dueAt: task.due_at,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: task.priority,
                assigneeProfileIds: task.assignee_profile_ids,
                reminderAt: computedReminderAt,
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error('reminder save failed', err);
        } finally {
            setSaving(false);
        }
    };

    // Dynamic primary label. "Save · 30 min before" / "Save · Off".
    const primaryLabel = (() => {
        const opt = options.find((o) => o.id === selected);
        return saving ? 'Saving…' : `Save · ${opt?.label ?? 'Off'}`;
    })();

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Reminder"
            sub={
                task.due_at
                    ? 'When should we ping you?'
                    : 'Set a due date first — reminders fire as an offset before that instant.'
            }
            height={560}
            primary={primaryLabel}
            onPrimary={handleSave}
            primaryDisabled={saving}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                {options.map((o, idx) => {
                    const isSelected = selected === o.id;
                    const isLast = idx === options.length - 1;
                    return (
                        <Pressable
                            key={String(o.id)}
                            onPress={() => setSelected(o.id)}
                            disabled={o.muted && o.id !== 'off'}
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
                                o.muted && o.id !== 'off' && {
                                    opacity: 0.5,
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
