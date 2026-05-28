// TaskDetail v2 — Phase 11 task detail screen with the bottom-sheet edit
// pattern. Design source: screens-task-edit.jsx TaskDetailV2 (~133-331).
//
// Major shape vs the prior implementation (#367/#368):
//   • /task/[id]/edit is gone — every field opens a focused bottom sheet
//     instead of routing to a catch-all form.
//   • Title is inline-editable on tap (TextInput in place; no pencil icon).
//   • Notes block is inline-editable on tap, with a mono TAP TO EDIT badge
//     in the top-right of the read state.
//   • New Priority row in Details (5th row) opens PrioritySheet.
//   • New "For · N" SGroup always renders kid chips + "+ Edit"; tap any
//     chip or +Edit opens ChildrenSheet.
//   • In lists "+ Add" became "+ Edit"; chips are display-only and tapping
//     any chip OR +Edit opens ListsSheet.
//   • Top-bar kebab opens TaskOverflowSheet (Share/Duplicate/Convert/Move/
//     Pin/Archive/Export/Delete) — replaces the previous Alert.alert action
//     menu.
//
// Layout, top to bottom:
//   1. Top bar — back chevron + "TASK" mono pretitle + ••• kebab
//   2. Hero — checkbox + title (read/edit) + status pills + mono hint
//   3. Details SGroup — Assigned / Due / Reminder / Recurring / Priority
//   4. For · N SGroup — kid chips + "+ Edit" (only if children exist)
//   5. Linked event SGroup — when task.event_id is set
//   6. In lists SGroup — chips + "+ Edit" (always shown when lists exist)
//   7. Notes SGroup — always; tap to edit
//   8. History SGroup — created / completed rows
//   9. Sticky bar — Snooze + Mark done/Reopen
//
// Caregivers see read-only: no kebab, no sheet triggers, no Snooze.

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { LoadingScreen } from '@/components/loading-screen';
import { SGroup, SRow, StatusPill } from '@/components/ds';
import { AssigneePickerSheet } from '@/components/task/assignee-picker-sheet';
import { ChildrenSheet } from '@/components/task/children-sheet';
import { DuePickerSheet } from '@/components/task/due-picker-sheet';
import { ListsSheet } from '@/components/task/lists-sheet';
import { PrioritySheet } from '@/components/task/priority-sheet';
import { ReminderSheet } from '@/components/task/reminder-picker-sheet';
import { TaskOverflowSheet } from '@/components/task/task-overflow-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useEvent } from '@/hooks/use-event';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholdTasks } from '@/hooks/use-household-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useMyRole } from '@/hooks/use-my-role';
import { useTask } from '@/hooks/use-task';
import {
    colorForResponsible,
    memberColorMap,
} from '@/lib/colors';
import { setTaskCompleted, updateTask } from '@/lib/db';
import { firstNameOf } from '@/lib/names';
import { errorMessage } from '@/lib/errors';
import { withAlpha } from '@/lib/platform-styles';
import {
    dueStatusPill,
    formatDueLabel,
    priorityColor,
    priorityLabel,
    priorityPill,
} from '@/lib/task-format';
import { presetForReminderAt } from '@/lib/task-reminders';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function TaskDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    const { lists, isLoading: listsLoading } = useLists(household?.id);
    const { children, isLoading: childrenLoading } = useChildren(
        household?.id,
    );
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const { task, isLoading: taskLoading, refetch: refetchTask } =
        useTask(id);
    const { event: linkedEvent } = useEvent(task?.event_id ?? undefined);
    // Open-task counts per list for the ListsSheet's `N tasks` sub copy.
    // Computed lazily — only needed when the sheet opens, but pulling the
    // hook here keeps the data available across opens without re-fetching.
    const { tasks: householdTasks } = useHouseholdTasks(household?.id);

    // Per-row sheet open state — one boolean per field.
    const [assigneeSheetOpen, setAssigneeSheetOpen] = useState(false);
    const [dueSheetOpen, setDueSheetOpen] = useState(false);
    const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
    const [prioritySheetOpen, setPrioritySheetOpen] = useState(false);
    const [listsSheetOpen, setListsSheetOpen] = useState(false);
    const [childrenSheetOpen, setChildrenSheetOpen] = useState(false);
    const [overflowSheetOpen, setOverflowSheetOpen] = useState(false);

    // Inline edit state — when active, the corresponding read element is
    // replaced with a TextInput. Persisted as draft strings so the user
    // can edit freely without round-tripping every keystroke.
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [savingInline, setSavingInline] = useState(false);

    useFocusEffect(
        useCallback(() => {
            refetchTask();
        }, [refetchTask]),
    );

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        listsLoading ||
        childrenLoading ||
        taskLoading ||
        roleLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (!task) return <Redirect href="/lists" />;

    const colorMap = memberColorMap(members);
    const done = !!task.completed_at;
    const statusPill = dueStatusPill(task, colors);
    const priorityPillSpec = priorityPill(task.priority, colors);
    const reminderPreset = presetForReminderAt(task.due_at, task.reminder_at);

    const assignees = task.assignee_profile_ids
        .map((pid) => (members ?? []).find((m) => m.profile_id === pid))
        .filter((m): m is NonNullable<typeof m> => !!m);
    const taskChildren = task.child_ids
        .map((cid) => (children ?? []).find((c) => c.id === cid))
        .filter((c): c is NonNullable<typeof c> => !!c);
    const taskLists = task.list_ids
        .map((lid) => (lists ?? []).find((l) => l.id === lid))
        .filter((l): l is NonNullable<typeof l> => !!l);

    // Open-task count map for ListsSheet. Built once from householdTasks.
    const listTaskCounts = (() => {
        const map = new Map<string, number>();
        if (!householdTasks) return map;
        for (const t of householdTasks) {
            if (t.completed_at) continue;
            for (const lid of t.list_ids) {
                map.set(lid, (map.get(lid) ?? 0) + 1);
            }
        }
        return map;
    })();

    // ─── Inline edit handlers ──────────────────────────────────────────

    const startTitleEdit = () => {
        if (isCaregiver) return;
        setTitleDraft(task.title);
        setEditingTitle(true);
    };
    const commitTitle = async () => {
        const next = titleDraft.trim();
        if (!next || next === task.title) {
            setEditingTitle(false);
            return;
        }
        setSavingInline(true);
        try {
            await updateTask(task.id, {
                title: next,
                notes: task.notes ?? undefined,
                eventId: task.event_id ?? undefined,
                dueAt: task.due_at,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: task.priority,
                assigneeProfileIds: task.assignee_profile_ids,
            });
            await refetchTask();
        } catch (err) {
            console.error('title save failed', err);
        } finally {
            setSavingInline(false);
            setEditingTitle(false);
        }
    };

    const startNotesEdit = () => {
        if (isCaregiver) return;
        setNotesDraft(task.notes ?? '');
        setEditingNotes(true);
    };
    const commitNotes = async () => {
        const next = notesDraft.trim();
        const original = task.notes ?? '';
        if (next === original) {
            setEditingNotes(false);
            return;
        }
        setSavingInline(true);
        try {
            await updateTask(task.id, {
                title: task.title,
                notes: next || null,
                eventId: task.event_id ?? undefined,
                dueAt: task.due_at,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: task.priority,
                assigneeProfileIds: task.assignee_profile_ids,
            });
            await refetchTask();
        } catch (err) {
            console.error('notes save failed', err);
        } finally {
            setSavingInline(false);
            setEditingNotes(false);
        }
    };

    // ─── Other handlers ────────────────────────────────────────────────

    const handleToggleComplete = async () => {
        try {
            await setTaskCompleted(task.id, !done);
            await refetchTask();
        } catch (err) {
            console.error('toggle complete failed', err);
            const msg =
                errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't update: ${msg}`);
            else Alert.alert("Couldn't update", msg);
        }
    };

    const handleSnooze = async () => {
        const base = task.due_at ? new Date(task.due_at) : new Date();
        base.setDate(base.getDate() + 1);
        try {
            await updateTask(task.id, {
                title: task.title,
                notes: task.notes ?? undefined,
                eventId: task.event_id ?? undefined,
                dueAt: base.toISOString(),
                assigneeProfileIds: task.assignee_profile_ids,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: task.priority,
            });
            await refetchTask();
        } catch (err) {
            console.error('snooze task failed', err);
            const msg =
                errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't snooze: ${msg}`);
            else Alert.alert("Couldn't snooze", msg);
        }
    };

    const handleDeleted = () => {
        router.replace('/lists');
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Top bar — back + TASK pretitle + ••• kebab */}
                    <View style={styles.topBar}>
                        <Pressable
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            style={({ pressed }) => [
                                styles.topBarIconBtn,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather
                                name="chevron-left"
                                size={14}
                                color={colors.text}
                            />
                        </Pressable>
                        <ThemedText
                            style={[
                                styles.topBarPretitle,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            TASK
                        </ThemedText>
                        {!isCaregiver ? (
                            <Pressable
                                onPress={() => setOverflowSheetOpen(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Task actions"
                                style={({ pressed }) => [
                                    styles.topBarIconBtn,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="more-horizontal"
                                    size={14}
                                    color={colors.text}
                                />
                            </Pressable>
                        ) : (
                            <View style={styles.topBarIconBtn} />
                        )}
                    </View>

                    {/* Hero — checkbox + title (read or edit) + pills + hint */}
                    <View style={styles.hero}>
                        <Pressable
                            onPress={handleToggleComplete}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: done }}
                            accessibilityLabel={
                                done
                                    ? 'Mark task as not done'
                                    : 'Mark task as done'
                            }
                            style={({ pressed }) => [
                                styles.heroCheckbox,
                                {
                                    borderColor: colors.accent,
                                    backgroundColor: done
                                        ? colors.accent
                                        : 'transparent',
                                },
                                pressed && styles.pressed,
                            ]}>
                            {done ? (
                                <Feather
                                    name="check"
                                    size={16}
                                    color={colors.onAccent}
                                />
                            ) : null}
                        </Pressable>
                        <View style={styles.heroBody}>
                            {editingTitle ? (
                                <View
                                    style={[
                                        styles.titleEditWrap,
                                        {
                                            backgroundColor:
                                                colors.backgroundInset,
                                            borderColor: colors.accent,
                                        },
                                    ]}>
                                    <TextInput
                                        value={titleDraft}
                                        onChangeText={setTitleDraft}
                                        onBlur={commitTitle}
                                        onSubmitEditing={commitTitle}
                                        returnKeyType="done"
                                        autoFocus
                                        editable={!savingInline}
                                        style={[
                                            styles.heroTitle,
                                            styles.titleInput,
                                            {
                                                color: colors.text,
                                                textDecorationLine: done
                                                    ? 'line-through'
                                                    : 'none',
                                            },
                                        ]}
                                        multiline
                                    />
                                </View>
                            ) : (
                                <Pressable
                                    onPress={startTitleEdit}
                                    disabled={isCaregiver}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit task title"
                                    style={({ pressed }) => [
                                        pressed &&
                                            !isCaregiver &&
                                            styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.heroTitle,
                                            {
                                                color: colors.text,
                                                textDecorationLine: done
                                                    ? 'line-through'
                                                    : 'none',
                                            },
                                        ]}>
                                        {task.title}
                                    </ThemedText>
                                </Pressable>
                            )}
                            {statusPill || priorityPillSpec ? (
                                <View style={styles.heroPills}>
                                    {statusPill ? (
                                        <StatusPill
                                            color={statusPill.color}
                                            label={statusPill.label}
                                        />
                                    ) : null}
                                    {priorityPillSpec ? (
                                        <StatusPill
                                            color={priorityPillSpec.color}
                                            label={priorityPillSpec.label}
                                        />
                                    ) : null}
                                </View>
                            ) : null}
                            {/* Mono hint — read state only, hidden for
                                caregivers since they can't edit the title
                                or open the kebab. */}
                            {!editingTitle && !isCaregiver ? (
                                <ThemedText
                                    style={[
                                        styles.heroHint,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoMedium,
                                        },
                                    ]}>
                                    Tap title to rename · ••• for more
                                </ThemedText>
                            ) : null}
                        </View>
                    </View>

                    {/* Details SGroup — Assigned / Due / Reminder / Recurring / Priority */}
                    <SGroup label="Details">
                        <SRow
                            label="Assigned to"
                            chevron={!isCaregiver}
                            onPress={
                                isCaregiver
                                    ? undefined
                                    : () => setAssigneeSheetOpen(true)
                            }
                            right={
                                <AssigneeStack
                                    assignees={assignees}
                                    colorMap={colorMap}
                                    currentUserId={user.id}
                                    palette={colors}
                                />
                            }
                        />
                        <SRow
                            label="Due"
                            chevron={!isCaregiver}
                            onPress={
                                isCaregiver
                                    ? undefined
                                    : () => setDueSheetOpen(true)
                            }
                            right={
                                task.due_at ? (
                                    <ThemedText
                                        style={[
                                            styles.detailMono,
                                            {
                                                color: statusPill
                                                    ? statusPill.color
                                                    : colors.text,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {formatDueLabel(task.due_at)}
                                    </ThemedText>
                                ) : (
                                    <ThemedText
                                        style={[
                                            styles.detailMono,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        No due date
                                    </ThemedText>
                                )
                            }
                        />
                        <SRow
                            label="Reminder"
                            chevron={!isCaregiver}
                            onPress={
                                isCaregiver
                                    ? undefined
                                    : () => setReminderSheetOpen(true)
                            }
                            right={
                                reminderPreset && task.reminder_at ? (
                                    <ThemedText
                                        style={[
                                            styles.detailMonoSm,
                                            {
                                                color: colors.inkSec,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {format(
                                            parseISO(task.reminder_at),
                                            'HH:mm',
                                        )}{' '}
                                        · {reminderPreset.label}
                                    </ThemedText>
                                ) : (
                                    <ThemedText
                                        style={[
                                            styles.detailMonoSm,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        None
                                    </ThemedText>
                                )
                            }
                        />
                        {/* Recurring row removed (#383 cut from scope). When
                            task-level recurrence ships, restore the SRow + the
                            RecurringSheet under it. */}
                        <SRow
                            label="Priority"
                            chevron={!isCaregiver}
                            onPress={
                                isCaregiver
                                    ? undefined
                                    : () => setPrioritySheetOpen(true)
                            }
                            last
                            right={
                                <ThemedText
                                    style={[
                                        styles.detailMonoSm,
                                        {
                                            color: priorityColor(
                                                task.priority,
                                                colors,
                                            ),
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                            fontWeight: '600',
                                        },
                                    ]}>
                                    {priorityLabel(task.priority)}
                                </ThemedText>
                            }
                        />
                    </SGroup>

                    {/* For SGroup — kid chips + + Edit. Only renders if
                        the household has any children; an empty household
                        has nothing useful to put in this slot. */}
                    {(children ?? []).length > 0 ? (
                        <SGroup label={`For · ${taskChildren.length}`}>
                            <View style={styles.chipRow}>
                                {taskChildren.map((c) => (
                                    <View
                                        key={c.id}
                                        style={[
                                            styles.forChip,
                                            {
                                                backgroundColor: withAlpha(
                                                    c.color,
                                                    0x22 / 255,
                                                ),
                                                borderColor: withAlpha(
                                                    c.color,
                                                    0x55 / 255,
                                                ),
                                            },
                                        ]}>
                                        <ChildBadge
                                            name={c.display_name}
                                            color={c.color}
                                            size="sm"
                                        />
                                        <ThemedText
                                            style={[
                                                styles.forChipText,
                                                { color: colors.text },
                                            ]}>
                                            For {c.display_name}
                                        </ThemedText>
                                    </View>
                                ))}
                                {!isCaregiver ? (
                                    <Pressable
                                        onPress={() =>
                                            setChildrenSheetOpen(true)
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel="Edit children"
                                        style={({ pressed }) => [
                                            styles.addChip,
                                            {
                                                borderColor:
                                                    colors.inkFaint,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.addChipText,
                                                {
                                                    color: colors.inkSec,
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                },
                                            ]}>
                                            + Edit
                                        </ThemedText>
                                    </Pressable>
                                ) : null}
                            </View>
                        </SGroup>
                    ) : null}

                    {/* Linked event — only when task.event_id is set */}
                    {linkedEvent ? (
                        <SGroup label="Linked event">
                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: '/event/[id]',
                                        params: { id: linkedEvent.id },
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`Open linked event ${linkedEvent.title}`}
                                style={({ pressed }) => [
                                    styles.linkedEventRow,
                                    pressed && styles.pressed,
                                ]}>
                                <View
                                    style={[
                                        styles.linkedEventRail,
                                        {
                                            backgroundColor: colorForResponsible(
                                                linkedEvent.responsible_profile_id ??
                                                    null,
                                                colorMap,
                                            ),
                                        },
                                    ]}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <ThemedText
                                        numberOfLines={1}
                                        style={[
                                            styles.linkedEventTitle,
                                            { color: colors.text },
                                        ]}>
                                        {linkedEvent.title}
                                    </ThemedText>
                                    <ThemedText
                                        numberOfLines={1}
                                        style={[
                                            styles.linkedEventMeta,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {linkedEvent.all_day
                                            ? format(
                                                  parseISO(
                                                      linkedEvent.starts_at,
                                                  ),
                                                  'EEE MMM d',
                                              ) + ' · all day'
                                            : format(
                                                  parseISO(
                                                      linkedEvent.starts_at,
                                                  ),
                                                  'EEE MMM d · HH:mm',
                                              )}
                                        {linkedEvent.location
                                            ? ` · ${linkedEvent.location}`
                                            : ''}
                                    </ThemedText>
                                </View>
                                <Feather
                                    name="chevron-right"
                                    size={12}
                                    color={colors.inkFaint}
                                />
                            </Pressable>
                        </SGroup>
                    ) : null}

                    {/* In lists — chips + + Edit. Chips themselves open
                        the sheet so the design's "tap any chip to edit"
                        behavior works. The + Edit chip is the explicit
                        affordance. */}
                    <SGroup
                        label={
                            taskLists.length > 0
                                ? `In lists · ${taskLists.length}`
                                : 'In lists'
                        }>
                        <View style={styles.chipRow}>
                            {taskLists.map((l) => (
                                <Pressable
                                    key={l.id}
                                    onPress={
                                        isCaregiver
                                            ? undefined
                                            : () => setListsSheetOpen(true)
                                    }
                                    disabled={isCaregiver}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit lists (${l.name})`}
                                    style={({ pressed }) => [
                                        styles.listChip,
                                        {
                                            backgroundColor: withAlpha(
                                                l.color,
                                                0x22 / 255,
                                            ),
                                            borderColor: withAlpha(
                                                l.color,
                                                0x55 / 255,
                                            ),
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View
                                        style={[
                                            styles.listChipDot,
                                            { backgroundColor: l.color },
                                        ]}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.listChipText,
                                            { color: colors.text },
                                        ]}>
                                        {l.name}
                                    </ThemedText>
                                </Pressable>
                            ))}
                            {!isCaregiver ? (
                                <Pressable
                                    onPress={() => setListsSheetOpen(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit lists"
                                    style={({ pressed }) => [
                                        styles.addChip,
                                        { borderColor: colors.inkFaint },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.addChipText,
                                            {
                                                color: colors.inkSec,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        + Edit
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                        </View>
                    </SGroup>

                    {/* Notes — always renders. Read state shows a TAP TO
                        EDIT badge top-right; tapping anywhere on the body
                        switches to a multiline TextInput that saves on
                        blur. */}
                    <SGroup label="Notes">
                        {editingNotes ? (
                            <View style={styles.notesEditWrap}>
                                <TextInput
                                    value={notesDraft}
                                    onChangeText={setNotesDraft}
                                    onBlur={commitNotes}
                                    autoFocus
                                    multiline
                                    editable={!savingInline}
                                    placeholder="Add notes — context, packing list, anything worth remembering."
                                    placeholderTextColor={colors.inkFaint}
                                    style={[
                                        styles.notesInput,
                                        { color: colors.inkSec },
                                    ]}
                                />
                            </View>
                        ) : (
                            <Pressable
                                onPress={startNotesEdit}
                                disabled={isCaregiver}
                                accessibilityRole="button"
                                accessibilityLabel="Edit notes"
                                style={({ pressed }) => [
                                    styles.notesBody,
                                    pressed &&
                                        !isCaregiver &&
                                        styles.pressed,
                                ]}>
                                {task.notes ? (
                                    <ThemedText
                                        style={[
                                            styles.notesText,
                                            { color: colors.inkSec },
                                        ]}>
                                        {task.notes}
                                    </ThemedText>
                                ) : (
                                    <ThemedText
                                        style={[
                                            styles.notesText,
                                            {
                                                color: colors.inkFaint,
                                                fontStyle: 'italic',
                                            },
                                        ]}>
                                        {isCaregiver
                                            ? 'No notes.'
                                            : 'No notes yet — tap to add.'}
                                    </ThemedText>
                                )}
                                {!isCaregiver && task.notes ? (
                                    <View
                                        style={[
                                            styles.tapToEditBadge,
                                            {
                                                backgroundColor:
                                                    colors.backgroundInset,
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.tapToEditBadgeText,
                                                {
                                                    color: colors.inkFaint,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            TAP TO EDIT
                                        </ThemedText>
                                    </View>
                                ) : null}
                            </Pressable>
                        )}
                    </SGroup>

                    {/* History — created + completed rows in the
                        EDActivity vocabulary. Full activity log lands when
                        the activity_events table ships (#310). */}
                    <SGroup label="History">
                        <View style={styles.historyBody}>
                            <View style={styles.historyRow}>
                                <View
                                    style={[
                                        styles.historyDot,
                                        {
                                            backgroundColor: colors.inkFaint,
                                        },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.historyLine,
                                        { color: colors.text },
                                    ]}>
                                    Task created
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.historyWhen,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {format(
                                        parseISO(task.created_at),
                                        'MMM d',
                                    )}
                                </ThemedText>
                            </View>
                            {task.completed_at ? (
                                <View style={styles.historyRow}>
                                    <View
                                        style={[
                                            styles.historyDot,
                                            {
                                                backgroundColor: colors.accent,
                                            },
                                        ]}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.historyLine,
                                            { color: colors.text },
                                        ]}>
                                        Marked done
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.historyWhen,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {format(
                                            parseISO(task.completed_at),
                                            'MMM d',
                                        )}
                                    </ThemedText>
                                </View>
                            ) : null}
                        </View>
                    </SGroup>
                </ScrollView>

                {/* Sticky action bar */}
                <View
                    style={[
                        styles.stickyBar,
                        {
                            backgroundColor:
                                Platform.OS === 'web'
                                    ? withAlpha(colors.background, 0.95)
                                    : colors.background,
                            borderTopColor: colors.hair,
                        },
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                              } as object)
                            : null,
                    ]}>
                    {!isCaregiver && !done ? (
                        <Pressable
                            onPress={handleSnooze}
                            accessibilityRole="button"
                            accessibilityLabel="Snooze one day"
                            style={({ pressed }) => [
                                styles.snoozeBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather
                                name="clock"
                                size={12}
                                color={colors.warn}
                            />
                            <ThemedText
                                style={[
                                    styles.snoozeBtnText,
                                    { color: colors.warn },
                                ]}>
                                Snooze
                            </ThemedText>
                        </Pressable>
                    ) : null}
                    <Pressable
                        onPress={handleToggleComplete}
                        accessibilityRole="button"
                        accessibilityLabel={
                            done ? 'Reopen task' : 'Mark task done'
                        }
                        style={({ pressed }) => [
                            styles.primaryBtn,
                            { backgroundColor: colors.accent },
                            pressed && styles.pressed,
                        ]}>
                        <Feather
                            name={done ? 'rotate-ccw' : 'check'}
                            size={12}
                            color={colors.onAccent}
                        />
                        <ThemedText
                            style={[
                                styles.primaryBtnText,
                                { color: colors.onAccent },
                            ]}>
                            {done ? 'Reopen' : 'Mark done'}
                        </ThemedText>
                    </Pressable>
                </View>
            </SafeAreaView>

            {/* ─── Sheet mounts ─────────────────────────────────────── */}
            <AssigneePickerSheet
                open={assigneeSheetOpen}
                onClose={() => setAssigneeSheetOpen(false)}
                onSaved={refetchTask}
                task={task}
                members={members ?? []}
                currentUserId={user.id}
            />
            <DuePickerSheet
                open={dueSheetOpen}
                onClose={() => setDueSheetOpen(false)}
                onSaved={refetchTask}
                task={task}
            />
            <ReminderSheet
                open={reminderSheetOpen}
                onClose={() => setReminderSheetOpen(false)}
                onSaved={refetchTask}
                task={task}
            />
            <PrioritySheet
                open={prioritySheetOpen}
                onClose={() => setPrioritySheetOpen(false)}
                onSaved={refetchTask}
                task={task}
            />
            <ListsSheet
                open={listsSheetOpen}
                onClose={() => setListsSheetOpen(false)}
                onSaved={refetchTask}
                task={task}
                lists={lists ?? []}
                taskCounts={listTaskCounts}
            />
            <ChildrenSheet
                open={childrenSheetOpen}
                onClose={() => setChildrenSheetOpen(false)}
                onSaved={refetchTask}
                task={task}
                children={children ?? []}
            />
            <TaskOverflowSheet
                open={overflowSheetOpen}
                onClose={() => setOverflowSheetOpen(false)}
                onDeleted={handleDeleted}
                onMoveToList={() => setListsSheetOpen(true)}
                task={task}
            />
        </ThemedView>
    );
}

// ─── AssigneeStack helper ─────────────────────────────────────────────────

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

function AssigneeStack({
    assignees,
    colorMap,
    currentUserId,
    palette,
}: {
    assignees: Array<{ profile_id: string; display_name: string }>;
    colorMap: Map<string, string>;
    currentUserId: string;
    palette: Palette;
}) {
    if (assignees.length === 0) {
        return (
            <View style={styles.assigneeStack}>
                <View
                    style={[
                        styles.assigneeAvatar,
                        styles.assigneeAvatarAnyone,
                        { borderColor: palette.inkFaint },
                    ]}>
                    <ThemedText
                        style={[
                            styles.assigneeAvatarText,
                            { color: palette.inkFaint },
                        ]}>
                        ?
                    </ThemedText>
                </View>
                <ThemedText
                    style={[
                        styles.assigneeName,
                        { color: palette.textSecondary },
                    ]}>
                    Anyone
                </ThemedText>
            </View>
        );
    }
    return (
        <View style={styles.assigneeStack}>
            {assignees.slice(0, 3).map((m) => {
                const c = colorForResponsible(m.profile_id, colorMap);
                const initial =
                    m.display_name?.charAt(0).toUpperCase() ?? '?';
                return (
                    <View
                        key={m.profile_id}
                        style={[
                            styles.assigneeAvatar,
                            { backgroundColor: c },
                        ]}>
                        <ThemedText style={styles.assigneeAvatarText}>
                            {initial}
                        </ThemedText>
                    </View>
                );
            })}
            <ThemedText
                numberOfLines={1}
                style={[styles.assigneeName, { color: palette.text }]}>
                {assignees
                    .map((m) => firstNameOf(m.display_name))
                    .join(', ')}
            </ThemedText>
        </View>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 110 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
    },
    topBarIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarPretitle: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    hero: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 16,
    },
    heroCheckbox: {
        width: 28,
        height: 28,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    heroBody: { flex: 1, minWidth: 0 },
    heroTitle: {
        fontSize: 22,
        fontWeight: '600',
        letterSpacing: -0.7,
        lineHeight: 28,
    },
    titleEditWrap: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginLeft: -10,
        borderRadius: 8,
        borderWidth: 1.2,
    },
    titleInput: {
        // Strip the platform default vertical padding so the input edges
        // align with the read-state title's leading edge.
        padding: 0,
        margin: 0,
    },
    heroPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    heroHint: {
        fontSize: 10,
        letterSpacing: -0.1,
        marginTop: 6,
    },

    detailMono: {
        fontSize: 13,
        letterSpacing: -0.3,
        fontWeight: '600',
    },
    detailMonoSm: {
        fontSize: 12,
        letterSpacing: -0.2,
    },

    assigneeStack: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    assigneeAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assigneeAvatarAnyone: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    assigneeAvatarText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    assigneeName: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
        flexShrink: 1,
    },

    // Linked event row
    linkedEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    linkedEventRail: {
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 2,
        minHeight: 40,
    },
    linkedEventTitle: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    linkedEventMeta: {
        fontSize: 10.5,
        letterSpacing: -0.2,
        marginTop: 1,
    },

    // Generic chip row used by For and In lists SGroups.
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    // ForChip — kid avatar + "For {name}" label.
    forChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 4,
        paddingRight: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    forChipText: {
        fontSize: 11.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    // ListChip — color dot + list name.
    listChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 8,
        paddingRight: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    listChipDot: { width: 6, height: 6, borderRadius: 3 },
    listChipText: {
        fontSize: 11.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    // + Edit affordance (dashed, mono caption).
    addChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
    },
    addChipText: { fontSize: 11, letterSpacing: -0.1 },

    // Notes
    notesBody: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        position: 'relative',
    },
    notesText: {
        fontSize: 13,
        lineHeight: 20,
    },
    notesEditWrap: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    notesInput: {
        fontSize: 13,
        lineHeight: 20,
        padding: 0,
        margin: 0,
        minHeight: 60,
    },
    tapToEditBadge: {
        position: 'absolute',
        top: 10,
        right: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tapToEditBadgeText: {
        fontSize: 9.5,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },

    // History
    historyBody: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    historyDot: { width: 6, height: 6, borderRadius: 3 },
    historyLine: {
        flex: 1,
        fontSize: 13,
        letterSpacing: -0.2,
        fontWeight: '500',
    },
    historyWhen: { fontSize: 11, letterSpacing: -0.2 },

    // Sticky bottom action bar
    stickyBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    snoozeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    snoozeBtnText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
    },
    primaryBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },

    pressed: { opacity: 0.7 },
});
