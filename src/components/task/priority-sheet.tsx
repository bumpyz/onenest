// PrioritySheet — TaskDetail v2 field-edit sheet for the Priority row.
// Design source: screens-task-edit.jsx PrioritySheet (~839-910).
//
// Five-row radio list (None / Low / Normal / High / Urgent) — each row
// has a 28×28 left tile filled with the priority's identity color, the
// label (13.5/600), a sub-label (11/inkMuted), and a trailing 20px round
// radio. Selected row gets a faint accent-tinted background.
//
// Save semantics: passes the full NewTaskInput to updateTask so all other
// fields are preserved. onSaved fires after a successful save so the parent
// can refetch and reflect the new value.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import {
    TASK_PRIORITIES,
    priorityColor,
    priorityLabel,
    prioritySubLabel,
} from '@/lib/task-format';
import { updateTask, type Task, type TaskPriority } from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';

import { RadioBubble } from './radio-bubble';
import { PriorityFlag } from './priority-flag';

export function PrioritySheet({
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

    const [selected, setSelected] = useState<TaskPriority>(task.priority);
    useEffect(() => {
        if (open) setSelected(task.priority);
    }, [open, task.priority]);
    const [saving, setSaving] = useState(false);

    const changed = selected !== task.priority;

    const handleSave = async () => {
        if (!changed) {
            onClose();
            return;
        }
        setSaving(true);
        try {
            await updateTask(task.id, {
                title: task.title,
                notes: task.notes ?? undefined,
                eventId: task.event_id ?? undefined,
                dueAt: task.due_at,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: selected,
                assigneeProfileIds: task.assignee_profile_ids,
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error('priority save failed', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Priority"
            sub="Sorts above other tasks in lists and the Today view."
            height={460}
            primary={saving ? 'Saving…' : `Save · ${priorityLabel(selected)}`}
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
                {TASK_PRIORITIES.map((p, idx) => {
                    const isSelected = selected === p;
                    const isLast = idx === TASK_PRIORITIES.length - 1;
                    const color = priorityColor(p, colors);
                    return (
                        <Pressable
                            key={p}
                            onPress={() => setSelected(p)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={priorityLabel(p)}
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
                            <View
                                style={[
                                    styles.tile,
                                    {
                                        backgroundColor: withAlpha(
                                            color,
                                            0x22 / 255,
                                        ),
                                        borderColor: withAlpha(
                                            color,
                                            0x55 / 255,
                                        ),
                                    },
                                ]}>
                                <PriorityFlag
                                    color={color}
                                    variant={p === 'none' ? 'dashed-circle' : 'flag'}
                                />
                            </View>
                            <View style={styles.rowBody}>
                                <ThemedText
                                    style={[
                                        styles.label,
                                        { color: colors.text },
                                    ]}>
                                    {priorityLabel(p)}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.subLabel,
                                        { color: colors.inkFaint },
                                    ]}>
                                    {prioritySubLabel(p)}
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

// Silence the unused FontFamily import — kept for parity with other sheet
// files that need it for mono-numerals; this sheet doesn't.
void FontFamily;

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
    tile: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowBody: { flex: 1, minWidth: 0 },
    label: {
        fontSize: 13.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    subLabel: {
        fontSize: 11,
        marginTop: 1,
        lineHeight: 15,
    },
    pressed: { opacity: 0.7 },
});
