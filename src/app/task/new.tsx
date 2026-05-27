// CreateTask · 05.7 — standalone task creation flow.
//
// Design source: docs/design-handoffs/onenest-spec-v1/
//   design_handoff_creation_flows/screens-creation.jsx::CreateTask
//   (~line 134) + the shared scaffold README.
//
// Sections, top to bottom (matches canvas 05.7):
//   1. TitleInput "TITLE" — accent underline.
//   2. AIHelper — paste-a-phrase hint.
//   3. When — Due (alert-tinted when today), Reminder, Repeats chevrons.
//      Each row opens a picker. For v1 we render the value display
//      with inline TextInputs / chip rows since the sheet-based
//      pickers from TaskDetail v2 aren't reusable as create-side
//      modals yet; chevrons surface where a future picker lands.
//   4. Who — Assigned to + For chip blocks inside one card.
//   5. In lists — ListTagChip rack + "+ Pick lists" DashedAddChip
//      (deferred: picker sheet).
//   6. Priority — 5-level SegRow (None / Low / Normal / High / Urgent).
//   7. Notes — multiline textarea.
//   8. Smart suggestion — dashed-border card (visual scaffold, no
//      backend wired).
//
// Why no shared TaskForm component: TaskDetail's edit flow uses
// field-edit sheets, not a single composite form. The Create surface
// stays a one-shot scrolling form per spec.

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
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

import { DateField, TimeField } from '@/components/datetime-fields';
import {
    AIHelper,
    AnyoneChip,
    CreateTopBar,
    DashedAddChip,
    FormGroup,
    FormRow,
    FormSectionLabel,
    ListTagChip,
    PersonChip,
    SegRow,
    TitleInput,
} from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useMyRole } from '@/hooks/use-my-role';
import { createTask, type TaskPriority } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import {
    REMINDER_PRESETS,
    computeReminderAt,
    type ReminderPreset,
} from '@/lib/task-reminders';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

const PRIORITY_OPTIONS: ReadonlyArray<{
    id: TaskPriority;
    label: string;
}> = [
    { id: 'none', label: 'None' },
    { id: 'low', label: 'Low' },
    { id: 'normal', label: 'Normal' },
    { id: 'high', label: 'High' },
    { id: 'urgent', label: 'Urgent' },
];

export default function NewTaskScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    // Optional pre-fill from upstream callers. The List detail screen
    // passes both `title` (typed into the inline quick-add row before
    // the user escalated via "MORE FIELDS →") and `listId` so the new
    // task lands in the right list with the typed text already in the
    // title field. Either may be absent — single-string slots that
    // safely fall through when undefined.
    const params = useLocalSearchParams<{
        title?: string | string[];
        listId?: string | string[];
    }>();
    const paramTitle = Array.isArray(params.title)
        ? params.title[0]
        : params.title;
    const paramListId = Array.isArray(params.listId)
        ? params.listId[0]
        : params.listId;

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    const { lists, isLoading: listsLoading } = useLists(household?.id);
    const { children, isLoading: childrenLoading } = useChildren(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // Default state: assignee seeded with the current user (spec
    // default), nothing else. `title` and `listIds` may be pre-filled
    // from the List detail's inline quick-add escalation — see paramTitle
    // / paramListId above. paramListId is a SINGLE id (the escalation
    // always starts from one list); we wrap it in an array so it slots
    // into the multi-list state without special handling downstream.
    const [title, setTitle] = useState(paramTitle ?? '');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [listIds, setListIds] = useState<string[]>(
        paramListId ? [paramListId] : [],
    );
    const [assigneeIds, setAssigneeIds] = useState<string[]>(
        user ? [user.id] : [],
    );
    const [childIds, setChildIds] = useState<string[]>([]);
    const [reminderPresetId, setReminderPresetId] = useState<string | null>(
        null,
    );
    const [priority, setPriority] = useState<TaskPriority>('normal');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        listsLoading ||
        childrenLoading ||
        roleLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers can mark tasks complete but cannot create them.
    if (isCaregiver) return <Redirect href="/" />;

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
    const toggleChild = (childId: string) => {
        setChildIds((prev) =>
            prev.includes(childId)
                ? prev.filter((id) => id !== childId)
                : [...prev, childId],
        );
    };
    const toggleList = (listId: string) => {
        setListIds((prev) =>
            prev.includes(listId)
                ? prev.filter((id) => id !== listId)
                : [...prev, listId],
        );
    };

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
                listIds,
                childIds,
                dueAt: dueAtIso,
                reminderAt: computeReminderAt(dueAtIso, reminderPreset),
                assigneeProfileIds: assigneeIds,
                priority,
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

    const allMemberIds = (members ?? []).map((m) => m.profile_id);
    const anyoneActive =
        allMemberIds.length > 0 &&
        allMemberIds.every((id) => assigneeIds.includes(id));

    // Due chip readout — accent + alert when due today.
    const dueIsToday = (() => {
        if (!dueDate) return false;
        return dueDate === format(new Date(), 'yyyy-MM-dd');
    })();

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <CreateTopBar
                    title="New task"
                    saveLabel={submitting ? 'Saving…' : 'Save'}
                    saveDisabled={!canSubmit}
                    onCancel={() => router.back()}
                    onSave={handleSave}
                />
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    <TitleInput
                        label="TITLE"
                        value={title}
                        onChangeText={setTitle}
                        placeholder="e.g. Pack Theo's overnight bag"
                        autoFocus
                        autoCapitalize="sentences"
                        editable={!submitting}
                    />

                    <AIHelper example={'"pack soph friday 6pm doctor" → due, kid, list pre-filled'} />

                    {/* WHEN */}
                    <FormSectionLabel>When</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.inlineRow}>
                                <ThemedText
                                    style={[
                                        styles.inlineLabel,
                                        { color: colors.text },
                                    ]}>
                                    Due
                                </ThemedText>
                                <View style={styles.dueInline}>
                                    <DateField
                                        value={dueDate}
                                        onChange={setDueDate}
                                    />
                                    <TimeField
                                        value={dueTime}
                                        onChange={setDueTime}
                                    />
                                </View>
                            </View>
                            {dueIsToday ? (
                                <View
                                    style={[
                                        styles.dueAlertStripe,
                                        {
                                            borderTopColor: colors.hair,
                                            borderTopWidth:
                                                StyleSheet.hairlineWidth,
                                        },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.dueAlertText,
                                            {
                                                color: colors.alert,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        DUE TODAY
                                    </ThemedText>
                                </View>
                            ) : null}
                            <View
                                style={[
                                    styles.inlineRow,
                                    {
                                        borderTopColor: colors.hair,
                                        borderTopWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.inlineLabel,
                                        { color: colors.text },
                                    ]}>
                                    Reminder
                                </ThemedText>
                                <View style={styles.reminderChipRow}>
                                    <Pressable
                                        onPress={() => setReminderPresetId(null)}
                                        style={({ pressed }) => [
                                            styles.reminderChip,
                                            {
                                                borderColor: colors.hair,
                                                backgroundColor:
                                                    reminderPresetId === null
                                                        ? colors.backgroundInset
                                                        : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.reminderChipText,
                                                {
                                                    color: colors.inkSec,
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                },
                                            ]}>
                                            None
                                        </ThemedText>
                                    </Pressable>
                                    {REMINDER_PRESETS.filter(
                                        (p) => p.id !== 'at',
                                    ).map((p) => {
                                        const selected =
                                            reminderPresetId === p.id;
                                        return (
                                            <Pressable
                                                key={p.id}
                                                onPress={() =>
                                                    setReminderPresetId(p.id)
                                                }
                                                disabled={!dueDate}
                                                style={({ pressed }) => [
                                                    styles.reminderChip,
                                                    {
                                                        borderColor: selected
                                                            ? colors.accent
                                                            : colors.hair,
                                                        backgroundColor:
                                                            selected
                                                                ? colors.accent
                                                                : 'transparent',
                                                        opacity: dueDate
                                                            ? 1
                                                            : 0.45,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    style={[
                                                        styles.reminderChipText,
                                                        {
                                                            color: selected
                                                                ? colors.onAccent
                                                                : colors.inkSec,
                                                            fontFamily:
                                                                FontFamily.monoMedium,
                                                        },
                                                    ]}>
                                                    {p.label}
                                                </ThemedText>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                            {/* Repeats — backend not wired for tasks yet,
                                so render the row muted "Coming soon" rather
                                than ship a chevron with nowhere to go. */}
                            <FormRow
                                label="Repeats"
                                value="Coming soon"
                                muted
                                chevron
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* WHO */}
                    <FormSectionLabel>Who</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.chipBlock}>
                                <ThemedText
                                    style={[
                                        styles.miniLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ASSIGNED TO
                                </ThemedText>
                                <View style={styles.chipRow}>
                                    {(members ?? []).map((m) => {
                                        const selected = assigneeIds.includes(
                                            m.profile_id,
                                        );
                                        return (
                                            <PersonChip
                                                key={m.profile_id}
                                                name={
                                                    user.id === m.profile_id
                                                        ? 'Me'
                                                        : m.display_name
                                                }
                                                color={
                                                    m.color ?? colors.inkFaint
                                                }
                                                selected={selected}
                                                onPress={() =>
                                                    toggleAssignee(m.profile_id)
                                                }
                                            />
                                        );
                                    })}
                                    <AnyoneChip
                                        selected={anyoneActive}
                                        onPress={toggleAnyone}
                                    />
                                </View>
                            </View>
                            {(children ?? []).length > 0 ? (
                                <View
                                    style={[
                                        styles.chipBlock,
                                        {
                                            borderTopColor: colors.hair,
                                            borderTopWidth:
                                                StyleSheet.hairlineWidth,
                                        },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.miniLabel,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        FOR
                                    </ThemedText>
                                    <View style={styles.chipRow}>
                                        {(children ?? []).map((c) => {
                                            const selected = childIds.includes(
                                                c.id,
                                            );
                                            return (
                                                <PersonChip
                                                    key={c.id}
                                                    name={c.display_name}
                                                    color={c.color}
                                                    selected={selected}
                                                    onPress={() =>
                                                        toggleChild(c.id)
                                                    }
                                                />
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}
                        </FormGroup>
                    </View>

                    {/* IN LISTS */}
                    <FormSectionLabel>In lists</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.chipBlock}>
                                <View style={styles.chipRow}>
                                    {(lists ?? []).map((l) => (
                                        <ListTagChip
                                            key={l.id}
                                            color={l.color}
                                            label={l.name}
                                            selected={listIds.includes(l.id)}
                                            onPress={() => toggleList(l.id)}
                                        />
                                    ))}
                                    <DashedAddChip label="+ Pick lists" />
                                </View>
                                {listIds.length === 0 ? (
                                    <ThemedText
                                        style={[
                                            styles.chipExplain,
                                            { color: colors.inkFaint },
                                        ]}>
                                        Leave blank to land in Inbox.
                                    </ThemedText>
                                ) : null}
                            </View>
                        </FormGroup>
                    </View>

                    {/* PRIORITY */}
                    <FormSectionLabel>Priority</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.segWrap}>
                                <SegRow
                                    options={PRIORITY_OPTIONS}
                                    selected={priority}
                                    onSelect={setPriority}
                                />
                            </View>
                        </FormGroup>
                    </View>

                    {/* NOTES */}
                    <FormSectionLabel>Notes</FormSectionLabel>
                    <View style={styles.section}>
                        <View
                            style={[
                                styles.notesCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Anything else worth remembering"
                                placeholderTextColor={colors.inkFaint}
                                multiline
                                numberOfLines={3}
                                editable={!submitting}
                                style={[
                                    styles.notesInput,
                                    { color: colors.text },
                                ]}
                            />
                        </View>
                    </View>

                    {/* SMART SUGGESTION — visual scaffold; AI/hand-off
                        detection backend isn't wired yet. */}
                    <View style={styles.section}>
                        <View
                            style={[
                                styles.suggestionCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.accent + '66',
                                },
                            ]}>
                            <Feather
                                name="zap"
                                size={14}
                                color={colors.accent}
                                style={{ marginTop: 1 }}
                            />
                            <View style={{ flex: 1 }}>
                                <ThemedText
                                    style={[
                                        styles.suggestionTitle,
                                        { color: colors.text },
                                    ]}>
                                    Smart suggestions
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.suggestionSub,
                                        { color: colors.inkFaint },
                                    ]}>
                                    We'll surface hand-off and recurrence
                                    suggestions here once the AI parse
                                    integration lands.
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {error ? (
                        <ThemedText
                            type="small"
                            style={[
                                styles.errorText,
                                { color: BrandColors.error },
                            ]}>
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
    scroll: { paddingBottom: Spacing.six },
    section: { paddingHorizontal: 16, paddingBottom: 12 },

    // Rows inside flush FormGroups
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    inlineLabel: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
        flexShrink: 0,
    },
    dueInline: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    dueAlertStripe: { paddingHorizontal: 14, paddingVertical: 6 },
    dueAlertText: { fontSize: 10, letterSpacing: 0.4 },

    // Reminder chips
    reminderChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        flex: 1,
        justifyContent: 'flex-end',
    },
    reminderChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    reminderChipText: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1 },

    // Chip blocks (Assigned / For / In lists)
    chipBlock: { padding: 12, gap: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chipExplain: { fontSize: 11, lineHeight: 16, marginTop: 2 },
    miniLabel: { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },

    // Priority SegRow
    segWrap: { padding: 12 },

    // Notes
    notesCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 12,
        minHeight: 80,
    },
    notesInput: {
        fontSize: 13,
        lineHeight: 18,
        textAlignVertical: 'top',
    },

    // Smart suggestion
    suggestionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    suggestionTitle: { fontSize: 12.5, fontWeight: '500', marginBottom: 2 },
    suggestionSub: { fontSize: 11, lineHeight: 16 },

    errorText: {
        paddingHorizontal: 16,
        paddingTop: Spacing.two,
    },
    pressed: { opacity: 0.7 },
});
