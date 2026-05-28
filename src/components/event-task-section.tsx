// Inline task section that lives inside the event form. Owns no DB calls of its own —
// the parent passes a controlled list (LocalTask[]) and an onChange callback. The form's
// submit handler diffs the final list against the snapshot taken on mount and walks the
// DB writes (createTask / updateTask / deleteTask) after the event row exists.
//
// Visual vocabulary matches the rest of EventForm: FormGroup flush card with
// hairline-divided task blocks. Inside each block, sub-rows use the mono-caps
// label + chip-row pattern from the WHO section (PersonChip for parents and
// children, AnyoneChip for the select-all, ListTagChip for list membership).
// The Due picker is a FormRow chevron → DateTimePickerSheet — same vocabulary
// as the WHEN section's Starts/Ends rows. The "+ Add a task" affordance is a
// FormRow at the bottom of the card.
//
// (Both the date and time portions of the Due picker now ride through
// DateTimePickerSheet's in-app modal UI — MiniCalendar for the date,
// and the custom hour/minute stepper for the time, both on web and on
// native. Task #502 closed.)
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

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
    AnyoneChip,
    DateTimePickerSheet,
    FormGroup,
    FormRow,
    ListTagChip,
    PersonChip,
} from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Typography } from '@/constants/theme';
import { colorForResponsible } from '@/lib/colors';
import { firstNameOf } from '@/lib/names';
import type { Child, HouseholdMember, List } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
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

/**
 * Formats a task's due ISO string for the FormRow value slot. Renders as
 * "Tue May 26 · 16:00", collapsing to "Pick a date" when unset. Matches
 * the WHEN section's formatWhenRow vocabulary exactly so the inline tasks
 * read at the same density as the event's own Starts/Ends rows.
 */
function formatDueRow(iso: string | null): string {
    if (!iso) return 'Pick a date';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Pick a date';
    const datePart = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const timePart = format(d, 'HH:mm');
    return `${datePart} · ${timePart}`;
}

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

    // Tracks which task's Due picker is currently open. -1 = closed.
    // Using an index lets a single DateTimePickerSheet handle every row's
    // due edits (sheets are mutex on screen anyway — only one open at a time).
    const [duePickerIdx, setDuePickerIdx] = useState<number>(-1);

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
        // Close the shared Due picker if it was open on the removed
        // row (would point at a stale / undefined slot otherwise); and
        // shift it down by one if it was open on a later row whose
        // index just decremented.
        if (duePickerIdx === idx) setDuePickerIdx(-1);
        else if (duePickerIdx > idx) setDuePickerIdx((i) => i - 1);
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
     * Combines the date + time strings from the picker sheet into an ISO due_at. If
     * either piece is blank, we keep the other and synthesize a sane companion (today
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

    const allAssigneeIds = members.map((m) => m.profile_id);

    return (
        <View style={styles.section}>
            {value.length > 0 ? (
                <FormGroup flush>
                    {value.map((task, idx) => {
                        const done = !!task.completedAt;
                        const isLast = idx === value.length - 1;
                        const anyoneActive =
                            allAssigneeIds.length > 0 &&
                            allAssigneeIds.every((id) =>
                                task.assigneeProfileIds.includes(id),
                            );
                        return (
                            <View
                                key={task.localId}
                                style={[
                                    styles.taskBlock,
                                    !isLast && {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                {/* Title row — 28px checkbox + flex title input
                                    + remove glyph. Matches the form's
                                    whoSubBlock 14/12 padding rhythm so titles
                                    line up vertically with every FormRow label
                                    and mono caps sub-label elsewhere. */}
                                <View style={styles.titleRow}>
                                    <Pressable
                                        onPress={() => toggleComplete(idx)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: done }}
                                        accessibilityLabel={
                                            done
                                                ? 'Mark task incomplete'
                                                : 'Mark task complete'
                                        }
                                        hitSlop={6}
                                        style={({ pressed }) => [
                                            styles.checkbox,
                                            {
                                                backgroundColor: done
                                                    ? colors.accent
                                                    : 'transparent',
                                                borderColor: done
                                                    ? colors.accent
                                                    : colors.hair,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        {done ? (
                                            <Feather
                                                name="check"
                                                size={12}
                                                color={colors.onAccent}
                                            />
                                        ) : null}
                                    </Pressable>
                                    <TextInput
                                        value={task.title}
                                        onChangeText={(t) =>
                                            updateAt(idx, { title: t })
                                        }
                                        placeholder="Task title"
                                        placeholderTextColor={colors.inkFaint}
                                        autoComplete="off"
                                        style={[
                                            styles.titleInput,
                                            {
                                                color: done
                                                    ? colors.inkFaint
                                                    : colors.text,
                                                fontFamily:
                                                    FontFamily.sansRegular,
                                                textDecorationLine: done
                                                    ? 'line-through'
                                                    : 'none',
                                            },
                                            Platform.OS === 'web'
                                                ? ({
                                                      outlineStyle: 'none',
                                                  } as object)
                                                : null,
                                        ]}
                                    />
                                    <Pressable
                                        onPress={() => removeAt(idx)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Remove task"
                                        hitSlop={6}
                                        style={({ pressed }) => [
                                            styles.removeBtn,
                                            pressed && styles.pressed,
                                        ]}>
                                        <Feather
                                            name="x"
                                            size={14}
                                            color={colors.inkFaint}
                                        />
                                    </Pressable>
                                </View>

                                {/* ASSIGNED TO — mono caps sub-label + chip
                                    row. Same vocabulary as the form's
                                    RESPONSIBLE block: AnyoneChip for the
                                    select-all toggle, PersonChip per member
                                    with their identity color. */}
                                <View style={styles.metaSubBlock}>
                                    <ThemedText
                                        style={[
                                            styles.metaLabel,
                                            { color: colors.textSecondary },
                                        ]}>
                                        ASSIGNED TO
                                    </ThemedText>
                                    <View style={styles.chipRow}>
                                        <AnyoneChip
                                            selected={anyoneActive}
                                            onPress={() => toggleAnyone(idx)}
                                        />
                                        {members.map((m) => {
                                            const color = colorForResponsible(
                                                m.profile_id,
                                                colorMap,
                                            );
                                            const selected =
                                                task.assigneeProfileIds.includes(
                                                    m.profile_id,
                                                );
                                            // First name across all chips
                                            // per design convention; drops
                                            // legacy "Me" self-label.
                                            const label = firstNameOf(
                                                m.display_name,
                                            );
                                            return (
                                                <PersonChip
                                                    key={m.profile_id}
                                                    name={label}
                                                    color={color}
                                                    selected={selected}
                                                    onPress={() =>
                                                        toggleAssignee(
                                                            idx,
                                                            m.profile_id,
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* CHILDREN — same shape as the form's FOR
                                    CHILD(REN) sub-block. Hidden when the
                                    household has no kids. */}
                                {householdChildren.length > 0 ? (
                                    <View style={styles.metaSubBlock}>
                                        <ThemedText
                                            style={[
                                                styles.metaLabel,
                                                { color: colors.textSecondary },
                                            ]}>
                                            FOR CHILD(REN)
                                        </ThemedText>
                                        <View style={styles.chipRow}>
                                            {householdChildren.map((c) => {
                                                const selected =
                                                    task.childIds.includes(c.id);
                                                return (
                                                    <PersonChip
                                                        key={c.id}
                                                        name={c.display_name}
                                                        color={c.color}
                                                        selected={selected}
                                                        onPress={() =>
                                                            toggleChild(idx, c.id)
                                                        }
                                                    />
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                                {/* LISTS — ListTagChip (color dot + label +
                                    check) — the canonical ds primitive for
                                    "task is in these lists" picking. Hidden
                                    when household has no lists (defensive;
                                    Inbox always exists). */}
                                {lists.length > 0 ? (
                                    <View style={styles.metaSubBlock}>
                                        <ThemedText
                                            style={[
                                                styles.metaLabel,
                                                { color: colors.textSecondary },
                                            ]}>
                                            IN LISTS
                                        </ThemedText>
                                        <View style={styles.chipRow}>
                                            {lists.map((l) => {
                                                const selected =
                                                    task.listIds.includes(l.id);
                                                return (
                                                    <ListTagChip
                                                        key={l.id}
                                                        color={l.color}
                                                        label={l.name}
                                                        selected={selected}
                                                        onPress={() =>
                                                            toggleList(idx, l.id)
                                                        }
                                                    />
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                                {/* DUE — FormRow chevron → DateTimePickerSheet.
                                    Same shape as the WHEN section's
                                    Starts/Ends rows so inline-task editing
                                    reads at the same density as the event
                                    itself. */}
                                <FormRow
                                    label="Due"
                                    value={formatDueRow(task.dueAt)}
                                    muted={!task.dueAt}
                                    chevron
                                    onPress={() => setDuePickerIdx(idx)}
                                    last
                                />
                            </View>
                        );
                    })}
                </FormGroup>
            ) : null}

            {/* "+ Add a task" — dashed-add affordance below the card. Sits
                outside the FormGroup so it doesn't read as a task row
                itself; mono caps "ADD A TASK" copy matches the dashed-add
                pattern used elsewhere in v2 (custody preset chips, list
                cards). */}
            <Pressable
                onPress={addTask}
                accessibilityRole="button"
                accessibilityLabel="Add a task"
                style={({ pressed }) => [
                    styles.addRow,
                    {
                        borderColor: withAlpha(colors.accent, 0x66 / 255),
                        backgroundColor: withAlpha(colors.accent, 0x08 / 255),
                    },
                    pressed && styles.pressed,
                ]}>
                <Feather name="plus" size={14} color={colors.accent} />
                <ThemedText
                    style={[
                        styles.addRowText,
                        {
                            color: colors.accent,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    ADD A TASK
                </ThemedText>
            </Pressable>

            {/* Single DateTimePickerSheet drives every row's due edits.
                duePickerIdx === -1 closes the sheet; a real index opens it
                pre-seeded with that task's current due (or empty strings
                so the sheet defaults to today / noon). */}
            <DateTimePickerSheet
                open={duePickerIdx >= 0}
                title="Due"
                initialDate={
                    duePickerIdx >= 0 && value[duePickerIdx]?.dueAt
                        ? format(new Date(value[duePickerIdx].dueAt!), 'yyyy-MM-dd')
                        : ''
                }
                initialTime={
                    duePickerIdx >= 0 && value[duePickerIdx]?.dueAt
                        ? format(new Date(value[duePickerIdx].dueAt!), 'HH:mm')
                        : ''
                }
                onSave={({ date, time }) => {
                    if (duePickerIdx >= 0) setDue(duePickerIdx, date, time);
                    setDuePickerIdx(-1);
                }}
                onClose={() => setDuePickerIdx(-1)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: 8 },
    // Each task occupies its own block inside the flush FormGroup card,
    // with a bottom hairline divider between siblings (suppressed on the
    // last row — the FormGroup's own bottom edge closes it). 14/12 outer
    // padding matches the form's whoSubBlock so chip leading edges line
    // up with every other section's mono caps + chip vocabulary.
    taskBlock: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
    },
    // Title row sits inside the task block. 10px gap between checkbox,
    // input, and remove glyph. The input flex:1's so it fills the row;
    // the checkbox and remove buttons are fixed-width.
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    // 22px square checkbox with hairline border / accent fill when done.
    // Slightly larger than a chip's avatar so it reads as a control rather
    // than a decoration.
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Task title input — flex-fills the row. Padding 0 vertical because
    // the parent titleRow already provides the vertical rhythm; matches
    // the notes textarea / search bar input pattern where the wrapper
    // handles padding.
    titleInput: {
        flex: 1,
        fontSize: 14,
        letterSpacing: -0.2,
        paddingVertical: 0,
    },
    // Remove (X) glyph button — 24x24 hit area, no border/bg; the icon
    // alone reads as an inline action. hitSlop on the Pressable provides
    // the larger tap target.
    removeBtn: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Mono caps sub-block — label above, chip row below. Matches the
    // form's whoSubBlock pattern (label monoSemiBold 10/600 with 0.4
    // letter-spacing, 2px gap to chips). gap 6 keeps the cluster tight.
    metaSubBlock: {
        gap: 6,
    },
    // ASSIGNED TO / FOR CHILD(REN) / IN LISTS sub-labels — pulls
    // typography from Typography.monoCaps so every form-internal caps
    // sub-label across the app stays in sync (matches event-form's
    // fieldMonoLabel + DateTimePickerSheet's label).
    metaLabel: Typography.monoCaps,
    // Chip row — matches the form's chipRow style (flex-wrap row with
    // 6px gap between chips). PersonChip / AnyoneChip / ListTagChip all
    // render at consistent heights so the row stays even.
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    // "+ ADD A TASK" affordance. Dashed-accent border + faint accent fill
    // so it reads as a "tap me to create" affordance. Mono caps label
    // matches the dashed-add vocabulary used elsewhere in v2 (custody
    // preset chips, list cards trailing slot).
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    addRowText: {
        fontSize: 11,
        letterSpacing: 0.4,
    },
    pressed: { opacity: 0.7 },
});
