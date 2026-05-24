// Standalone task edit modal. Reached via the Lists tab when a non-event-linked task
// is tapped. Event-linked tasks route to /event/[id] instead so the event form
// remains the single source of truth for any task tied to an event.
//
// Fields: title, notes, due date + time, list picker, assignees (Anyone select-all +
// per-member chips), complete toggle, delete.

import { format, parseISO } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { DateField, TimeField } from '@/components/datetime-fields';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useTask } from '@/hooks/use-task';
import { UNASSIGNED_COLOR, colorForResponsible, memberColorMap } from '@/lib/colors';
import {
    REMINDER_PRESETS,
    computeReminderAt,
    presetForReminderAt,
    type ReminderPreset,
} from '@/lib/task-reminders';
import {
    deleteTask,
    setTaskCompleted,
    updateTask,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function EditTaskScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { lists, isLoading: listsLoading } = useLists(household?.id);
    const { children, isLoading: childrenLoading } = useChildren(household?.id);
    const { task, isLoading: taskLoading } = useTask(id);

    // Local edit state — initialized from the loaded task, mutated freely, written
    // back on Save. Keeping it controlled (vs uncontrolled with a ref) so the assignee
    // chip toggles can render selection state immediately.
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [listIds, setListIds] = useState<string[]>([]);
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [childIds, setChildIds] = useState<string[]>([]);
    // Reminder preset id (null = no reminder). Stored as id rather than the full
    // preset so we can match it back even when REMINDER_PRESETS evolves.
    const [reminderPresetId, setReminderPresetId] = useState<string | null>(null);
    // Snapshot of the reminder_at we loaded from the DB. On save we only pass
    // reminderAt to updateTask when the computed value differs from this snapshot
    // — otherwise updateTask clears reminded_at and the cron job re-fires the
    // same reminder a second time (QA-001). Stored as ref so it doesn't trigger
    // re-renders.
    const initialReminderAtRef = useRef<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Seed local state once the task loads. We only seed on initial load (gated by
    // checking if title is still empty) so the user's in-progress edits aren't
    // clobbered when a refetch from focus refires.
    useEffect(() => {
        if (!task) return;
        setTitle(task.title);
        setNotes(task.notes ?? '');
        if (task.due_at) {
            const d = new Date(task.due_at);
            setDueDate(format(d, 'yyyy-MM-dd'));
            setDueTime(format(d, 'HH:mm'));
        } else {
            setDueDate('');
            setDueTime('');
        }
        setListIds(task.list_ids);
        setAssigneeIds(task.assignee_profile_ids);
        setChildIds(task.child_ids);
        // Reverse-map the stored reminder_at back to a preset id so the picker
        // highlights the right chip. Tasks saved with a custom offset (or no
        // matching preset) show "None" by default — the user re-picks if needed.
        setReminderPresetId(
            presetForReminderAt(task.due_at, task.reminder_at)?.id ?? null,
        );
        // Remember the loaded reminder_at so the save handler can detect "unchanged"
        // and skip the patch (which would otherwise clear reminded_at and double-
        // fire the next cron pass).
        initialReminderAtRef.current = task.reminder_at;
        // We intentionally seed only once per task id load — subsequent task object
        // identity changes from refetches shouldn't blow away user edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.id]);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        listsLoading ||
        childrenLoading ||
        taskLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (!task) {
        // Task may have been deleted in another tab — bounce back rather than crash.
        return <Redirect href="/lists" />;
    }

    const colorMap = memberColorMap(members);
    const done = !!task.completed_at;
    const canSubmit = title.trim().length > 0 && !submitting;

    const toggleAssignee = (profileId: string) => {
        setAssigneeIds((prev) =>
            prev.includes(profileId)
                ? prev.filter((id) => id !== profileId)
                : [...prev, profileId],
        );
    };

    const toggleAnyone = () => {
        const allIds = (members ?? []).map((m) => m.profile_id);
        const allSelected =
            allIds.length > 0 && allIds.every((id) => assigneeIds.includes(id));
        setAssigneeIds(allSelected ? [] : allIds);
    };

    /** Combines the date + time pickers into an ISO due_at; null when both blank. */
    const buildDueAt = (): string | null => {
        if (!dueDate && !dueTime) return null;
        const datePart = dueDate || format(new Date(), 'yyyy-MM-dd');
        const timePart = dueTime || '12:00';
        const combined = new Date(`${datePart}T${timePart}`);
        if (Number.isNaN(combined.getTime())) return null;
        return combined.toISOString();
    };

    const handleSave = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const dueAtIso = buildDueAt();
            const reminderPreset: ReminderPreset | null =
                REMINDER_PRESETS.find((p) => p.id === reminderPresetId) ?? null;
            const computedReminderAt = computeReminderAt(dueAtIso, reminderPreset);
            // QA-001: only patch reminder_at when it actually changed. updateTask
            // resets reminded_at whenever reminderAt is included in the input,
            // which would otherwise re-fire the cron's push for any unrelated save
            // (rename, assignee tweak, etc.).
            const reminderChanged =
                computedReminderAt !== initialReminderAtRef.current;
            await updateTask(task.id, {
                title: title.trim(),
                notes: notes.trim() || null,
                eventId: task.event_id,
                // The full chip-selected set replaces what's there. An empty list
                // here folds into Inbox via the orphan path (same as a list-delete
                // dropping a task off all named lists).
                listIds,
                childIds,
                dueAt: dueAtIso,
                ...(reminderChanged ? { reminderAt: computedReminderAt } : {}),
                assigneeProfileIds: assigneeIds,
            });
            router.back();
        } catch (err) {
            console.error('task save failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save", msg);
            setSubmitting(false);
        }
    };

    const handleToggleComplete = async () => {
        try {
            await setTaskCompleted(task.id, !done);
            router.back();
        } catch (err) {
            console.error('toggle complete failed', err);
        }
    };

    const handleDelete = async () => {
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm('Delete this task?')
                : await new Promise<boolean>((resolve) => {
                      Alert.alert('Delete this task?', undefined, [
                          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                      ]);
                  });
        if (!confirmed) return;
        try {
            await deleteTask(task.id);
            router.back();
        } catch (err) {
            console.error('delete task failed', err);
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

    const allMemberIds = (members ?? []).map((m) => m.profile_id);
    const anyoneActive =
        allMemberIds.length > 0 &&
        allMemberIds.every((id) => assigneeIds.includes(id));

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.headerBar}>
                    <Pressable
                        onPress={() => router.back()}
                        disabled={submitting}
                        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold">Edit task</ThemedText>
                    <Pressable
                        onPress={handleSave}
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
                            {submitting ? 'Saving…' : 'Save'}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    {/* Complete toggle as a chunky button at the top — it's the most
                        common action and worth promoting above the form fields. */}
                    <Pressable
                        onPress={handleToggleComplete}
                        style={({ pressed }) => [
                            styles.completeBtn,
                            {
                                backgroundColor: done ? '#6F7FA5' : 'transparent',
                                borderColor: '#6F7FA5',
                            },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: done ? '#fff' : '#6F7FA5',
                                fontWeight: '600',
                            }}>
                            {done ? '✓ Completed — tap to reopen' : 'Mark complete'}
                        </ThemedText>
                    </Pressable>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Title</ThemedText>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Task title"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            editable={!submitting}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Lists</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                            A task can live in multiple lists at once (e.g. Urgent +
                            Groceries). Toggle each list to add or remove it. Clearing
                            them all sends the task to Inbox.
                        </ThemedText>
                        <View style={styles.chipRow}>
                            {(lists ?? []).map((l) => {
                                const selected = listIds.includes(l.id);
                                return (
                                    <Pressable
                                        key={l.id}
                                        onPress={() =>
                                            setListIds((prev) =>
                                                prev.includes(l.id)
                                                    ? prev.filter((id) => id !== l.id)
                                                    : [...prev, l.id],
                                            )
                                        }
                                        style={({ pressed }) => [
                                            styles.listChip,
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
                                                color: selected ? '#2A2E3A' : colors.text,
                                                fontWeight: '600',
                                            }}>
                                            {l.name}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {(children ?? []).length > 0 ? (
                        <View style={styles.field}>
                            <ThemedText type="smallBold">Children</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                                Tag the kid(s) this task is for. Powers the
                                by-child view in the Lists tab.
                            </ThemedText>
                            <View style={styles.chipRow}>
                                {(children ?? []).map((c) => {
                                    const selected = childIds.includes(c.id);
                                    return (
                                        <Pressable
                                            key={c.id}
                                            onPress={() =>
                                                setChildIds((prev) =>
                                                    prev.includes(c.id)
                                                        ? prev.filter(
                                                              (id) => id !== c.id,
                                                          )
                                                        : [...prev, c.id],
                                                )
                                            }
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
                                            <ChildBadge
                                                name={c.display_name}
                                                color={c.color}
                                                size="sm"
                                            />
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected
                                                        ? '#2A2E3A'
                                                        : colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {c.display_name}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Due (optional)</ThemedText>
                        <View style={styles.duePickers}>
                            <DateField value={dueDate} onChange={setDueDate} />
                            <TimeField value={dueTime} onChange={setDueTime} />
                            {dueDate || dueTime ? (
                                <Pressable
                                    onPress={() => {
                                        setDueDate('');
                                        setDueTime('');
                                    }}
                                    style={({ pressed }) => [
                                        styles.clearBtn,
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText type="small" themeColor="textSecondary">
                                        Clear
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>

                    {/* Reminder picker. Only meaningful when due_at is set — without
                        a target time there's nothing to offset against. We render
                        a disabled hint instead of hiding so the affordance stays
                        discoverable. */}
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Reminder</ThemedText>
                        {!dueDate ? (
                            <ThemedText type="small" themeColor="textSecondary">
                                Set a due date to enable reminders.
                            </ThemedText>
                        ) : (
                            <View style={styles.chipRow}>
                                <Pressable
                                    onPress={() => setReminderPresetId(null)}
                                    style={({ pressed }) => [
                                        styles.assignChip,
                                        {
                                            borderColor: colors.backgroundSelected,
                                            backgroundColor:
                                                reminderPresetId === null
                                                    ? '#6F7FA5'
                                                    : 'transparent',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color:
                                                reminderPresetId === null
                                                    ? '#fff'
                                                    : colors.text,
                                            fontWeight: '500',
                                        }}>
                                        None
                                    </ThemedText>
                                </Pressable>
                                {REMINDER_PRESETS.map((p) => {
                                    const selected = reminderPresetId === p.id;
                                    return (
                                        <Pressable
                                            key={p.id}
                                            onPress={() => setReminderPresetId(p.id)}
                                            style={({ pressed }) => [
                                                styles.assignChip,
                                                {
                                                    borderColor: '#6F7FA5',
                                                    backgroundColor: selected
                                                        ? '#6F7FA5'
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
                                                {p.label}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Assigned to</ThemedText>
                        <View style={styles.chipRow}>
                            <Pressable
                                onPress={toggleAnyone}
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
                                        // UX-011: full-contrast text in unselected
                                        // state so Anyone doesn't read as disabled.
                                        color: anyoneActive ? '#fff' : colors.text,
                                        fontWeight: '500',
                                    }}>
                                    Anyone
                                </ThemedText>
                            </Pressable>
                            {(members ?? []).map((m) => {
                                const c = colorForResponsible(m.profile_id, colorMap);
                                const selected = assigneeIds.includes(m.profile_id);
                                const label =
                                    user.id === m.profile_id ? 'Me' : m.display_name;
                                return (
                                    <Pressable
                                        key={m.profile_id}
                                        onPress={() => toggleAssignee(m.profile_id)}
                                        style={({ pressed }) => [
                                            styles.assignChip,
                                            {
                                                borderColor: c,
                                                backgroundColor: selected
                                                    ? c
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
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Notes (optional)</ThemedText>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Anything else worth remembering"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={3}
                            style={[inputStyle, styles.multiline]}
                            editable={!submitting}
                        />
                    </View>

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}

                    <Pressable
                        onPress={handleDelete}
                        style={({ pressed }) => [
                            styles.deleteBtn,
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.deleteText}>Delete task</ThemedText>
                    </Pressable>

                    {/* Faint metadata at the bottom — useful for "who created this" /
                        "when did I knock this off" without taking valuable scroll real
                        estate up top. parseISO keeps the date local-tz-correct. */}
                    <View style={styles.metaBlock}>
                        <ThemedText type="small" themeColor="textSecondary">
                            Created {format(parseISO(task.created_at), 'MMM d, yyyy')}
                        </ThemedText>
                        {task.completed_at ? (
                            <ThemedText type="small" themeColor="textSecondary">
                                Completed{' '}
                                {format(parseISO(task.completed_at), 'MMM d, yyyy')}
                            </ThemedText>
                        ) : null}
                    </View>
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
    completeBtn: {
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingVertical: Spacing.three,
        alignItems: 'center',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.one,
    },
    listChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one + 1,
    },
    duePickers: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        flexWrap: 'wrap',
    },
    clearBtn: {
        paddingHorizontal: Spacing.two,
        paddingVertical: Spacing.one,
    },
    assignChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one + 1,
    },
    multiline: { height: 88, textAlignVertical: 'top', paddingTop: Spacing.two },
    errorText: { color: '#B85D52' },
    deleteBtn: {
        marginTop: Spacing.three,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: '#F3D9D3',
        alignItems: 'center',
    },
    deleteText: { color: '#B85D52', fontWeight: '600' },
    metaBlock: { marginTop: Spacing.four, gap: 2 },
    pressed: { opacity: 0.7 },
});
