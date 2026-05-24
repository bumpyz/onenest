// Standalone task creation modal. Reached from the Home FAB's task option (and
// future entry points). Mirrors the /task/[id] edit screen's field set but starts
// blank and calls createTask on save. No "delete" or "mark complete" actions —
// brand-new tasks can't be either.
//
// Why not share a TaskForm component with /task/[id]: the two screens diverge on
// initial-state seeding (one fetches a row via useTask, the other starts empty),
// on the save call (updateTask vs createTask), and on the action footer (delete +
// complete toggle vs. just save). Extracting a shared component would add more
// indirection than it saves. If a third entry point shows up we'll refactor then.

import { format } from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { UNASSIGNED_COLOR, colorForResponsible, memberColorMap } from '@/lib/colors';
import { createTask } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import {
    REMINDER_PRESETS,
    computeReminderAt,
    type ReminderPreset,
} from '@/lib/task-reminders';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function NewTaskScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { lists, isLoading: listsLoading } = useLists(household?.id);
    const { children, isLoading: childrenLoading } = useChildren(household?.id);

    // Blank initial state. createTask in db.ts defaults the list to Inbox when
    // listIds is empty, so we don't have to pre-select anything for "I just want
    // to dump a task" flows.
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [listIds, setListIds] = useState<string[]>([]);
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [childIds, setChildIds] = useState<string[]>([]);
    const [reminderPresetId, setReminderPresetId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        listsLoading ||
        childrenLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    const colorMap = memberColorMap(members);
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
            await createTask(household.id, {
                title: title.trim(),
                notes: notes.trim() || null,
                // No eventId — standalone tasks only. Event-linked tasks are
                // created via the event form's inline section.
                listIds,
                childIds,
                dueAt: dueAtIso,
                reminderAt: computeReminderAt(dueAtIso, reminderPreset),
                assigneeProfileIds: assigneeIds,
            });
            router.back();
        } catch (err) {
            console.error('task create failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save", msg);
            setSubmitting(false);
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
                    <ThemedText type="smallBold">New task</ThemedText>
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
                            {submitting ? 'Saving…' : 'Create'}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Title</ThemedText>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="What needs doing?"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoFocus
                            editable={!submitting}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Lists</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                            Leave blank to land in Inbox. Tap to add to one or more
                            named lists.
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
                                                color: selected ? colors.textOnPastel : colors.text,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one + 1,
    },
    multiline: { height: 88, textAlignVertical: 'top', paddingTop: Spacing.two },
    errorText: { color: '#B85D52' },
    pressed: { opacity: 0.7 },
});
