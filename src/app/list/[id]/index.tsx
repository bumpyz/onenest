// /list/[id]/index — read-mode List detail screen.
//
// Design source: screens-extra-3.jsx::ListDetail (canvas 05.2) from the
// Lists v2 / FAB consistency handoff.
//
// Surface shape (top-to-bottom):
//   1. Tinted hero — list-color gradient band, back chevron + share + more
//      buttons, color-tinted "LIST · N ITEMS" caps-mono pill, large name,
//      "Shared with …" subtitle, progress bar ("N OF M DONE · NN%").
//   2. Filter chip strip — All / Open / Done / Mine.
//   3. Quick-add row — single-line, Cmd-K vocabulary.
//   4. Open task sections — Today / This week / Later. Same bucketing
//      logic as the Lists tab so the row vocabulary is consistent (one
//      TaskRow primitive across the app).
//   5. Done section — collapsed by default.
//   6. "About this list" SGroup — Color (chevron to /edit), Default
//      assignee (deferred backend), Notify on add (deferred backend).
//   7. FAB "Add" — pill, accent fill, opens /task/new prefilled with
//      this list's id.
//
// Replaces the previous flat `/list/[id]` route, which was the edit form.
// The edit form moves to `/list/[id]/edit` and is reachable via:
//   • the "Color" row's chevron in the About section
//   • the top-right "more" pill button → opens an ActionSheet with Edit
//   • long-press / right-click on a list chip in the Lists tab (existing)

import { Feather } from '@expo/vector-icons';
import {
    Redirect,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    Chip,
    SGroup,
    SRow,
    SectionHeader,
    TaskRow,
} from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { MemberStack } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholdTasks } from '@/hooks/use-household-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useMyRole } from '@/hooks/use-my-role';
import { memberColorMap } from '@/lib/colors';
import {
    createTask,
    deleteTask,
    setTaskCompleted,
    setTaskLists,
    type List,
    type Task,
} from '@/lib/db';
import { FAB_SHADOW, withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type FilterMode = 'all' | 'open' | 'done' | 'mine';

export default function ListDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { user, session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const {
        lists,
        isLoading: listsLoading,
        refetch: refetchLists,
    } = useLists(household?.id);
    const { members } = useHouseholdMembers(household?.id);
    const {
        tasks,
        isLoading: tasksLoading,
        refetch: refetchTasks,
    } = useHouseholdTasks(household?.id);
    const { isCaregiver } = useMyRole(household?.id);

    // Refresh on focus so changes made in the sibling /edit screen (rename,
    // recolor, delete) are reflected the moment the user returns to the
    // detail surface. Without this, the user changes the list color in /edit,
    // pops back, and sees the old color until the next session-wide refetch.
    // Tasks too — covers the case where /task/[id] toggles complete or
    // deletes a row.
    useFocusEffect(
        useCallback(() => {
            refetchLists();
            refetchTasks();
        }, [refetchLists, refetchTasks]),
    );

    const list = useMemo(
        () => lists?.find((l) => l.id === id) ?? null,
        [lists, id],
    );

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    // Tasks belonging to this list. Inbox additionally absorbs tasks
    // with empty list_ids (orphaned by deletes), matching the Lists tab.
    const listTasks = useMemo<Task[]>(() => {
        if (!tasks || !list) return [];
        return tasks.filter((t) => {
            if (t.list_ids.includes(list.id)) return true;
            if (list.is_default && t.list_ids.length === 0) return true;
            return false;
        });
    }, [tasks, list]);

    const openTasks = useMemo(
        () => listTasks.filter((t) => !t.completed_at),
        [listTasks],
    );
    const doneTasks = useMemo(
        () => listTasks.filter((t) => !!t.completed_at),
        [listTasks],
    );

    // Filter chip selection. Drives which sections render. "All" shows
    // every bucket (Today / This week / Later / Done collapsed). The
    // other filters narrow the visible bucket set per the spec.
    const [filter, setFilter] = useState<FilterMode>('all');

    // Filtered list for "Mine" — assigned to me OR unassigned (Anyone).
    // Same rule as Lists tab + Sunday summary.
    const mineMatches = useCallback(
        (t: Task) =>
            t.assignee_profile_ids.length === 0 ||
            (!!user && t.assignee_profile_ids.includes(user.id)),
        [user],
    );

    type DueBucket = 'today' | 'thisWeek' | 'later';
    const openBuckets = useMemo(() => {
        const now = new Date();
        const startOfTodayMs = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();
        const startOfTomorrowMs = startOfTodayMs + 24 * 60 * 60 * 1000;
        const endOfWeekMs = startOfTodayMs + 7 * 24 * 60 * 60 * 1000;
        const buckets: Record<DueBucket, Task[]> = {
            today: [],
            thisWeek: [],
            later: [],
        };
        for (const t of openTasks) {
            // The Mine filter folds in here so the bucket counts reflect
            // what the user actually sees.
            if (filter === 'mine' && !mineMatches(t)) continue;
            if (!t.due_at) {
                buckets.later.push(t);
                continue;
            }
            const dueMs = new Date(t.due_at).getTime();
            // Overdue tasks roll up into Today per the spec — the spec
            // doesn't carve out a separate Overdue bucket for the list
            // detail surface (unlike the Lists tab). The TaskRow's own
            // overdue tinting still differentiates them inside the Today
            // section.
            if (dueMs < startOfTomorrowMs) buckets.today.push(t);
            else if (dueMs < endOfWeekMs) buckets.thisWeek.push(t);
            else buckets.later.push(t);
        }
        return buckets;
    }, [openTasks, filter, mineMatches]);

    // Counts feeding the filter chips. Computed off the unfiltered base
    // (mine intersect open) so toggling chips doesn't make the chip's
    // own count vanish.
    const allCount = listTasks.length;
    const openCount = openTasks.length;
    const doneCount = doneTasks.length;
    const mineCount = useMemo(
        () => listTasks.filter(mineMatches).length,
        [listTasks, mineMatches],
    );

    // Visible Done rows reflect the Mine filter. Filter='done' shows
    // done rows by definition; the other filters either hide done
    // (open / mine) or include it (all).
    const visibleDone = useMemo(() => {
        if (filter === 'mine') return doneTasks.filter(mineMatches);
        return doneTasks;
    }, [doneTasks, filter, mineMatches]);
    // The Done section is collapsed by default (spec: "Done · 4
    // collapsed") — tap to expand.
    const [doneExpanded, setDoneExpanded] = useState(false);
    // Show Done bucket whenever it has rows and the filter doesn't hide
    // them. Filter='open' explicitly hides done.
    const showDone = filter !== 'open' && visibleDone.length > 0;
    const showOpenBuckets = filter !== 'done';

    // Progress: done / total. Mirror the spec's "4 OF 12 DONE · 33%"
    // hero footer. Computed off the unfiltered list so the hero number
    // isn't lying about the user's progress because of the active chip.
    const total = listTasks.length;
    const progressPct =
        total > 0 ? Math.round((doneCount / total) * 100) : 0;

    // Quick-add wired exactly like the Lists tab. The FAB at the bottom
    // of this screen focuses this input rather than routing to a full
    // create form (v3 spec § List detail FAB → inline row). A ref +
    // focused-state flag drive both the focus and the "MORE FIELDS →"
    // escalation chip that appears once the input is active or has text.
    const [quickAddText, setQuickAddText] = useState('');
    const [adding, setAdding] = useState(false);
    const [quickAddFocused, setQuickAddFocused] = useState(false);
    const quickAddInputRef = useRef<TextInput | null>(null);
    const focusQuickAdd = useCallback(() => {
        quickAddInputRef.current?.focus();
    }, []);
    // Show the escalation/commit chrome any time the row is "live" — the
    // user is typing OR currently focused. Empty-and-blurred falls back
    // to the resting state (mono inkSec ↵ hint, no MORE FIELDS link).
    const quickAddActive = quickAddFocused || quickAddText.length > 0;
    const escalateToFullForm = useCallback(() => {
        if (!list) return;
        router.push({
            pathname: '/task/new',
            params: {
                listId: list.id,
                // Pass the typed text through so the user doesn't lose
                // it. /task/new accepts both params (see ParamTitle /
                // paramListId in src/app/task/new.tsx).
                ...(quickAddText.trim() ? { title: quickAddText.trim() } : {}),
            },
        });
        // Reset the inline row so re-entry doesn't double-prefill.
        setQuickAddText('');
        quickAddInputRef.current?.blur();
    }, [list, quickAddText, router]);
    const handleQuickAdd = useCallback(async () => {
        const trimmed = quickAddText.trim();
        if (!trimmed || !list || !household || adding) return;
        setAdding(true);
        try {
            await createTask(household.id, {
                title: trimmed,
                listIds: [list.id],
            });
            setQuickAddText('');
            await refetchTasks();
        } catch (err) {
            console.error('quick add failed', err);
        } finally {
            setAdding(false);
        }
    }, [quickAddText, list, household, adding, refetchTasks]);

    const handleToggleComplete = useCallback(
        async (task: Task) => {
            try {
                await setTaskCompleted(task.id, !task.completed_at);
                await refetchTasks();
            } catch (err) {
                console.error('toggle complete failed', err);
            }
        },
        [refetchTasks],
    );

    const handleTapTask = useCallback(
        (task: Task) => {
            router.push({ pathname: '/task/[id]', params: { id: task.id } });
        },
        [router],
    );

    const handleDeleteTask = useCallback(
        async (task: Task) => {
            try {
                await deleteTask(task.id);
                await refetchTasks();
            } catch (err) {
                console.error('delete task failed', err);
            }
        },
        [refetchTasks],
    );

    const handleToggleTaskList = useCallback(
        async (task: Task, listId: string) => {
            const next = task.list_ids.includes(listId)
                ? task.list_ids.filter((x) => x !== listId)
                : [...task.list_ids, listId];
            try {
                await setTaskLists(task.id, next);
                await refetchTasks();
            } catch (err) {
                console.error('toggle task list failed', err);
            }
        },
        [refetchTasks],
    );

    // Single-row expand state for cross-list pills. Matches Lists tab UX.
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    const loading =
        authLoading || householdsLoading || listsLoading || tasksLoading;
    if (loading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Bounce back if the list was deleted in another tab/session.
    if (!list) return <Redirect href="/lists" />;

    const listColor = list.color;

    // Members who share this household form the "Shared with …" caption.
    // Excludes the current user from the name list (otherwise it reads
    // "Shared with me, Alex" which is weird) but keeps them in the
    // avatar stack so the user's own identity is still represented.
    const otherMembers = (members ?? []).filter(
        (m) => !user || m.profile_id !== user.id,
    );
    const sharedNames = otherMembers
        .map((m) => m.display_name?.split(' ')[0] ?? '')
        .filter(Boolean)
        .join(' & ');
    // Adapt household-member rows to MemberStack's StackMember shape:
    // name + color + key. Identity color is sourced from the colorMap
    // built at the top of the screen (same map TaskRow uses, so the
    // hero avatars and the task-row avatars stay in lock-step).
    const stackMembers = (members ?? []).map((m) => ({
        name: m.display_name ?? '',
        color: colorMap.get(m.profile_id) ?? colors.textSecondary,
        key: m.profile_id,
    }));

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    {/* Tinted hero — list-color gradient is faked here with
                        a single tinted band (RN-web's LinearGradient
                        support varies; a flat tint reads identically at
                        the design's 22%/10% alpha). */}
                    <View
                        style={[
                            styles.hero,
                            {
                                backgroundColor: withAlpha(
                                    listColor,
                                    scheme === 'dark' ? 0x38 / 255 : 0x22 / 255,
                                ),
                            },
                        ]}>
                        <View style={styles.heroTopRow}>
                            <Pressable
                                onPress={() => router.back()}
                                accessibilityRole="button"
                                accessibilityLabel="Back to lists"
                                style={({ pressed }) => [
                                    styles.pillBtn,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="chevron-left"
                                    size={16}
                                    color={colors.text}
                                />
                            </Pressable>
                            <View style={styles.heroTopRowRight}>
                                {/* Share button — placeholder. Future
                                    work: share sheet for list URL /
                                    invite-to-list. Tracked separately;
                                    visual presence completes the hero
                                    per the spec. */}
                                <View
                                    style={[
                                        styles.pillBtn,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                            opacity: 0.5,
                                        },
                                    ]}>
                                    <Feather
                                        name="share"
                                        size={14}
                                        color={colors.text}
                                    />
                                </View>
                                {/* "More" pill — opens the edit form per
                                    the spec. Long-press on chips remains
                                    the secondary entry from the Lists
                                    tab. */}
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: '/list/[id]/edit',
                                            params: { id: list.id },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit list"
                                    style={({ pressed }) => [
                                        styles.pillBtn,
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
                            </View>
                        </View>

                        <View style={styles.heroBody}>
                            {/* Color-tinted caps-mono pill — "LIST · N ITEMS" */}
                            <View
                                style={[
                                    styles.listPill,
                                    {
                                        backgroundColor: withAlpha(
                                            listColor,
                                            0x33 / 255,
                                        ),
                                        borderColor: withAlpha(
                                            listColor,
                                            0x77 / 255,
                                        ),
                                    },
                                ]}>
                                <View
                                    style={[
                                        styles.listPillDot,
                                        { backgroundColor: listColor },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.listPillText,
                                        {
                                            color: colors.text,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    LIST · {total} ITEMS
                                </ThemedText>
                            </View>

                            <ThemedText style={[styles.name, { color: colors.text }]}>
                                {list.name}
                            </ThemedText>

                            <View style={styles.subtitleRow}>
                                {stackMembers.length > 0 ? (
                                    <MemberStack
                                        members={stackMembers}
                                        size="sm"
                                    />
                                ) : null}
                                <ThemedText
                                    style={[
                                        styles.subtitleText,
                                        { color: colors.textSecondary },
                                    ]}>
                                    {sharedNames
                                        ? `Shared with ${sharedNames}`
                                        : 'Just you'}
                                </ThemedText>
                            </View>

                            {/* Progress strip — "N OF M DONE" left,
                                "NN%" right (color-tinted), then a 6px
                                track with a color-tinted fill. Mirrors
                                the spec's hero footer. */}
                            {total > 0 ? (
                                <View style={styles.progressBlock}>
                                    <View style={styles.progressLabelRow}>
                                        <ThemedText
                                            style={[
                                                styles.progressLabel,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                },
                                            ]}>
                                            {doneCount} OF {total} DONE
                                        </ThemedText>
                                        <ThemedText
                                            style={[
                                                styles.progressPct,
                                                {
                                                    color: listColor,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            {progressPct}%
                                        </ThemedText>
                                    </View>
                                    <View
                                        style={[
                                            styles.progressTrack,
                                            {
                                                backgroundColor:
                                                    colors.backgroundElement,
                                                borderColor: colors.hair,
                                            },
                                        ]}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${progressPct}%`,
                                                    backgroundColor: listColor,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {/* Filter chips — All / Open / Done / Mine. Each chip
                        shows its scoped count. Tap to set the active
                        filter. */}
                    <View style={styles.chipRow}>
                        <Chip
                            label={`All · ${allCount}`}
                            active={filter === 'all'}
                            onPress={() => setFilter('all')}
                        />
                        <Chip
                            label={`Open · ${openCount}`}
                            active={filter === 'open'}
                            onPress={() => setFilter('open')}
                        />
                        <Chip
                            label={`Done · ${doneCount}`}
                            active={filter === 'done'}
                            onPress={() => setFilter('done')}
                        />
                        <Chip
                            label={`Mine · ${mineCount}`}
                            active={filter === 'mine'}
                            onPress={() => setFilter('mine')}
                        />
                    </View>

                    {/* Quick-add row — same vocabulary as the Lists tab.
                        Caregivers don't see it; RLS blocks INSERTs
                        anyway. */}
                    {!isCaregiver ? (
                        <View
                            style={[
                                styles.quickAddRow,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    // Active state borders with accent so
                                    // the user knows tapping the FAB landed
                                    // them in the row.
                                    borderColor: quickAddActive
                                        ? colors.accent
                                        : colors.hair,
                                },
                            ]}>
                            <Feather
                                name="plus"
                                size={14}
                                color={colors.textSecondary}
                            />
                            <TextInput
                                ref={quickAddInputRef}
                                value={quickAddText}
                                onChangeText={setQuickAddText}
                                onSubmitEditing={handleQuickAdd}
                                onFocus={() => setQuickAddFocused(true)}
                                onBlur={() => setQuickAddFocused(false)}
                                placeholder="Add item — use @ for assignee"
                                placeholderTextColor={colors.inkFaint}
                                returnKeyType="done"
                                editable={!adding}
                                style={[
                                    styles.quickAddInput,
                                    {
                                        color: colors.text,
                                        fontFamily: FontFamily.monoRegular,
                                    },
                                ]}
                            />
                            {/* "MORE FIELDS →" escalation — only rendered
                                when the row is active. Routes to /task/new
                                with the typed text + list pre-filled so the
                                user lands in the full form mid-thought
                                without retyping. */}
                            {quickAddActive ? (
                                <Pressable
                                    onPress={escalateToFullForm}
                                    accessibilityRole="button"
                                    accessibilityLabel="Open full task form"
                                    style={({ pressed }) => [
                                        styles.moreFieldsLink,
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.moreFieldsLabel,
                                            {
                                                color: colors.accent,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        MORE FIELDS
                                    </ThemedText>
                                    <Feather
                                        name="chevron-right"
                                        size={10}
                                        color={colors.accent}
                                    />
                                </Pressable>
                            ) : null}
                            {/* ↵ commit chip. v3 spec: accent-filled when
                                the row is live (a tap commits the typed
                                text via handleQuickAdd); muted otherwise.
                                Tap target so users on web can submit
                                without finding the Enter key. */}
                            <Pressable
                                onPress={handleQuickAdd}
                                disabled={
                                    !quickAddText.trim() || adding
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Add task"
                                style={({ pressed }) => [
                                    styles.kbdBadge,
                                    {
                                        backgroundColor: quickAddActive
                                            ? colors.accent
                                            : colors.backgroundInset,
                                    },
                                    (!quickAddText.trim() || adding) && {
                                        opacity: 0.4,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.kbdBadgeText,
                                        {
                                            color: quickAddActive
                                                ? colors.onAccent
                                                : colors.textSecondary,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ↵
                                </ThemedText>
                            </Pressable>
                        </View>
                    ) : null}

                    {/* Open buckets — Today / This week / Later. */}
                    {showOpenBuckets && openBuckets.today.length > 0 ? (
                        <BucketSection
                            label="Today"
                            tasks={openBuckets.today}
                            members={members ?? []}
                            colorMap={colorMap}
                            lists={lists ?? []}
                            listId={list.id}
                            expandedRowId={expandedRowId}
                            setExpandedRowId={setExpandedRowId}
                            onToggleTaskList={handleToggleTaskList}
                            onToggleComplete={handleToggleComplete}
                            onTapTask={handleTapTask}
                            onDeleteTask={handleDeleteTask}
                            colors={colors}
                        />
                    ) : null}
                    {showOpenBuckets && openBuckets.thisWeek.length > 0 ? (
                        <BucketSection
                            label="This week"
                            tasks={openBuckets.thisWeek}
                            members={members ?? []}
                            colorMap={colorMap}
                            lists={lists ?? []}
                            listId={list.id}
                            expandedRowId={expandedRowId}
                            setExpandedRowId={setExpandedRowId}
                            onToggleTaskList={handleToggleTaskList}
                            onToggleComplete={handleToggleComplete}
                            onTapTask={handleTapTask}
                            onDeleteTask={handleDeleteTask}
                            colors={colors}
                        />
                    ) : null}
                    {showOpenBuckets && openBuckets.later.length > 0 ? (
                        <BucketSection
                            label="Later"
                            tasks={openBuckets.later}
                            members={members ?? []}
                            colorMap={colorMap}
                            lists={lists ?? []}
                            listId={list.id}
                            expandedRowId={expandedRowId}
                            setExpandedRowId={setExpandedRowId}
                            onToggleTaskList={handleToggleTaskList}
                            onToggleComplete={handleToggleComplete}
                            onTapTask={handleTapTask}
                            onDeleteTask={handleDeleteTask}
                            colors={colors}
                        />
                    ) : null}

                    {/* Done — collapsed by default. Tap header to expand. */}
                    {showDone ? (
                        <View style={styles.bucketSection}>
                            <Pressable
                                onPress={() =>
                                    setDoneExpanded((v) => !v)
                                }
                                accessibilityRole="button"
                                accessibilityLabel={
                                    doneExpanded
                                        ? 'Collapse done section'
                                        : 'Expand done section'
                                }
                                style={({ pressed }) => [
                                    styles.bucketHeaderRow,
                                    pressed && styles.pressed,
                                ]}>
                                <View style={styles.bucketHeaderShim}>
                                    <SectionHeader
                                        label="Done"
                                        count={visibleDone.length}
                                    />
                                </View>
                                <Feather
                                    name={
                                        doneExpanded
                                            ? 'chevron-up'
                                            : 'chevron-down'
                                    }
                                    size={14}
                                    color={colors.textSecondary}
                                />
                            </Pressable>
                            {doneExpanded ? (
                                <View
                                    style={[
                                        styles.bucketCard,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {visibleDone.map((t, i) => (
                                        <TaskRow
                                            key={t.id}
                                            task={t}
                                            members={members ?? []}
                                            colorMap={colorMap}
                                            allLists={lists ?? []}
                                            activeListId={list.id}
                                            expanded={expandedRowId === t.id}
                                            onToggleExpanded={() =>
                                                setExpandedRowId((curr) =>
                                                    curr === t.id ? null : t.id,
                                                )
                                            }
                                            onToggleList={(listId) =>
                                                handleToggleTaskList(t, listId)
                                            }
                                            onToggle={() =>
                                                handleToggleComplete(t)
                                            }
                                            onTap={() => handleTapTask(t)}
                                            onDelete={() =>
                                                handleDeleteTask(t)
                                            }
                                            isLast={i === visibleDone.length - 1}
                                        />
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {/* Empty state when no buckets render. */}
                    {showOpenBuckets &&
                    openBuckets.today.length === 0 &&
                    openBuckets.thisWeek.length === 0 &&
                    openBuckets.later.length === 0 &&
                    !showDone ? (
                        <View style={styles.empty}>
                            <ThemedText themeColor="textSecondary">
                                {filter === 'mine'
                                    ? 'Nothing assigned to you here.'
                                    : 'No tasks yet. Type one above to get started.'}
                            </ThemedText>
                        </View>
                    ) : null}

                    {/* About this list — Color (tap to /edit), Default
                        assignee (deferred backend), Notify on add
                        (deferred backend). Mirrors the spec's "About this
                        list" SGroup. SGroup owns its caps label so we
                        don't render one manually here. */}
                    <SGroup label="About this list">
                        <SRow
                            label="Color"
                            right={
                                <View
                                    style={[
                                        styles.colorSwatch,
                                        {
                                            backgroundColor: listColor,
                                            borderColor: colors.hair,
                                        },
                                    ]}
                                />
                            }
                            chevron
                            onPress={() =>
                                router.push({
                                    pathname: '/list/[id]/edit',
                                    params: { id: list.id },
                                })
                            }
                        />
                        {/* Default assignee — placeholder. Schema doesn't
                            track this yet; row is rendered for visual
                            parity with the spec so the SGroup doesn't
                            look truncated. Tap is wired to /edit so the
                            user reaches *some* edit surface, but the
                            field itself is read-only here. Tracked as a
                            backend follow-up. */}
                        <SRow
                            label="Default assignee"
                            right={
                                <ThemedText
                                    style={[
                                        styles.aboutRowValue,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoRegular,
                                        },
                                    ]}>
                                    Anyone
                                </ThemedText>
                            }
                            chevron
                            onPress={() =>
                                router.push({
                                    pathname: '/list/[id]/edit',
                                    params: { id: list.id },
                                })
                            }
                        />
                        {/* Notify on add — placeholder. Same backend
                            follow-up as Default assignee. Renders as a
                            non-interactive read-only state for now.
                            `last` suppresses its bottom border so the
                            card's own bottom edge is the visual end. */}
                        <SRow
                            label="Notify on add"
                            right={
                                <ThemedText
                                    style={[
                                        styles.aboutRowValue,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoRegular,
                                        },
                                    ]}>
                                    Off
                                </ThemedText>
                            }
                            last
                        />
                    </SGroup>
                </ScrollView>
            </SafeAreaView>

            {/* FAB — "New task" pill per the v3 spec
                (onenest-spec-v3/design_handoff_calendar_conflicts §List
                detail FAB → inline row). Unlike every other kind-
                committed FAB in the app, this one does NOT open a full
                create form — it focuses the inline quick-add row at the
                top of the screen instead. Faster for grocery-style
                rapid-entry (type, ↵, type, ↵). The escalation to the
                full form is reached via the "MORE FIELDS →" link inside
                the row when the user needs assignee / due / lists.
                Caregivers can't create tasks; FAB hidden for them
                (server RLS would block the insert anyway). */}
            {!isCaregiver ? (
                <Pressable
                    onPress={focusQuickAdd}
                    accessibilityRole="button"
                    accessibilityLabel="New task"
                    style={({ pressed }) => [
                        styles.fab,
                        { backgroundColor: colors.accent },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="plus" size={18} color={colors.onAccent} />
                    <ThemedText
                        style={[
                            styles.fabText,
                            { color: colors.onAccent },
                        ]}>
                        New task
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

/**
 * BucketSection — caps section header + count above a single white card
 * containing the TaskRow rows. Mirrors the Lists tab's TaskBucketSection
 * minus the Overdue color override (the spec doesn't surface a separate
 * Overdue bucket on the list detail surface).
 */
function BucketSection({
    label,
    tasks,
    members,
    colorMap,
    lists,
    listId,
    expandedRowId,
    setExpandedRowId,
    onToggleTaskList,
    onToggleComplete,
    onTapTask,
    onDeleteTask,
    colors,
}: {
    label: string;
    tasks: Task[];
    members: { profile_id: string; display_name: string }[];
    colorMap: Map<string, string>;
    lists: List[];
    listId: string;
    expandedRowId: string | null;
    setExpandedRowId: (
        updater: (curr: string | null) => string | null,
    ) => void;
    onToggleTaskList: (task: Task, listId: string) => void;
    onToggleComplete: (task: Task) => void;
    onTapTask: (task: Task) => void;
    onDeleteTask: (task: Task) => void;
    colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
}) {
    return (
        <View style={styles.bucketSection}>
            <View style={styles.bucketHeaderRow}>
                <View style={styles.bucketHeaderShim}>
                    <SectionHeader label={label} count={tasks.length} />
                </View>
            </View>
            <View
                style={[
                    styles.bucketCard,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {tasks.map((t, i) => (
                    <TaskRow
                        key={t.id}
                        task={t}
                        members={members}
                        colorMap={colorMap}
                        allLists={lists}
                        activeListId={listId}
                        expanded={expandedRowId === t.id}
                        onToggleExpanded={() =>
                            setExpandedRowId((curr) =>
                                curr === t.id ? null : t.id,
                            )
                        }
                        onToggleList={(lid) => onToggleTaskList(t, lid)}
                        onToggle={() => onToggleComplete(t)}
                        onTap={() => onTapTask(t)}
                        onDelete={() => onDeleteTask(t)}
                        isLast={i === tasks.length - 1}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 100 },
    // ── Hero ───────────────────────────────────────────────────────────
    // List-color tinted band at the top. Background alpha is applied
    // inline at the render site so the same shape works for both light
    // and dark schemes (different alpha targets).
    hero: {
        paddingTop: 8,
        paddingBottom: 20,
    },
    heroTopRow: {
        paddingHorizontal: 16,
        paddingBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroTopRowRight: { flexDirection: 'row', gap: 8 },
    pillBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroBody: {
        paddingHorizontal: 24,
        paddingTop: 14,
    },
    listPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 10,
    },
    listPillDot: { width: 6, height: 6, borderRadius: 3 },
    listPillText: {
        fontSize: 10,
        letterSpacing: 0.3,
    },
    name: {
        fontSize: 30,
        fontWeight: '600',
        letterSpacing: -1,
        lineHeight: 33,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    subtitleText: {
        fontSize: 12,
        letterSpacing: -0.1,
    },
    progressBlock: { marginTop: 14 },
    progressLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: { fontSize: 10, letterSpacing: -0.2 },
    progressPct: { fontSize: 10, letterSpacing: -0.2 },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    // ── Filter chips ───────────────────────────────────────────────────
    chipRow: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
    },
    // ── Quick add ──────────────────────────────────────────────────────
    quickAddRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    quickAddInput: {
        flex: 1,
        fontSize: 12,
        letterSpacing: -0.2,
        paddingVertical: 0,
    },
    kbdBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 3,
    },
    kbdBadgeText: { fontSize: 9.5, letterSpacing: -0.2 },
    // "MORE FIELDS →" accent escalation link — appears only when the
    // inline quick-add row is active. v3 spec § List detail FAB →
    // inline row. Mono caps 10/600 accent, gap of 2 between label and
    // chevron. Tap routes to /task/new with title + list pre-filled.
    moreFieldsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 4,
    },
    moreFieldsLabel: {
        fontSize: 10,
        letterSpacing: 0.3,
    },
    // ── Buckets ────────────────────────────────────────────────────────
    bucketSection: {
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    bucketHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingBottom: Spacing.two,
    },
    bucketHeaderShim: { flex: 1 },
    bucketCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    empty: { padding: 24, alignItems: 'center' },
    // ── About this list ───────────────────────────────────────────────
    aboutRowValue: { fontSize: 12, letterSpacing: -0.2 },
    colorSwatch: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: StyleSheet.hairlineWidth,
    },
    // ── FAB ────────────────────────────────────────────────────────────
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 28,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        ...FAB_SHADOW,
    },
    fabText: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
