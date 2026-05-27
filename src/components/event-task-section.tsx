// Inline task section that lives inside the event form. Owns no DB calls of its own —
// the parent passes a controlled list (LocalTask[]) and an onChange callback. The form's
// submit handler diffs the final list against the snapshot taken on mount and walks the
// DB writes (createTask / updateTask / deleteTask) after the event row exists.
//
// Why "local" tasks (with both localId and optional dbId):
//   * Stable React keys via localId (UUID generated client-side) so reordering / typing
//     doesn't reset focus on every keystroke.
//   * dbId tells the parent whether to UPDATE an existing row or INSERT a new one on save.
//   * Deletion is handled by removing from the array; the parent diffs against the
//     initial snapshot to figure out which DB rows to delete.
//
// Completing a task that's already saved fires an immediate callback so the checkbox
// doesn't have to wait for the next form save. New tasks (no dbId yet) can also be
// marked complete locally and will be created in their completed state on save.

import { format } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateField, TimeField } from '@/components/datetime-fields';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { UNASSIGNED_COLOR, colorForResponsible } from '@/lib/colors';
import type { Child, HouseholdMember, List } from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';

export type LocalTask = {
    /** Stable React key. Generated client-side for new tasks; reused across renders. */
    localId: string;
    /** DB primary key. Null for tasks created in the form that haven't been saved yet. */
    dbId: string | null;
    title: string;
    notes: string | null;
    /** ISO timestamp string. Form pre-fills with the event's start time on add. */
    dueAt: string | null;
    assigneeProfileIds: string[];
    /**
     * List ids the task belongs to. Empty array on a brand-new row means "let
     * createTask default to Inbox"; non-empty means the user has picked specific
     * list(s) from the chip strip. Preserved verbatim on edits — passing [] to
     * updateTask clears all list memberships, which folds the task into Inbox via
     * the orphan path.
     */
    listIds: string[];
    /**
     * Child ids this task is associated with. Inline tasks in the event form
     * default these to the event's currently-selected child_ids at row creation
     * (so "buy ballet shoes" inside Anna's ballet event auto-tags Anna). User
     * can toggle off per task.
     */
    childIds: string[];
    completedAt: string | null;
    completedBy: string | null;
};

/** Generates a stable client-side localId for a brand-new task. */
export function newLocalTask(initial?: Partial<LocalTask>): LocalTask {
    return {
        localId: Crypto.randomUUID(),
        dbId: null,
        title: '',
        notes: null,
        dueAt: null,
        assigneeProfileIds: [],
        listIds: [],
        childIds: [],
        completedAt: null,
        completedBy: null,
        ...initial,
    };
}

type Props = {
    /** Controlled list of tasks. Parent owns the source of truth. */
    value: LocalTask[];
    onChange: (next: LocalTask[]) => void;
    members: HouseholdMember[];
    colorMap: Map<string, string>;
    currentUserId: string;
    /**
     * Lists available to this household. Renders as a chip strip on each task row
     * so an event-linked task can be filed straight into "Groceries" + "Urgent"
     * at creation time. Empty array hides the list strip entirely (households
     * with no lists yet — shouldn't happen since every household gets an Inbox,
     * but defensive).
     */
    lists: List[];
    /** Children available to this household. Renders as a chip row per task so the
     *  user can pick which kid(s) the task is for. */
    children: Child[];
    /**
     * Default child ids applied when "+ Add a task" creates a new row. Set to the
     * event's currently-selected children so an event for Anna auto-seeds new
     * tasks with Anna toggled on. Editable per task afterward.
     */
    defaultChildIds: string[];
    /**
     * Default list ids applied when "+ Add a task" creates a new row. Set
     * to `[defaultListId]` when the user picks a To-do list above the
     * Quick tasks editor (Attach section, canvas 04.2). Empty array =
     * land in Inbox (DB trigger default). Editable per task afterward.
     */
    defaultListIds?: string[];
    /**
     * Default due_at applied when the user taps "+ Add a task" — for event-linked tasks
     * this is the event's start time. Null for standalone tasks (no default).
     */
    defaultDueAt: string | null;
    /** Hides the section entirely when true (e.g. occurrence-override mode). */
    disabled?: boolean;
    /**
     * Immediate-save hook for the complete checkbox on tasks that already have a dbId.
     * Lets the user check things off without saving the whole form. New (dbId=null)
     * tasks ignore this and just flip local state — they'll be created in their final
     * state on form save.
     */
    onCompleteImmediate?: (dbId: string, completed: boolean) => Promise<void>;
};

export function EventTaskSection({
    value,
    onChange,
    members,
    colorMap,
    currentUserId,
    lists,
    children: householdChildren,
    defaultChildIds,
    defaultListIds,
    defaultDueAt,
    disabled = false,
    onCompleteImmediate,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    if (disabled) return null;

    const addTask = () => {
        onChange([
            ...value,
            newLocalTask({
                dueAt: defaultDueAt,
                // Seed from the event's currently-selected children so the task
                // inherits the event's context (e.g. "buy ballet shoes" on Anna's
                // ballet event auto-tags Anna). User can toggle off per task.
                childIds: defaultChildIds,
                // Seed from the picked To-do list when set (canvas 04.2
                // Attach section). Empty when the user hasn't picked a
                // list — DB trigger then lands the task in Inbox.
                listIds: defaultListIds ?? [],
            }),
        ]);
    };

    const updateAt = (idx: number, patch: Partial<LocalTask>) => {
        onChange(value.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    };

    const removeAt = (idx: number) => {
        onChange(value.filter((_, i) => i !== idx));
    };

    const toggleAssignee = (idx: number, profileId: string) => {
        const t = value[idx];
        const next = t.assigneeProfileIds.includes(profileId)
            ? t.assigneeProfileIds.filter((id) => id !== profileId)
            : [...t.assigneeProfileIds, profileId];
        updateAt(idx, { assigneeProfileIds: next });
    };

    /**
     * "Anyone" is a select-all shortcut. Clicking it when not all members are selected
     * assigns the task to every parent; clicking it when everyone's already on assigns
     * it to nobody (empty list, which the digest still treats as "anyone can do it").
     * Stays visible even with parents selected so users can quickly flip back to a
     * shared task without un-clicking each chip individually.
     */
    const toggleAnyone = (idx: number) => {
        const t = value[idx];
        const allIds = members.map((m) => m.profile_id);
        const allSelected =
            allIds.length > 0 &&
            allIds.every((id) => t.assigneeProfileIds.includes(id));
        updateAt(idx, { assigneeProfileIds: allSelected ? [] : allIds });
    };

    /** Multi-select toggle for a list chip on a task row. Mirrors toggleAssignee. */
    const toggleList = (idx: number, listId: string) => {
        const t = value[idx];
        const next = t.listIds.includes(listId)
            ? t.listIds.filter((id) => id !== listId)
            : [...t.listIds, listId];
        updateAt(idx, { listIds: next });
    };

    /** Multi-select toggle for a child chip on a task row. Same shape as the
     *  list / assignee toggles — small set so DELETE-and-replace works fine. */
    const toggleChild = (idx: number, childId: string) => {
        const t = value[idx];
        const next = t.childIds.includes(childId)
            ? t.childIds.filter((id) => id !== childId)
            : [...t.childIds, childId];
        updateAt(idx, { childIds: next });
    };

    /**
     * Combines the date + time strings from the two pickers into an ISO due_at. If
     * either picker is blank, we keep the other and synthesize a sane companion (today
     * for date, noon for time) so the user never lands in a "partially set" no-op state.
     * Invalid combinations silently ignore so a half-typed time doesn't blow up the row.
     */
    const setDue = (idx: number, dateStr: string, timeStr: string) => {
        const datePart = dateStr || format(new Date(), 'yyyy-MM-dd');
        const timePart = timeStr || '12:00';
        const combined = new Date(`${datePart}T${timePart}`);
        if (Number.isNaN(combined.getTime())) return;
        updateAt(idx, { dueAt: combined.toISOString() });
    };

    const toggleComplete = async (idx: number) => {
        const t = value[idx];
        const completing = !t.completedAt;
        const nowIso = new Date().toISOString();
        // Optimistic local update so the checkbox flips instantly.
        updateAt(idx, {
            completedAt: completing ? nowIso : null,
            completedBy: completing ? currentUserId : null,
        });
        // For persisted rows, also fire the immediate DB write. New rows (no dbId) just
        // stay in local state — they'll be created with the right completed state on save.
        if (t.dbId && onCompleteImmediate) {
            try {
                await onCompleteImmediate(t.dbId, completing);
            } catch (err) {
                // Roll back the optimistic flip on failure.
                console.error('toggleComplete failed', err);
                updateAt(idx, {
                    completedAt: completing ? null : nowIso,
                    completedBy: completing ? null : currentUserId,
                });
            }
        }
    };

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.two,
        paddingVertical: Spacing.one,
        fontSize: 14,
        flex: 1,
    };

    return (
        <View style={styles.field}>
            <ThemedText type="smallBold">Tasks (optional)</ThemedText>
            {value.length > 0 ? (
                <ThemedText themeColor="textSecondary" type="small">
                    Each task can be assigned to a parent. Defaults to the event time —
                    edit later from the Lists tab to change due time.
                </ThemedText>
            ) : null}

            {value.map((task, idx) => {
                const done = !!task.completedAt;
                return (
                    <View
                        key={task.localId}
                        style={[
                            styles.taskRow,
                            {
                                borderColor: colors.backgroundSelected,
                                backgroundColor: done
                                    ? colors.backgroundElement
                                    : 'transparent',
                            },
                        ]}>
                        <View style={styles.taskTitleRow}>
                            <Pressable
                                onPress={() => toggleComplete(idx)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: done }}
                                accessibilityLabel={
                                    done
                                        ? 'Mark task incomplete'
                                        : 'Mark task complete'
                                }
                                style={({ pressed }) => [
                                    styles.checkbox,
                                    {
                                        backgroundColor: done
                                            ? colors.accent
                                            : 'transparent',
                                        borderColor: done
                                            ? colors.accent
                                            : colors.backgroundSelected,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                {done ? (
                                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                                ) : null}
                            </Pressable>
                            <TextInput
                                value={task.title}
                                onChangeText={(t) => updateAt(idx, { title: t })}
                                placeholder="Task title"
                                placeholderTextColor={colors.textSecondary}
                                style={[
                                    inputStyle,
                                    done && {
                                        textDecorationLine: 'line-through',
                                        color: colors.textSecondary,
                                    },
                                ]}
                            />
                            <Pressable
                                onPress={() => removeAt(idx)}
                                accessibilityRole="button"
                                accessibilityLabel="Remove task"
                                style={({ pressed }) => [
                                    styles.removeBtn,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{ color: BrandColors.error, fontWeight: '600' }}>
                                    ✕
                                </ThemedText>
                            </Pressable>
                        </View>

                        <View style={styles.assignRow}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Assigned to:
                            </ThemedText>
                            {/* "Anyone" stays visible alongside the parent chips as a
                                select-all toggle. Highlighted when every member is on the
                                list; clicking again clears the list. */}
                            {(() => {
                                const allIds = members.map((m) => m.profile_id);
                                const anyoneActive =
                                    allIds.length > 0 &&
                                    allIds.every((id) =>
                                        task.assigneeProfileIds.includes(id),
                                    );
                                return (
                                    <Pressable
                                        onPress={() => toggleAnyone(idx)}
                                        style={({ pressed }) => [
                                            styles.assignChip,
                                            {
                                                borderColor: UNASSIGNED_COLOR,
                                                backgroundColor: anyoneActive
                                                    ? UNASSIGNED_COLOR
                                                    : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                // Full-contrast text in the unselected
                                                // state so the chip doesn't read as
                                                // disabled (UX-011). The border + fill
                                                // already carry the selection signal.
                                                color: anyoneActive
                                                    ? '#fff'
                                                    : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            Anyone
                                        </ThemedText>
                                    </Pressable>
                                );
                            })()}
                            {members.map((m) => {
                                const color = colorForResponsible(m.profile_id, colorMap);
                                const selected = task.assigneeProfileIds.includes(
                                    m.profile_id,
                                );
                                const label =
                                    currentUserId === m.profile_id ? 'Me' : m.display_name;
                                return (
                                    <Pressable
                                        key={m.profile_id}
                                        onPress={() => toggleAssignee(idx, m.profile_id)}
                                        style={({ pressed }) => [
                                            styles.assignChip,
                                            {
                                                borderColor: color,
                                                backgroundColor: selected
                                                    ? color
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

                        {/* List multi-select. A task can sit in any number of lists
                            (e.g. "Buy cake" in both Urgent and Groceries). Empty
                            selection at save time falls through to Inbox via the
                            createTask default. Hidden when the household has no lists
                            — defensive, since every household auto-gets an Inbox. */}
                        {lists.length > 0 ? (
                            <View style={styles.assignRow}>
                                <ThemedText themeColor="textSecondary" type="small">
                                    Lists:
                                </ThemedText>
                                {lists.map((l) => {
                                    const selected = task.listIds.includes(l.id);
                                    return (
                                        <Pressable
                                            key={l.id}
                                            onPress={() => toggleList(idx, l.id)}
                                            style={({ pressed }) => [
                                                styles.assignChip,
                                                {
                                                    borderColor: l.color,
                                                    backgroundColor: selected
                                                        ? l.color
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected
                                                        ? colors.accent
                                                        : colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {l.name}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : null}

                        {/* Children multi-select. Each chip shows the child's color
                            badge so the picker is visually consistent with the event
                            form's child row. Hidden when the household has no kids. */}
                        {householdChildren.length > 0 ? (
                            <View style={styles.assignRow}>
                                <ThemedText themeColor="textSecondary" type="small">
                                    Children:
                                </ThemedText>
                                {householdChildren.map((c) => {
                                    const selected = task.childIds.includes(c.id);
                                    return (
                                        <Pressable
                                            key={c.id}
                                            onPress={() => toggleChild(idx, c.id)}
                                            style={({ pressed }) => [
                                                styles.assignChip,
                                                {
                                                    borderColor: c.color,
                                                    backgroundColor: selected
                                                        ? c.color
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            {/* The chip's colored border + selected-state
                                                background already convey "this is {child}'s
                                                color" — duplicating the avatar badge alongside
                                                the full name made the chip read as "circle +
                                                first letter + full name in a bigger button",
                                                which looked broken. Keep the spelled-out name
                                                only.
                                                UX-035: in the unselected state, an 8pt color
                                                dot before the name restores the at-a-glance
                                                child-identity signal that a 1pt border alone
                                                under-communicates (parents + lists + children
                                                chips can stack on the same task row). The
                                                selected state already paints the chip the
                                                child's color so the dot would be redundant. */}
                                            {!selected ? (
                                                <View
                                                    style={[
                                                        styles.childIdentityDot,
                                                        { backgroundColor: c.color },
                                                    ]}
                                                />
                                            ) : null}
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected
                                                        ? colors.textOnPastel
                                                        : colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {c.display_name}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : null}

                        {/* Due date + time. Pre-filled with the event's start at row
                            creation (defaultDueAt in props), editable here. We keep
                            both pickers always visible so the user sees what they're
                            actually saving — silently inheriting was confusing. */}
                        <View style={styles.dueRow}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Due:
                            </ThemedText>
                            <View style={styles.duePickers}>
                                <DateField
                                    value={
                                        task.dueAt
                                            ? format(new Date(task.dueAt), 'yyyy-MM-dd')
                                            : ''
                                    }
                                    onChange={(d) =>
                                        setDue(
                                            idx,
                                            d,
                                            task.dueAt
                                                ? format(new Date(task.dueAt), 'HH:mm')
                                                : '',
                                        )
                                    }
                                />
                                <TimeField
                                    value={
                                        task.dueAt
                                            ? format(new Date(task.dueAt), 'HH:mm')
                                            : ''
                                    }
                                    onChange={(t) =>
                                        setDue(
                                            idx,
                                            task.dueAt
                                                ? format(
                                                      new Date(task.dueAt),
                                                      'yyyy-MM-dd',
                                                  )
                                                : '',
                                            t,
                                        )
                                    }
                                />
                            </View>
                        </View>
                    </View>
                );
            })}

            <Pressable
                onPress={addTask}
                style={({ pressed }) => [
                    styles.addBtn,
                    { borderColor: colors.backgroundSelected },
                    pressed && styles.pressed,
                ]}>
                <ThemedText type="small" style={{ color: colors.accent, fontWeight: '600' }}>
                    + Add a task
                </ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    field: { gap: Spacing.two },
    taskRow: {
        gap: Spacing.two,
        padding: Spacing.two,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    taskTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
    removeBtn: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assignRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Spacing.one,
    },
    assignChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.two,
        paddingVertical: 2,
        // UX-035: children chip becomes a row so the identity dot sits inline
        // before the name. Existing parent / list chips don't render the dot,
        // so the flexDirection here is a no-op for them.
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    childIdentityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        flexWrap: 'wrap',
    },
    duePickers: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        flex: 1,
    },
    addBtn: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    pressed: { opacity: 0.7 },
});
