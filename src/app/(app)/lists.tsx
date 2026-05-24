// Lists tab — shows every task in the household, grouped by list.
//
// Layout (top to bottom):
//   * Sticky chip row: one chip per list (Inbox first) + "+ New" chip. Tap to select.
//     The active list is filled with its color; inactive lists are outlined. Tapping
//     the "edit pencil" inside the active chip opens /list/[id] for renaming /
//     recoloring / deleting (Inbox can be renamed/recolored but not deleted).
//   * Quick-add: text input + Add button. Creates a task in the active list with
//     no due date and no assignees. The user can tap into the task afterward to set
//     those, but the friction-free fast path stays one line of text + Enter.
//   * Task sections: "Open" first (incomplete), "Completed" collapsed below it.
//     Each row: checkbox + title + meta chips (due / event link / assignees).
//     Checkbox flips immediate via setTaskCompleted; tapping the title opens the
//     linked event (event-linked tasks) or /task/[id] (standalone). Event-linked
//     tasks show a 📅 chip so the source of truth is obvious.

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import {
    ScrollOverflowChevron,
    useHorizontalOverflow,
} from '@/components/scroll-overflow-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { FAB_SHADOW } from '@/lib/platform-styles';
import { useChildren } from '@/hooks/use-children';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholdTasks } from '@/hooks/use-household-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import {
    createTask,
    deleteTask,
    setTaskCompleted,
    setTaskLists,
    updateList,
    type List as TaskList,
    type Task,
} from '@/lib/db';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

// Scope toggle: "Mine" filters to tasks assigned to me OR unassigned ("Anyone"),
// matching the Home digest's rule and the Sunday-summary edge function; "All" shows
// every task in the active list. Session-scoped state — defaults to Mine so the tab
// opens on the user's own work, with All available as one tap away when they need
// the household inventory.
type Scope = 'mine' | 'all';

// View mode toggle: "By list" groups tasks by their list memberships (chip strip
// shows lists). "By child" groups by which kid the task is tagged with (chip strip
// shows children). Session-scoped state — most users will live in by-list, by-child
// is the "show me Anna's open work" lens.
type ViewMode = 'by-list' | 'by-child';

export default function ListsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { user } = useAuth();
    const { households } = useHouseholds();
    const household = households?.[0];
    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    const { children, refetch: refetchChildren } = useChildren(household?.id);
    const { lists, isLoading: listsLoading, refetch: refetchLists } = useLists(
        household?.id,
    );
    const {
        tasks,
        isLoading: tasksLoading,
        refetch: refetchTasks,
    } = useHouseholdTasks(household?.id);

    // Active-list selection. null while lists are still loading; once we have lists
    // we default to the first one (Inbox by sort_order). Persisting this between
    // sessions wasn't worth the complexity — users will reach for Inbox or whichever
    // list they care about quickly enough.
    // View mode toggle. Lives above the chip strip; defaults to by-list since most
    // households think list-first ("what's in Groceries?") before child-first
    // ("what's pending for Anna?").
    const [viewMode, setViewMode] = useState<ViewMode>('by-list');
    const [activeListId, setActiveListId] = useState<string | null>(null);
    // Active child id when in by-child mode. null = show every task tagged with at
    // least one child (rare; usually you'd pick a specific kid).
    const [activeChildId, setActiveChildId] = useState<string | null>(null);
    useEffect(() => {
        // Seed once after lists hydrate. If the active list disappears (deleted in
        // another tab), fall back to the first remaining list so the screen never
        // shows the "no list selected" empty state for a recoverable state.
        if (!lists || lists.length === 0) return;
        if (activeListId === null || !lists.find((l) => l.id === activeListId)) {
            setActiveListId(lists[0].id);
        }
    }, [lists, activeListId]);
    useEffect(() => {
        // Same pattern for the active child id: seed on first hydration, recover if
        // the previously-active child was deleted.
        if (!children || children.length === 0) return;
        if (
            activeChildId === null ||
            !children.find((c) => c.id === activeChildId)
        ) {
            setActiveChildId(children[0].id);
        }
    }, [children, activeChildId]);

    const [quickAddText, setQuickAddText] = useState('');
    const [adding, setAdding] = useState(false);
    const [scope, setScope] = useState<Scope>('mine');
    // Which row, if any, has the "add to other lists" panel expanded. Keeping it
    // single-row (only one expanded at a time) keeps the screen quiet — tapping a
    // different row's pill collapses the previous one. Session-scoped state.
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    // ─── Bulk-select mode ──────────────────────────────────────────────────────
    // When selectionMode is on, row taps toggle membership in selectedTaskIds
    // instead of navigating to the task/event. A bulk action bar pinned to the
    // bottom of the screen surfaces actions for the selected rows.
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
        () => new Set(),
    );
    // The list picker inside the action bar opens inline when the user taps "Add
    // to list…" — separate from the per-row expand state above.
    const [bulkAddListOpen, setBulkAddListOpen] = useState(false);
    // Resets selection state when the user exits select mode. Wrapped so the
    // cancel button and the "after action" cleanup share a single path.
    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setSelectedTaskIds(new Set());
        setBulkAddListOpen(false);
    }, []);
    const toggleTaskSelected = useCallback((taskId: string) => {
        setSelectedTaskIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    // ─── Drag-to-reorder (web only) ─────────────────────────────────────────────
    // The chip strip renders in the lists[] order at all times — we don't shuffle
    // chips around during the drag. Instead we surface a vertical "drop bar" between
    // the chips so the user can see exactly where the dragged chip will land on
    // release. Less smooth than a true sliding reorder but ~10× simpler to get right.
    //
    // dropIndex semantics: position in lists[] where the dragged chip would be
    // inserted. fromIndex 1 + dropIndex 3 = "move chip 1 to slot 3" (which shifts
    // others left). dropIndex === fromIndex OR fromIndex + 1 are no-ops (chip stays
    // in its current slot in either case).
    //
    // Inbox is pinned at index 0: not draggable, and dropIndex is clamped to >= 1
    // so nothing lands ahead of it. Keeping Inbox first is a convention the rest of
    // the app relies on (it's the auto-default-task target).
    type DragState = { fromIndex: number; dropIndex: number };
    const [dragState, setDragState] = useState<DragState | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const setDrag = useCallback((next: DragState | null) => {
        dragStateRef.current = next;
        setDragState(next);
    }, []);
    const chipRefs = useRef<Array<HTMLElement | null>>([]);
    const chipRowRef = useRef<HTMLElement | null>(null);
    // UX-010: visual hint when more chips exist offscreen to the right. Plays
    // nicely with the existing chipRefs / drag-to-reorder because we only add
    // handler props to the ScrollView — its internals are untouched.
    const chipOverflow = useHorizontalOverflow();
    // QA-010: in-flight drag's window-level handlers, so the outer
    // attach-pointerdown effect's cleanup can detach them if it re-runs (or
    // the screen unmounts) mid-drag. Without this, switching tabs or having
    // lists refetch mid-drag leaves window listeners bound to a stale closure.
    const activeDragHandlersRef = useRef<{
        onMove: (e: PointerEvent) => void;
        onUp: (e: PointerEvent) => void;
    } | null>(null);
    useEffect(() => {
        // Trim stale refs when the list count changes.
        chipRefs.current.length = lists?.length ?? 0;
    }, [lists?.length]);

    /** Persists a new chip ordering. Inbox stays at sort_order=0; user lists get
     *  i*100 so future inserts have headroom to land in between without renumbering. */
    const saveReorder = useCallback(
        async (newOrder: TaskList[]) => {
            await Promise.all(
                newOrder.map((l, idx) => {
                    if (l.is_default) return Promise.resolve();
                    if (l.sort_order === idx * 100) return Promise.resolve();
                    return updateList(l.id, { sortOrder: idx * 100 });
                }),
            );
            await refetchLists();
        },
        [refetchLists],
    );

    const handleChipPointerDown = useCallback(
        (e: PointerEvent, fromIndex: number) => {
            if (Platform.OS !== 'web') return;
            if (e.button !== 0) return;
            if (!lists) return;
            // Bail when the click landed on the pencil edit button — we want that to
            // open /list/[id], not start a drag.
            const target = e.target as HTMLElement | null;
            if (target?.closest('[data-chip-edit]')) return;
            const list = lists[fromIndex];
            if (!list || list.is_default) return; // Inbox not draggable
            e.preventDefault();
            setDrag({ fromIndex, dropIndex: fromIndex });

            const onMove = (ev: PointerEvent) => {
                const cursorX = ev.clientX;
                let drop = fromIndex;
                // Walk the chips in their rendered order; the first chip whose mid-X
                // is past the cursor becomes the insertion target.
                const rects = chipRefs.current.map((c) =>
                    c?.getBoundingClientRect() ?? null,
                );
                let placed = false;
                for (let i = 1; i < rects.length; i++) {
                    const r = rects[i];
                    if (!r) continue;
                    if (cursorX < r.left + r.width / 2) {
                        drop = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) drop = rects.length;
                // Never insert before Inbox.
                if (drop < 1) drop = 1;
                setDrag({ fromIndex, dropIndex: drop });
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                activeDragHandlersRef.current = null;
                const curr = dragStateRef.current;
                setDrag(null);
                if (!curr || !lists) return;
                const { fromIndex: from, dropIndex: to } = curr;
                // Move semantics: if to === from or from+1, the chip stays in place.
                if (to === from || to === from + 1) return;
                const newOrder = [...lists];
                const [moved] = newOrder.splice(from, 1);
                // After the splice, indexes shift — adjust the target if the move was
                // forwards.
                const adjustedTo = to > from ? to - 1 : to;
                newOrder.splice(adjustedTo, 0, moved);
                saveReorder(newOrder).catch((err) =>
                    console.error('reorder save failed', err),
                );
            };

            activeDragHandlersRef.current = { onMove, onUp };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        },
        [lists, setDrag, saveReorder],
    );

    // Attach native pointerdown to each chip DOM node. We do this imperatively rather
    // than via JSX onPointerDown because RN doesn't surface pointer events on
    // Pressable — react-native-web's View ref IS the underlying div, so we can reach
    // for addEventListener directly. Same pattern as the calendar's drag-to-create.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!lists) return;
        const cleanups: Array<() => void> = [];
        chipRefs.current.forEach((el, idx) => {
            if (!el) return;
            const onDown = (e: PointerEvent) => handleChipPointerDown(e, idx);
            // Capture phase: my listener fires on the way DOWN to the target,
            // before the inner Pressable can stopPropagation() in its target-phase
            // handler. Without this the pointerdown never bubbles back to the
            // wrapper and the drag never starts when clicking on the chip body.
            el.addEventListener('pointerdown', onDown, true);
            cleanups.push(() => el.removeEventListener('pointerdown', onDown, true));
        });
        return () => {
            cleanups.forEach((c) => c());
            // Detach the in-flight drag's window listeners on lists refetch /
            // unmount so they don't fire against stale lists data once the
            // closure goes out of scope (QA-010).
            const active = activeDragHandlersRef.current;
            if (active) {
                window.removeEventListener('pointermove', active.onMove);
                window.removeEventListener('pointerup', active.onUp);
                activeDragHandlersRef.current = null;
                setDrag(null);
            }
        };
    }, [lists, handleChipPointerDown, setDrag]);

    useFocusEffect(
        useCallback(() => {
            refetchLists();
            refetchTasks();
            refetchMembers();
            refetchChildren();
        }, [refetchLists, refetchTasks, refetchMembers, refetchChildren]),
    );

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    const activeList: TaskList | null = useMemo(
        () => lists?.find((l) => l.id === activeListId) ?? null,
        [lists, activeListId],
    );
    const activeChild = useMemo(
        () => children?.find((c) => c.id === activeChildId) ?? null,
        [children, activeChildId],
    );

    // Open-task count per list. With multi-list, a task contributes to every list
    // it's in (so "Buy cake" in Urgent + Groceries counts in both chips). Inbox
    // absorbs tasks whose list_ids is empty (orphaned by a deleted list) so the
    // chip's count matches what the task pane actually shows.
    const openCountByListId = useMemo<Map<string, number>>(() => {
        const map = new Map<string, number>();
        if (!tasks || !lists) return map;
        const inboxId = lists.find((l) => l.is_default)?.id ?? null;
        for (const t of tasks) {
            if (t.completed_at) continue;
            if (t.list_ids.length === 0) {
                if (inboxId) map.set(inboxId, (map.get(inboxId) ?? 0) + 1);
                continue;
            }
            for (const lid of t.list_ids) {
                map.set(lid, (map.get(lid) ?? 0) + 1);
            }
        }
        return map;
    }, [tasks, lists]);

    // Open-task count per child. Same pattern as openCountByListId; a task with
    // multiple child tags counts in each kid's chip independently.
    const openCountByChildId = useMemo<Map<string, number>>(() => {
        const map = new Map<string, number>();
        if (!tasks) return map;
        for (const t of tasks) {
            if (t.completed_at) continue;
            for (const cid of t.child_ids) {
                map.set(cid, (map.get(cid) ?? 0) + 1);
            }
        }
        return map;
    }, [tasks]);

    // Tasks visible under the active chip. Behavior differs by viewMode:
    //   - by-list: tasks whose list_ids includes the active list (Inbox also catches
    //     orphans with empty list_ids).
    //   - by-child: tasks whose child_ids includes the active child.
    const listTasks = useMemo<Task[]>(() => {
        if (!tasks) return [];
        if (viewMode === 'by-child') {
            if (!activeChildId) return [];
            return tasks.filter((t) => t.child_ids.includes(activeChildId));
        }
        if (!activeList) return [];
        return tasks.filter((t) => {
            if (t.list_ids.includes(activeList.id)) return true;
            if (activeList.is_default && t.list_ids.length === 0) return true;
            return false;
        });
    }, [tasks, viewMode, activeList, activeChildId]);

    // Apply the scope filter on top of the list filter. "All" passes through; "Mine"
    // keeps tasks assigned to me OR unassigned (the Anyone bucket — anyone in the
    // household could pick it up, so it's plausibly mine to do). Same rule as the
    // Home digest and Sunday summary.
    const visibleTasks = useMemo<Task[]>(() => {
        if (scope === 'all') return listTasks;
        return listTasks.filter(
            (t) =>
                t.assignee_profile_ids.length === 0 ||
                (!!user && t.assignee_profile_ids.includes(user.id)),
        );
    }, [listTasks, scope, user]);

    const openTasks = useMemo(
        () => visibleTasks.filter((t) => !t.completed_at),
        [visibleTasks],
    );
    const completedTasks = useMemo(
        () => visibleTasks.filter((t) => !!t.completed_at),
        [visibleTasks],
    );
    // Count of tasks hidden by the Mine filter — surfaced in the All/Mine toggle so
    // the user knows there's more household work behind the filter without having to
    // toggle back to see.
    const hiddenByScope =
        scope === 'mine' ? listTasks.length - visibleTasks.length : 0;

    const handleQuickAdd = async () => {
        const trimmed = quickAddText.trim();
        if (!trimmed || !household || adding) return;
        // By-list mode: file into the active list. By-child mode: tag the active
        // child and let Inbox catch it via createTask's default. Either way the
        // resulting task shows up under the current chip without extra clicks.
        if (viewMode === 'by-list' && !activeList) return;
        if (viewMode === 'by-child' && !activeChildId) return;
        setAdding(true);
        try {
            await createTask(household.id, {
                title: trimmed,
                ...(viewMode === 'by-list' && activeList
                    ? { listIds: [activeList.id] }
                    : {}),
                ...(viewMode === 'by-child' && activeChildId
                    ? { childIds: [activeChildId] }
                    : {}),
            });
            setQuickAddText('');
            await refetchTasks();
        } catch (err) {
            console.error('quick add failed', err);
        } finally {
            setAdding(false);
        }
    };

    const handleToggleComplete = async (task: Task) => {
        try {
            await setTaskCompleted(task.id, !task.completed_at);
            await refetchTasks();
        } catch (err) {
            console.error('toggle complete failed', err);
        }
    };

    const handleTapTask = (task: Task) => {
        // Event-linked tasks live inside their event's form — sending the user there
        // keeps the "single source of truth" cleaner than letting them edit one place
        // and have it diverge from the other. Standalone tasks get their own modal.
        if (task.event_id) {
            router.push({
                pathname: '/event/[id]',
                params: { id: task.event_id },
            });
        } else {
            router.push({
                pathname: '/task/[id]',
                params: { id: task.id },
            });
        }
    };

    const handleDeleteTask = async (task: Task) => {
        try {
            await deleteTask(task.id);
            await refetchTasks();
        } catch (err) {
            console.error('delete task failed', err);
        }
    };

    /** Bulk: mark every selected task complete. Sequential awaits keep RLS retries
     *  predictable; the count rarely exceeds a few dozen so parallelism isn't worth
     *  the request-storm risk. */
    const handleBulkComplete = async () => {
        const ids = Array.from(selectedTaskIds);
        if (ids.length === 0) return;
        try {
            for (const id of ids) {
                await setTaskCompleted(id, true);
            }
            await refetchTasks();
        } catch (err) {
            console.error('bulk complete failed', err);
        } finally {
            exitSelectionMode();
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedTaskIds);
        if (ids.length === 0) return;
        const title = `Delete ${ids.length} task${ids.length === 1 ? '' : 's'}?`;
        const detail = "This can't be undone.";
        // Native used to skip confirmation entirely — a single mistap wiped the
        // selected tasks (UX-001). Mirror list-form's confirmation pattern:
        // window.confirm on web, Alert.alert with a destructive button on native.
        const confirmed = await new Promise<boolean>((resolve) => {
            if (Platform.OS === 'web') {
                resolve(
                    typeof window !== 'undefined' &&
                        window.confirm(`${title}\n\n${detail}`),
                );
                return;
            }
            Alert.alert(title, detail, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => resolve(true),
                },
            ]);
        });
        if (!confirmed) return;
        try {
            for (const id of ids) {
                await deleteTask(id);
            }
            await refetchTasks();
        } catch (err) {
            console.error('bulk delete failed', err);
        } finally {
            exitSelectionMode();
        }
    };

    /** Bulk add: append a list to every selected task's memberships (deduped). */
    const handleBulkAddToList = async (listId: string) => {
        const ids = Array.from(selectedTaskIds);
        if (ids.length === 0 || !tasks) return;
        try {
            for (const id of ids) {
                const t = tasks.find((x) => x.id === id);
                if (!t) continue;
                if (t.list_ids.includes(listId)) continue;
                await setTaskLists(id, [...t.list_ids, listId]);
            }
            await refetchTasks();
        } catch (err) {
            console.error('bulk add to list failed', err);
        } finally {
            exitSelectionMode();
        }
    };

    /** Adds or removes a single list membership for a task. Immediate save — no
     *  staging — so the user sees the chip strip update straight away. */
    const handleToggleTaskList = async (task: Task, listId: string) => {
        const next = task.list_ids.includes(listId)
            ? task.list_ids.filter((id) => id !== listId)
            : [...task.list_ids, listId];
        try {
            await setTaskLists(task.id, next);
            await refetchTasks();
        } catch (err) {
            console.error('toggle task list failed', err);
        }
    };

    // UX-009: only block on listsLoading (we need the lists to draw the chip strip
    // at all). Once lists arrive, render the persistent chrome — header, view-mode
    // toggle, chip strip — even while tasks are still being fetched. The task pane
    // gets its own inline spinner below. Refetch-to-refresh no longer makes the
    // entire screen vanish.
    if (listsLoading) return <LoadingScreen />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <ThemedText type="title">Lists</ThemedText>
                </View>

                {/* List chip strip. Horizontal scroll so households with many lists
                    don't get truncated. flexGrow:0 because of the react-native-web
                    quirk where horizontal ScrollViews try to fill the column. */}
                {/* View-mode toggle — by-list vs by-child. Sits above the chip
                    strip so the chip semantics ("which list" vs "which kid") are
                    clear at a glance. Hidden when the household has no children
                    since by-child would be empty. */}
                {(children ?? []).length > 0 ? (
                    <View style={styles.viewToggleRow}>
                        {(['by-list', 'by-child'] as ViewMode[]).map((m) => {
                            const selected = viewMode === m;
                            return (
                                <Pressable
                                    key={m}
                                    onPress={() => setViewMode(m)}
                                    style={({ pressed }) => [
                                        styles.scopeBtn,
                                        selected && {
                                            backgroundColor: '#6F7FA5',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: selected ? '#fff' : colors.text,
                                            fontWeight: '600',
                                        }}>
                                        {m === 'by-list' ? 'By list' : 'By child'}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}

                <View style={styles.chipScrollWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipRow}
                    onContentSizeChange={chipOverflow.onContentSizeChange}
                    onLayout={chipOverflow.onLayout}
                    onScroll={chipOverflow.onScroll}
                    scrollEventThrottle={32}>
                    {/* Child mode renders a separate chip strip — kids instead of
                        lists. Reordering / "+ New list" affordances are hidden
                        here since they don't apply. Bail out of the by-list render
                        path entirely when in by-child mode. */}
                    {viewMode === 'by-child' ? (
                        (children ?? []).map((c) => {
                            const selected = c.id === activeChildId;
                            const openCount = openCountByChildId.get(c.id) ?? 0;
                            return (
                                <Pressable
                                    key={`child-${c.id}`}
                                    onPress={() => setActiveChildId(c.id)}
                                    style={({ pressed }) => [
                                        styles.listChip,
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
                                            color: selected ? colors.textOnPastel : colors.text,
                                            fontWeight: '600',
                                        }}>
                                        {c.display_name}
                                    </ThemedText>
                                    {openCount > 0 ? (
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: selected
                                                    ? '#2A2E3A'
                                                    : colors.textSecondary,
                                                fontWeight: '500',
                                                opacity: 0.75,
                                            }}>
                                            · {openCount}
                                        </ThemedText>
                                    ) : null}
                                </Pressable>
                            );
                        })
                    ) : null}
                    {/* By-list chip strip — the original drag-to-reorder + pencil
                        + "+ New" affordances live here. */}
                    {viewMode === 'by-list'
                        ? (lists ?? []).flatMap((l, idx) => {
                        const selected = l.id === activeListId;
                        const openCount = openCountByListId.get(l.id) ?? 0;
                        const dragging =
                            !!dragState && dragState.fromIndex === idx;
                        const showMarkerBefore =
                            !!dragState &&
                            dragState.dropIndex === idx &&
                            idx !== dragState.fromIndex &&
                            idx !== dragState.fromIndex + 1;
                        const nodes = [];
                        if (showMarkerBefore) {
                            nodes.push(
                                <View
                                    key={`marker-${idx}`}
                                    style={styles.dropMarker}
                                />,
                            );
                        }
                        nodes.push(
                            <View
                                key={l.id}
                                // View's ref is the underlying div on RN-web — we
                                // attach native pointerdown to this node in a
                                // useEffect to start the drag.
                                ref={(el) => {
                                    chipRefs.current[idx] =
                                        (el as unknown as HTMLElement | null) ??
                                        null;
                                }}
                                style={styles.chipWrapper}>
                                <Pressable
                                    onPress={() => setActiveListId(l.id)}
                                    style={({ pressed }) => [
                                        styles.listChip,
                                        {
                                            borderColor: l.color,
                                            backgroundColor: selected
                                                ? l.color
                                                : 'transparent',
                                            ...(Platform.OS === 'web' && !l.is_default
                                                ? ({ cursor: 'grab' } as object)
                                                : null),
                                        },
                                        dragging && { opacity: 0.4 },
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
                                    {openCount > 0 ? (
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: selected
                                                    ? '#2A2E3A'
                                                    : colors.textSecondary,
                                                fontWeight: '500',
                                                opacity: 0.75,
                                            }}>
                                            · {openCount}
                                        </ThemedText>
                                    ) : null}
                                    {/* Pencil only on the selected chip — quiet UI
                                        on unselected lists. data-chip-edit lets the
                                        drag handler bail when the pointerdown landed
                                        here. */}
                                    {selected ? (
                                        <Pressable
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/list/[id]',
                                                    params: { id: l.id },
                                                })
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={`Edit list ${l.name}`}
                                            {...({
                                                dataSet: { chipEdit: 'true' },
                                            } as object)}
                                            style={({ pressed: p }) => [
                                                styles.chipEditBtn,
                                                p && styles.pressed,
                                            ]}>
                                            <Feather
                                                name="edit-2"
                                                size={12}
                                                color="#2A2E3A"
                                            />
                                        </Pressable>
                                    ) : null}
                                </Pressable>
                            </View>,
                        );
                        return nodes;
                    })
                        : null}
                    {/* Drop marker after the last list when releasing past the end.
                        Only relevant in by-list mode (no drag-reorder for child
                        chips yet — children sort by created_at). */}
                    {viewMode === 'by-list' &&
                    dragState &&
                    dragState.dropIndex === (lists?.length ?? 0) &&
                    dragState.dropIndex !== dragState.fromIndex &&
                    dragState.dropIndex !== dragState.fromIndex + 1 ? (
                        <View key="marker-end" style={styles.dropMarker} />
                    ) : null}
                    {viewMode === 'by-list' ? (
                    <Pressable
                        onPress={() => router.push('/list/new')}
                        style={({ pressed }) => [
                            styles.listChip,
                            {
                                borderColor: colors.backgroundSelected,
                                borderStyle: 'dashed',
                                backgroundColor: 'transparent',
                            },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            type="small"
                            style={{ color: '#6F7FA5', fontWeight: '600' }}>
                            + New list
                        </ThemedText>
                    </Pressable>
                    ) : null}
                </ScrollView>
                <ScrollOverflowChevron
                    visible={chipOverflow.showLeftIndicator}
                    side="left"
                />
                <ScrollOverflowChevron
                    visible={chipOverflow.showRightIndicator}
                    side="right"
                />
                </View>

                {/* Render the task pane when the active container exists for the
                    current view mode. by-list needs an activeList; by-child needs
                    an activeChild. */}
                {(viewMode === 'by-list' && activeList) ||
                (viewMode === 'by-child' && activeChildId) ? (
                    <>
                        {/* All / Mine scope toggle. Mirrors Home's "tasks I care about"
                            filter so the user has a single mental model across the app.
                            "Mine" keeps unassigned (Anyone) tasks visible because they're
                            implicitly available for anyone to grab. */}
                        <View style={styles.scopeRow}>
                            <View
                                style={[
                                    styles.scopeToggle,
                                    { borderColor: colors.backgroundSelected },
                                ]}>
                                {(['mine', 'all'] as Scope[]).map((s) => {
                                    const selected = scope === s;
                                    return (
                                        <Pressable
                                            key={s}
                                            onPress={() => setScope(s)}
                                            style={({ pressed }) => [
                                                styles.scopeBtn,
                                                selected && {
                                                    backgroundColor: '#6F7FA5',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected ? '#fff' : colors.text,
                                                    fontWeight: '600',
                                                    textTransform: 'capitalize',
                                                }}>
                                                {s === 'mine' ? 'Mine' : 'All'}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {hiddenByScope > 0 ? (
                                // Tap the hint to switch to All so the user can see
                                // what's been filtered out without hunting for the
                                // segmented control.
                                <Pressable
                                    onPress={() => setScope('all')}
                                    style={({ pressed }) => [
                                        styles.hiddenHint,
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: '#6F7FA5',
                                            fontWeight: '500',
                                        }}>
                                        {hiddenByScope} hidden — show all
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                            {/* Right-aligned "Select" button to enter bulk mode.
                                Pushes itself to the trailing edge with marginLeft:
                                auto so it doesn't shift around when the hidden hint
                                appears. */}
                            <Pressable
                                onPress={() =>
                                    selectionMode
                                        ? exitSelectionMode()
                                        : setSelectionMode(true)
                                }
                                style={({ pressed }) => [
                                    styles.selectBtn,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{
                                        color: '#6F7FA5',
                                        fontWeight: '600',
                                    }}>
                                    {selectionMode ? 'Cancel' : 'Select'}
                                </ThemedText>
                            </Pressable>
                        </View>

                        {/* Quick-add input: title + Enter creates a task in the active
                            list with no due date and no assignees. The user can tap the
                            new row afterward to fill those in. */}
                        <View
                            style={[
                                styles.quickAddRow,
                                { borderColor: colors.backgroundSelected },
                            ]}>
                            <TextInput
                                value={quickAddText}
                                onChangeText={setQuickAddText}
                                onSubmitEditing={handleQuickAdd}
                                placeholder={
                                    viewMode === 'by-child' && activeChild
                                        ? `Add a task for ${activeChild.display_name}…`
                                        : `Add a task to ${activeList?.name ?? 'list'}…`
                                }
                                placeholderTextColor={colors.textSecondary}
                                returnKeyType="done"
                                editable={!adding}
                                style={[
                                    styles.quickAddInput,
                                    { color: colors.text },
                                ]}
                            />
                            <Pressable
                                onPress={handleQuickAdd}
                                disabled={!quickAddText.trim() || adding}
                                style={({ pressed }) => [
                                    styles.quickAddBtn,
                                    {
                                        opacity:
                                            !quickAddText.trim() || adding ? 0.4 : 1,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{ color: '#fff', fontWeight: '600' }}>
                                    Add
                                </ThemedText>
                            </Pressable>
                        </View>

                        <ScrollView
                            style={styles.tasksScroll}
                            contentContainerStyle={styles.tasksContent}
                            showsVerticalScrollIndicator={false}>
                            {/* UX-009: inline spinner while tasks fetch on initial mount
                                or after a refetch. The chip strip + quick-add stay usable
                                above; only the row area shows the loading state. */}
                            {tasksLoading ? (
                                <View style={styles.empty}>
                                    <ActivityIndicator color="#6F7FA5" />
                                </View>
                            ) : openTasks.length === 0 && completedTasks.length === 0 ? (
                                <View style={styles.empty}>
                                    <ThemedText themeColor="textSecondary">
                                        No tasks yet. Type one above to get started.
                                    </ThemedText>
                                </View>
                            ) : null}

                            {openTasks.length > 0 ? (
                                <ThemedText
                                    type="smallBold"
                                    themeColor="textSecondary"
                                    style={styles.sectionLabel}>
                                    Open · {openTasks.length}
                                </ThemedText>
                            ) : null}
                            {openTasks.map((t) => (
                                <TaskListRow
                                    key={t.id}
                                    task={t}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expanded={expandedRowId === t.id}
                                    onToggleExpanded={() =>
                                        setExpandedRowId((curr) =>
                                            curr === t.id ? null : t.id,
                                        )
                                    }
                                    onToggleList={(listId) =>
                                        handleToggleTaskList(t, listId)
                                    }
                                    selectionMode={selectionMode}
                                    selected={selectedTaskIds.has(t.id)}
                                    onToggleSelected={() =>
                                        toggleTaskSelected(t.id)
                                    }
                                    onToggle={() => handleToggleComplete(t)}
                                    onTap={() =>
                                        selectionMode
                                            ? toggleTaskSelected(t.id)
                                            : handleTapTask(t)
                                    }
                                    onDelete={() => handleDeleteTask(t)}
                                />
                            ))}

                            {completedTasks.length > 0 ? (
                                <ThemedText
                                    type="smallBold"
                                    themeColor="textSecondary"
                                    style={styles.sectionLabel}>
                                    Completed · {completedTasks.length}
                                </ThemedText>
                            ) : null}
                            {completedTasks.map((t) => (
                                <TaskListRow
                                    key={t.id}
                                    task={t}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expanded={expandedRowId === t.id}
                                    onToggleExpanded={() =>
                                        setExpandedRowId((curr) =>
                                            curr === t.id ? null : t.id,
                                        )
                                    }
                                    onToggleList={(listId) =>
                                        handleToggleTaskList(t, listId)
                                    }
                                    selectionMode={selectionMode}
                                    selected={selectedTaskIds.has(t.id)}
                                    onToggleSelected={() =>
                                        toggleTaskSelected(t.id)
                                    }
                                    onToggle={() => handleToggleComplete(t)}
                                    onTap={() =>
                                        selectionMode
                                            ? toggleTaskSelected(t.id)
                                            : handleTapTask(t)
                                    }
                                    onDelete={() => handleDeleteTask(t)}
                                />
                            ))}
                        </ScrollView>
                    </>
                ) : (
                    <View style={styles.empty}>
                        <ThemedText themeColor="textSecondary">
                            Tap a list above to see its tasks.
                        </ThemedText>
                    </View>
                )}
                {/* Bulk-action bar. Pinned to the bottom of the SafeAreaView so
                    it doesn't scroll with the task list. Only renders in select
                    mode; collapsed by default to keep the screen quiet. */}
                {selectionMode ? (
                    <View
                        style={[
                            styles.bulkBar,
                            {
                                borderTopColor: colors.backgroundSelected,
                                backgroundColor: colors.background,
                            },
                        ]}>
                        <View style={styles.bulkBarRow}>
                            <ThemedText type="smallBold">
                                {selectedTaskIds.size} selected
                            </ThemedText>
                            <View style={styles.bulkBarActions}>
                                <Pressable
                                    onPress={handleBulkComplete}
                                    disabled={selectedTaskIds.size === 0}
                                    style={({ pressed }) => [
                                        styles.bulkBtn,
                                        {
                                            opacity:
                                                selectedTaskIds.size === 0 ? 0.4 : 1,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: '#6F7FA5',
                                            fontWeight: '600',
                                        }}>
                                        ✓ Complete
                                    </ThemedText>
                                </Pressable>
                                <Pressable
                                    onPress={() =>
                                        setBulkAddListOpen((v) => !v)
                                    }
                                    disabled={
                                        selectedTaskIds.size === 0 ||
                                        (lists?.length ?? 0) === 0
                                    }
                                    style={({ pressed }) => [
                                        styles.bulkBtn,
                                        {
                                            opacity:
                                                selectedTaskIds.size === 0
                                                    ? 0.4
                                                    : 1,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: '#6F7FA5',
                                            fontWeight: '600',
                                        }}>
                                        + Add to list…
                                    </ThemedText>
                                </Pressable>
                                <Pressable
                                    onPress={handleBulkDelete}
                                    disabled={selectedTaskIds.size === 0}
                                    style={({ pressed }) => [
                                        styles.bulkBtn,
                                        {
                                            opacity:
                                                selectedTaskIds.size === 0 ? 0.4 : 1,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: '#B85D52',
                                            fontWeight: '600',
                                        }}>
                                        Delete
                                    </ThemedText>
                                </Pressable>
                            </View>
                        </View>
                        {/* Inline list picker for "Add to list…" — chips appear
                            above the action row when expanded. Tap a chip to
                            append it to every selected task's memberships and
                            exit select mode.
                            UX-023: chips reflect current membership across the
                            selected tasks. "All" = every selected task is
                            already in this list (filled — tap is a no-op);
                            "some/none" = at least one selected task isn't in
                            it (outlined — tap adds them). Matches the per-row
                            "+ lists" picker convention so a user who learned
                            "filled = already attached" reads it consistently. */}
                        {bulkAddListOpen ? (
                            <View style={styles.bulkListPicker}>
                                {(lists ?? []).map((l) => {
                                    const allHaveIt =
                                        selectedTaskIds.size > 0 &&
                                        (tasks ?? [])
                                            .filter((t) =>
                                                selectedTaskIds.has(t.id),
                                            )
                                            .every((t) =>
                                                t.list_ids.includes(l.id),
                                            );
                                    return (
                                        <Pressable
                                            key={`bulk-pick-${l.id}`}
                                            onPress={() =>
                                                handleBulkAddToList(l.id)
                                            }
                                            style={({ pressed }) => [
                                                styles.metaChip,
                                                {
                                                    borderColor: l.color,
                                                    backgroundColor: allHaveIt
                                                        ? l.color
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: allHaveIt
                                                        ? '#2A2E3A'
                                                        : colors.text,
                                                    fontWeight: '600',
                                                }}>
                                                {l.name}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </SafeAreaView>
            {/* UX-004: floating action button for "+ new list", mirroring the FAB
                pattern on Home and Calendar so the create mental model is
                consistent across tabs. Hidden while the bulk-action bar is up
                so the two anchored controls don't fight for the bottom-right. */}
            {!selectionMode ? (
                <Pressable
                    onPress={() => router.push('/list/new')}
                    accessibilityRole="button"
                    accessibilityLabel="Create new list"
                    style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
                    <ThemedText style={styles.fabText}>+</ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

/**
 * A single row in the Lists tab. Checkbox + title + meta chips. The whole row body is
 * tappable for navigation; the checkbox stops propagation so toggling complete doesn't
 * also fire the row tap.
 */
function TaskListRow({
    task,
    members,
    colorMap,
    allLists,
    activeListId,
    expanded,
    onToggleExpanded,
    onToggleList,
    selectionMode,
    selected,
    onToggleSelected,
    onToggle,
    onTap,
    onDelete,
}: {
    task: Task;
    members: { profile_id: string; display_name: string }[];
    colorMap: Map<string, string>;
    /** All household lists — needed both for cross-list color chips in the meta row
     *  and for the expanded "add to other lists" picker below the row. */
    allLists: TaskList[];
    /** The list this row is currently being viewed under; used to skip rendering a
     *  redundant "also in X" chip when X === the list we're already in. */
    activeListId: string | null;
    expanded: boolean;
    onToggleExpanded: () => void;
    onToggleList: (listId: string) => void;
    /** True when the parent screen is in bulk-select mode. Renders a selection
     *  checkbox prefix and tints the row when selected. */
    selectionMode: boolean;
    selected: boolean;
    onToggleSelected: () => void;
    onToggle: () => void;
    onTap: () => void;
    onDelete: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const done = !!task.completed_at;
    const dueLabel = task.due_at
        ? format(new Date(task.due_at), 'EEE, MMM d')
        : null;

    return (
        <Pressable
            onPress={onTap}
            style={({ pressed }) => [
                styles.taskRow,
                { borderColor: colors.backgroundSelected },
                done && { backgroundColor: colors.backgroundElement },
                // Tint selected rows so the multi-select state is unambiguous —
                // distinct from the completed-row tint (which uses backgroundElement).
                selected && { backgroundColor: 'rgba(111, 127, 165, 0.15)' },
                pressed && styles.pressed,
            ]}>
            {/* Selection checkbox (only in bulk mode). Sits to the left of the
                complete checkbox so the two states are visually separate. Stops
                propagation so the click doesn't also fire the row's onTap. */}
            {selectionMode ? (
                <Pressable
                    onPress={(e) => {
                        e.stopPropagation();
                        onToggleSelected();
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={
                        selected ? 'Deselect task' : 'Select task'
                    }
                    style={({ pressed }) => [
                        styles.checkbox,
                        {
                            backgroundColor: selected ? '#6F7FA5' : 'transparent',
                            borderColor: selected
                                ? '#6F7FA5'
                                : colors.backgroundSelected,
                        },
                        pressed && styles.pressed,
                    ]}>
                    {selected ? (
                        <ThemedText style={styles.checkmark}>✓</ThemedText>
                    ) : null}
                </Pressable>
            ) : null}
            <Pressable
                onPress={onToggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={
                    done ? 'Mark task incomplete' : 'Mark task complete'
                }
                style={({ pressed }) => [
                    styles.checkbox,
                    {
                        backgroundColor: done ? '#6F7FA5' : 'transparent',
                        borderColor: done ? '#6F7FA5' : colors.backgroundSelected,
                    },
                    pressed && styles.pressed,
                ]}>
                {done ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
            </Pressable>

            <View style={styles.taskBody}>
                <ThemedText
                    style={[
                        styles.taskTitle,
                        done && {
                            textDecorationLine: 'line-through',
                            color: colors.textSecondary,
                        },
                    ]}
                    numberOfLines={2}>
                    {task.title}
                </ThemedText>

                {/* Meta chips row: due / event / assignees / cross-list pills.
                    Always rendered when there are lists in the household so the
                    "+ lists" toggle is reachable on every row — without that, the
                    "add to other lists" affordance would only exist on rows that
                    already have meta content. */}
                {dueLabel ||
                task.event_id ||
                task.assignee_profile_ids.length > 0 ||
                allLists.length > 0 ? (
                    <View style={styles.metaRow}>
                        {dueLabel ? (
                            <View
                                style={[
                                    styles.metaChip,
                                    { borderColor: colors.backgroundSelected },
                                ]}>
                                <ThemedText
                                    type="small"
                                    themeColor="textSecondary">
                                    {dueLabel}
                                </ThemedText>
                            </View>
                        ) : null}
                        {task.event_id ? (
                            <View
                                style={[
                                    styles.metaChip,
                                    { borderColor: colors.backgroundSelected },
                                ]}>
                                <Feather
                                    name="calendar"
                                    size={11}
                                    color={colors.textSecondary}
                                />
                                <ThemedText
                                    type="small"
                                    themeColor="textSecondary">
                                    Event
                                </ThemedText>
                            </View>
                        ) : null}
                        {task.assignee_profile_ids.map((pid) => {
                            const member = members.find((m) => m.profile_id === pid);
                            const color = colorForResponsible(pid, colorMap);
                            const initial =
                                member?.display_name?.charAt(0).toUpperCase() ?? '·';
                            return (
                                <View
                                    key={pid}
                                    style={[
                                        styles.assigneeDot,
                                        { backgroundColor: color },
                                    ]}>
                                    <ThemedText style={styles.assigneeDotText}>
                                        {initial}
                                    </ThemedText>
                                </View>
                            );
                        })}
                        {/* Cross-list pills: show every OTHER list this task is in
                            (skip the one we're viewing under, since it'd be
                            redundant). Each pill carries a trailing × so the
                            tap-to-remove affordance is explicit — without it the
                            pills looked identical to the read-only "Event" / due
                            chips next to them and a tap silently removed the
                            membership (UX-003). */}
                        {task.list_ids
                            .filter((lid) => lid !== activeListId)
                            .map((lid) => {
                                const l = allLists.find((x) => x.id === lid);
                                if (!l) return null;
                                return (
                                    <Pressable
                                        key={`meta-list-${lid}`}
                                        onPress={(e) => {
                                            // Stop the parent row's onTap from firing
                                            // — we want to toggle membership here, not
                                            // navigate.
                                            e.stopPropagation();
                                            onToggleList(lid);
                                        }}
                                        accessibilityLabel={`Remove from ${l.name}`}
                                        style={({ pressed }) => [
                                            styles.metaChip,
                                            {
                                                borderColor: l.color,
                                                backgroundColor: l.color,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: '#2A2E3A',
                                                fontWeight: '500',
                                            }}>
                                            {l.name}
                                        </ThemedText>
                                        <ThemedText
                                            type="small"
                                            style={styles.crossListRemoveX}>
                                            ×
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        {/* "+ lists" expansion toggle. Always available when there's
                            at least one list in the household. Lets the user open
                            an inline picker without leaving the row. */}
                        {allLists.length > 0 ? (
                            <Pressable
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onToggleExpanded();
                                }}
                                style={({ pressed }) => [
                                    styles.metaChip,
                                    {
                                        borderColor: colors.backgroundSelected,
                                        borderStyle: expanded ? 'solid' : 'dashed',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{
                                        color: '#6F7FA5',
                                        fontWeight: '600',
                                    }}>
                                    {expanded ? '× lists' : '+ lists'}
                                </ThemedText>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}

                {/* Expanded list picker — shows every list with its membership
                    state, tap to toggle. Wraps so a household with many lists
                    doesn't push the row width past the screen. */}
                {expanded ? (
                    <View
                        style={[
                            styles.listPickerPanel,
                            { borderColor: colors.backgroundSelected },
                        ]}>
                        {allLists.map((l) => {
                            const selected = task.list_ids.includes(l.id);
                            return (
                                <Pressable
                                    key={`pick-${l.id}`}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        onToggleList(l.id);
                                    }}
                                    style={({ pressed }) => [
                                        styles.metaChip,
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
                                            fontWeight: '500',
                                        }}>
                                        {l.name}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}
            </View>

            <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete task"
                style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed && styles.pressed,
                ]}>
                <ThemedText style={{ color: '#B85D52', fontWeight: '600' }}>
                    ✕
                </ThemedText>
            </Pressable>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.two,
    },
    // flexGrow:0 stops the horizontal ScrollView from greedily eating column height
    // on react-native-web (same workaround as the calendar's filter pill row).
    chipScroll: { flexGrow: 0, flexShrink: 0 },
    // UX-010: relative-positioned wrapper so the overflow chevron pins to the
    // chip strip's visible right edge rather than the content's right edge.
    chipScrollWrapper: { position: 'relative' },
    chipRow: {
        flexDirection: 'row',
        gap: Spacing.two,
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.two,
        alignItems: 'center',
    },
    listChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one + 2,
    },
    // Each chip is wrapped so we can render an optional drop marker as its sibling
    // without breaking the flex layout. The wrapper itself has no margin/padding;
    // chipRow's `gap` handles spacing between wrappers.
    chipWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
    },
    // Drop-position indicator during a drag. Slate-blue vertical bar tall enough to
    // span the chip height; pointerEvents="none" via inline because RN's View doesn't
    // accept it as a style key — we don't need it since absolute positioning isn't
    // in play, the bar takes its own slot in the row.
    dropMarker: {
        width: 3,
        height: 28,
        backgroundColor: '#6F7FA5',
        borderRadius: 2,
    },
    chipEditBtn: {
        padding: 2,
        borderRadius: 4,
    },
    scopeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.two,
    },
    // View-mode toggle (by-list / by-child) — a slim segmented control above the
    // chip strip. Same visual treatment as the scope toggle below for consistency.
    viewToggleRow: {
        flexDirection: 'row',
        gap: Spacing.two,
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.two,
    },
    // Segmented control. Border on the outer wrapper + selected fill on the active
    // pill gives a single connected pill-pair without per-button borders.
    scopeToggle: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 999,
        overflow: 'hidden',
    },
    scopeBtn: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    // The "N hidden" inline action sits next to the segmented control. No border
    // so it reads as text-action rather than a competing chip.
    hiddenHint: {
        paddingHorizontal: Spacing.two,
        paddingVertical: Spacing.one,
    },
    // The Select button sits at the right edge of the scope row. marginLeft:auto
    // pushes it past the optional "N hidden" hint without depending on its
    // presence for layout.
    selectBtn: {
        marginLeft: 'auto',
        paddingHorizontal: Spacing.two,
        paddingVertical: Spacing.one,
    },
    // Bulk-action bar pinned to the bottom of the safe area. Border-top sets it
    // apart from the scrolling task list above without needing a shadow.
    bulkBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        gap: Spacing.two,
    },
    bulkBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bulkBarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
    },
    bulkBtn: {
        paddingHorizontal: Spacing.two,
        paddingVertical: Spacing.one,
    },
    // Inline chip strip that pops up above the action row when "Add to list…" is
    // toggled. Wraps so households with many lists don't overflow.
    bulkListPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.one,
        paddingTop: Spacing.two,
    },
    quickAddRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        marginHorizontal: Spacing.four,
        marginBottom: Spacing.two,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.two,
    },
    quickAddInput: {
        flex: 1,
        fontSize: 15,
        paddingVertical: Spacing.two,
    },
    quickAddBtn: {
        backgroundColor: '#6F7FA5',
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one + 2,
        borderRadius: Spacing.one + 2,
    },
    tasksScroll: { flex: 1 },
    tasksContent: {
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.six,
        gap: Spacing.two,
    },
    sectionLabel: {
        marginTop: Spacing.three,
        marginBottom: Spacing.one,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    empty: {
        padding: Spacing.six,
        alignItems: 'center',
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.two,
        padding: Spacing.two + 2,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
    taskBody: { flex: 1, gap: 4 },
    taskTitle: { fontSize: 15, lineHeight: 20 },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        flexWrap: 'wrap',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.two,
        paddingVertical: 1,
    },
    // Trailing × glyph on cross-list pills. Slightly bolder + opacity-dimmed so
    // it reads as "tap target inside this pill" without competing with the list
    // name. Matches the affordance pattern of close-buttons in browser tabs.
    crossListRemoveX: {
        color: '#2A2E3A',
        fontSize: 13,
        fontWeight: '700',
        opacity: 0.6,
        marginLeft: 2,
    },
    // Expanded inline list picker below a task row's meta chips. Outlined panel
    // groups the chips visually so they don't blur into the meta row above.
    listPickerPanel: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.one,
        marginTop: Spacing.two,
        padding: Spacing.two,
        borderWidth: 1,
        borderRadius: Spacing.two,
    },
    assigneeDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assigneeDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    deleteBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
    // UX-004: FAB anchored bottom-right. Mirrors src/app/(app)/index.tsx fab/fabText
    // so the create affordance reads identically on Home, Calendar, and Lists.
    fab: {
        position: 'absolute',
        right: Spacing.four,
        bottom: Spacing.six,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#6F7FA5',
        alignItems: 'center',
        justifyContent: 'center',
        ...FAB_SHADOW,
    },
    fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
