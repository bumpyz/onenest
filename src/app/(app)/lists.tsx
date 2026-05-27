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
import { ListCardV2, NewListCard, SectionHeader, TaskRow } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import {
    ScrollOverflowChevron,
    useHorizontalOverflow,
} from '@/components/scroll-overflow-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { FAB_SHADOW, withAlpha } from '@/lib/platform-styles';
import { useChildren } from '@/hooks/use-children';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholdTasks } from '@/hooks/use-household-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useMyRole } from '@/hooks/use-my-role';
import {
    createTask,
    deleteTask,
    setTaskCompleted,
    setTaskLists,
    updateList,
    updateTask,
    type List as TaskList,
    type Task,
} from '@/lib/db';
import { UNASSIGNED_COLOR, colorForResponsible, memberColorMap } from '@/lib/colors';
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
    // Caregivers can complete tasks but not create them, edit their metadata,
    // or manage lists. We hide the FAB, the inline "+ add task" affordance,
    // and the bulk-action toolbar; the checkbox stays live so they can mark
    // their assigned tasks done (which routes through the mark_task_complete
    // RPC server-side). `roleLoading` guards the FAB against a one-frame flash
    // on cold start for caregivers.
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const showCreateAffordances = !roleLoading && !isCaregiver;
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
    // Phase 8.x audit: the design (direction-c-pro.jsx ProLists) doesn't
    // include a by-list/by-child view toggle — lists are the canonical
    // org axis and per-child filtering is expected to happen via the
    // list ("Mei's school") or task tagging. Freeze viewMode to 'by-list'
    // and skip the toggle JSX. Leaving the const so the conditional
    // branches downstream still compile (a future revival of by-child
    // would just flip this back to useState).
    // Widen via `as ViewMode` so downstream `viewMode === 'by-child'`
    // comparisons still typecheck (TS would otherwise narrow the const
    // to the 'by-list' literal and flag every comparison as unreachable).
    const viewMode = 'by-list' as ViewMode;
    const setViewMode = (_: ViewMode) => {
        /* by-child view removed per design intent */
    };
    void setViewMode;
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

    // Search state — Option A (mode-swap). The header's search button
    // flips `searchOpen` true, which collapses the quick-add row and
    // slides a search input into the same slot. Typing populates
    // `searchText` which narrows the visible task set across the entire
    // household (not scoped to the active list — typing "soccer" while
    // sitting on Inbox should still find soccer in Activities). Cancel
    // clears both and restores the quick-add row.
    // Why both states + an explicit "open" flag (not just non-empty
    // text): the user might tap search, see an empty input, change
    // their mind, and tap Cancel without typing anything. The
    // open-but-empty case is real UX, not a transient.
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const searchInputRef = useRef<TextInput | null>(null);
    // Derived flag — search is "active" (filtering tasks) only when the
    // input is open AND has non-whitespace text. Open-but-empty still
    // hides the chip strip + cards (so the user has a clean canvas)
    // but doesn't filter the task list (would otherwise show "0 of 0
    // matches" which reads as broken).
    const searchActive = searchOpen && searchText.trim().length > 0;
    const openSearch = useCallback(() => {
        setSearchOpen(true);
        // Defer focus to the next paint so the TextInput is mounted
        // before .focus() runs. Without the timeout, the focus call
        // races the mount on cold open and the keyboard doesn't pop.
        setTimeout(() => searchInputRef.current?.focus(), 0);
    }, []);
    const cancelSearch = useCallback(() => {
        setSearchOpen(false);
        setSearchText('');
    }, []);
    // Phase 8.x audit: the design has no Mine/All scope toggle — Lists
    // shows all household tasks period; per-person filtering is implicit
    // in the assignee avatars on each row. Lock to 'all' and skip the
    // toggle JSX. Same const-with-noop pattern as viewMode above to
    // avoid touching every downstream consumer.
    const scope = 'all' as Scope;
    const setScope = (_: Scope) => {
        /* Mine/All toggle removed per design intent */
    };
    void setScope;
    // Which row, if any, has the "add to other lists" panel expanded. Keeping it
    // single-row (only one expanded at a time) keeps the screen quiet — tapping a
    // different row's pill collapses the previous one. Session-scoped state.
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    // (Phase 8.x audit: bulk-select mode removed. Design's ProLists has
    // no Select entry point; per-row swipe panels handle the common
    // Done/Snooze/Delete actions individually. The corresponding state,
    // handlers, and bulk-action bar JSX were removed with the toggle.)

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
            // Phase 6.7 follow-up #326: pencil edit-button removed; the
            // [data-chip-edit] bail-out has no matching DOM and is gone.
            const list = lists[fromIndex];
            if (!list || list.is_default) return; // Inbox not draggable
            // Phase 6.7 pass-2 QA fix: don't preventDefault and don't enter
            // drag state on pointerdown. That suppressed RN-web Pressable's
            // synthesized click + interfered with the new onLongPress for
            // chip context menu. Both are deferred until the pointer moves
            // past DRAG_THRESHOLD_PX — a clean tap never enters drag state
            // and never blocks tap/long-press.
            const DRAG_THRESHOLD_PX = 5;
            const startX = e.clientX;
            let dragStarted = false;

            const startDrag = () => {
                if (dragStarted) return;
                dragStarted = true;
                setDrag({ fromIndex, dropIndex: fromIndex });
            };

            const onMove = (ev: PointerEvent) => {
                if (!dragStarted) {
                    if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
                    startDrag();
                    ev.preventDefault();
                }
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
                if (!dragStarted) return; // clean tap or long-press — Pressable handles it
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
    // Per-list summary — open count, done count, and progress fraction.
    // Lists v2 (design_handoff_fab_rule): the "Your lists" horizontal
    // card row uses all three; the chip strip below uses only `open`.
    // Aggregating once here avoids walking `tasks` twice. Same multi-list
    // semantics as before — a task in multiple lists contributes to each;
    // Inbox absorbs tasks with empty list_ids.
    type ListSummary = { open: number; done: number; progress: number };
    const listSummaries = useMemo<Map<string, ListSummary>>(() => {
        const map = new Map<string, ListSummary>();
        if (!tasks || !lists) return map;
        const inboxId = lists.find((l) => l.is_default)?.id ?? null;
        const bump = (lid: string, kind: 'open' | 'done') => {
            const curr = map.get(lid) ?? { open: 0, done: 0, progress: 0 };
            curr[kind] += 1;
            map.set(lid, curr);
        };
        for (const t of tasks) {
            const kind = t.completed_at ? 'done' : 'open';
            if (t.list_ids.length === 0) {
                if (inboxId) bump(inboxId, kind);
                continue;
            }
            for (const lid of t.list_ids) bump(lid, kind);
        }
        // Fill in progress = done / (open + done) for each list. Listed
        // lists with zero tasks get an explicit zeroed entry so the card
        // renders "0 open · 0 done" with a 0% bar instead of being missing.
        for (const l of lists) {
            const curr = map.get(l.id) ?? { open: 0, done: 0, progress: 0 };
            const total = curr.open + curr.done;
            curr.progress = total > 0 ? curr.done / total : 0;
            map.set(l.id, curr);
        }
        return map;
    }, [tasks, lists]);
    // Back-compat alias for the chip strip — derives open counts from
    // listSummaries so the two surfaces can't drift.
    const openCountByListId = useMemo<Map<string, number>>(() => {
        const m = new Map<string, number>();
        for (const [lid, s] of listSummaries) m.set(lid, s.open);
        return m;
    }, [listSummaries]);

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
        // Search override — when the user is actively searching, ignore
        // the chip-strip list filter and run against the entire
        // household task set. Typing "soccer" while parked on Inbox
        // should still find a soccer task in Activities; restricting
        // search to the active list would read as broken UX. The chip
        // strip is hidden while searching (see render below) so the
        // user doesn't see a contradictory selection.
        if (searchActive) {
            const q = searchText.trim().toLowerCase();
            return tasks.filter((t) =>
                t.title.toLowerCase().includes(q),
            );
        }
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
    }, [tasks, viewMode, activeList, activeChildId, searchActive, searchText]);

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
    // Due-date buckets per the redesign — Overdue (alert tint), Today, This
    // week. Replaces the flat "Open · N" section that grouped everything
    // together. Anything without a due date OR due > 6 days out falls into
    // "Later" so the user can still see those tasks without them taking the
    // Overdue / Today buckets' visual weight. Bucketing is computed off
    // openTasks so the Completed group below stays intact.
    type DueBucket = 'overdue' | 'today' | 'thisWeek' | 'later';
    const taskBuckets = useMemo(() => {
        const now = new Date();
        const startOfTodayMs = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();
        const startOfTomorrowMs = startOfTodayMs + 24 * 60 * 60 * 1000;
        // +7 days from start-of-today gives us the inclusive "this week" cutoff:
        // a task due 6 days out is still in [tomorrow, +6 days].
        const endOfWeekMs = startOfTodayMs + 7 * 24 * 60 * 60 * 1000;
        const buckets: Record<DueBucket, Task[]> = {
            overdue: [],
            today: [],
            thisWeek: [],
            later: [],
        };
        for (const t of openTasks) {
            if (!t.due_at) {
                buckets.later.push(t);
                continue;
            }
            const dueMs = new Date(t.due_at).getTime();
            if (dueMs < startOfTodayMs) buckets.overdue.push(t);
            else if (dueMs < startOfTomorrowMs) buckets.today.push(t);
            else if (dueMs < endOfWeekMs) buckets.thisWeek.push(t);
            else buckets.later.push(t);
        }
        return buckets;
    }, [openTasks]);
    // Header counts strip per the redesign — "12 OPEN · 3 OVERDUE · 2 DONE TODAY".
    // Computed off the same visibleTasks so the chip filter narrows the strip too.
    const overdueCount = useMemo(() => {
        const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
        return openTasks.filter(
            (t) => !!t.due_at && new Date(t.due_at).getTime() < startOfTodayMs,
        ).length;
    }, [openTasks]);
    const doneTodayCount = useMemo(() => {
        const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
        return completedTasks.filter((t) => {
            if (!t.completed_at) return false;
            return new Date(t.completed_at).getTime() >= startOfTodayMs;
        }).length;
    }, [completedTasks]);
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
        // Always route a task tap to the task editor — that's the user's
        // mental model ("tap task → edit task"). The earlier behavior
        // detoured event-linked taps to the event editor under a "single
        // source of truth" theory, but in practice users found it
        // confusing: the row says a task title and tapping it opened an
        // event-shaped form. The task editor at /task/[id] handles the
        // linked-event context inline (shows the linked event chip;
        // navigating to the event itself is an explicit action from
        // there, not a side effect of the task tap).
        router.push({
            pathname: '/task/[id]',
            params: { id: task.id },
        });
    };

    const handleDeleteTask = async (task: Task) => {
        try {
            await deleteTask(task.id);
            await refetchTasks();
        } catch (err) {
            console.error('delete task failed', err);
        }
    };

    // Snooze a task by 1 day. Per the design (ProLists CSwipedTask, the
    // middle warn-colored "+1d" panel), the swipe gesture surfaces a quick
    // defer affordance alongside Done and Delete. If the task has no due
    // date yet, snoozing schedules it for tomorrow — opinionated default
    // that matches user intent ("not today, deal with it later").
    //
    // updateTask requires the full NewTaskInput shape (it's a partial-
    // overwrite that replaces every field), so we preserve every other
    // field from the loaded task and only mutate due_at.
    const handleSnoozeTask = async (task: Task) => {
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
            });
            await refetchTasks();
        } catch (err) {
            console.error('snooze task failed', err);
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
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Page header per the redesign — mono counts strip above a
                    22px SemiBold "Lists" title, with a 30x30 search button
                    on the trailing edge (direction-c-pro.jsx ~947-959).
                    Tapping search opens an inline mode-swap input that
                    replaces the quick-add row below (#380). The button
                    visually highlights (accent fill) while search is
                    open, so the user has a clear "back out" affordance
                    paired with the Cancel link inside the search row. */}
                <View style={styles.pageHeader}>
                    <View style={styles.pageHeaderLeft}>
                        {/* UX audit 3.1 — always show all three segments per
                            the design (direction-c-pro.jsx:949-951). Zero
                            counts are useful signal ("0 OVERDUE" = calm); the
                            previous conditional hid them and matched the
                            audit's "only 4 OPEN" screenshot. */}
                        <ThemedText
                            style={[
                                styles.countsStrip,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            {openTasks.length} OPEN · {overdueCount} OVERDUE ·{' '}
                            {doneTodayCount} DONE TODAY
                        </ThemedText>
                        <ThemedText
                            style={[
                                Typography.titleSecondary,
                                { color: colors.text, marginTop: 1 },
                            ]}>
                            Lists
                        </ThemedText>
                    </View>
                    <Pressable
                        onPress={searchOpen ? cancelSearch : openSearch}
                        accessibilityRole="button"
                        accessibilityLabel={
                            searchOpen ? 'Close search' : 'Search tasks'
                        }
                        accessibilityState={{ selected: searchOpen }}
                        style={({ pressed }) => [
                            styles.headerSearchBtn,
                            searchOpen
                                ? {
                                      backgroundColor: colors.accent,
                                      borderColor: colors.accent,
                                  }
                                : {
                                      backgroundColor: colors.backgroundElement,
                                      borderColor: colors.hair,
                                  },
                            pressed && styles.pressed,
                        ]}>
                        <Feather
                            name="search"
                            size={14}
                            color={searchOpen ? colors.onAccent : colors.text}
                        />
                    </Pressable>
                </View>

                {/* (Phase 8.x audit: by-list / by-child view toggle removed.
                    Design's ProLists has no such toggle — lists are the
                    canonical org axis. Per-child filtering happens via
                    list naming or task tags. The viewMode const is
                    frozen above; toggle JSX is gone.) */}

                {/* Mode-swap row — quick-add by default, search input when
                    `searchOpen`. Same shell card geometry in both modes so
                    the screen doesn't reflow when the user toggles search.
                    Quick-add: per the design (ProLists direction-c-pro.jsx
                    ~962-977) it sits between the page header and the chip
                    strip, NOT below the chips. Caregivers don't see the
                    quick-add row (RLS blocks INSERTs); the search row is
                    available to them since search is read-only. */}
                {searchOpen ? (
                    <View
                        style={[
                            styles.quickAddRow,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <Feather
                            name="search"
                            size={14}
                            color={colors.textSecondary}
                        />
                        <TextInput
                            ref={searchInputRef}
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Search tasks…"
                            placeholderTextColor={colors.inkFaint}
                            returnKeyType="search"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[
                                styles.quickAddInput,
                                {
                                    color: colors.text,
                                    fontFamily: FontFamily.monoRegular,
                                },
                                // RN-Web: strip the default browser
                                // input outline so the field reads as
                                // part of the bar shell. Same trick
                                // we use in the Contacts search bar.
                                Platform.OS === 'web'
                                    ? ({ outlineStyle: 'none' } as object)
                                    : null,
                            ]}
                        />
                        <Pressable
                            onPress={cancelSearch}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel search"
                            hitSlop={6}
                            style={({ pressed }) => [
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.searchCancelText,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                Cancel
                            </ThemedText>
                        </Pressable>
                    </View>
                ) : !isCaregiver ? (
                    <View
                        style={[
                            styles.quickAddRow,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <Feather
                            name="plus"
                            size={14}
                            color={colors.textSecondary}
                        />
                        <TextInput
                            value={quickAddText}
                            onChangeText={setQuickAddText}
                            onSubmitEditing={handleQuickAdd}
                            placeholder={`add task to ${activeList?.name ?? 'list'}`}
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
                        <Pressable
                            onPress={handleQuickAdd}
                            disabled={!quickAddText.trim() || adding}
                            accessibilityRole="button"
                            accessibilityLabel="Add task"
                            style={({ pressed }) => [
                                styles.kbdBadge,
                                {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0.12,
                                    ),
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
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {'⌘'}N
                            </ThemedText>
                        </Pressable>
                    </View>
                ) : null}

                {/* "Your lists" horizontal-scroll card row — Lists v2
                    (design_handoff_fab_rule). Each ListCardV2 carries
                    list identity (color top bar + name), owner caption,
                    open/done counts, and a progress bar. Tap routes to
                    /list/[id] (read-mode detail). The trailing dashed
                    "New list" card opens the create form. Hidden in
                    by-child mode since the card vocabulary is list-axis
                    only — child mode keeps just the chip strip below.
                    Also hidden while search is open: the list-axis
                    summary cards are noise when the user's mental
                    model is "find tasks across everything." */}
                {viewMode === 'by-list' && !searchOpen ? (
                    <>
                        <View style={styles.yourListsHeader}>
                            <ThemedText
                                style={[
                                    styles.yourListsHeaderLabel,
                                    {
                                        color: colors.textSecondary,
                                    },
                                ]}>
                                YOUR LISTS · {(lists ?? []).length}
                            </ThemedText>
                            {/* "+ NEW LIST" link — secondary affordance
                                next to the kind-committed FAB. Tappable
                                so users have two ways to reach the
                                create form without crowding the chip
                                strip. */}
                            {showCreateAffordances ? (
                                <Pressable
                                    onPress={() => router.push('/list/new')}
                                    accessibilityRole="button"
                                    accessibilityLabel="New list">
                                    {({ pressed }) => (
                                        <ThemedText
                                            style={[
                                                styles.yourListsNewLink,
                                                {
                                                    color: colors.accent,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                    opacity: pressed ? 0.7 : 1,
                                                },
                                            ]}>
                                            + NEW LIST
                                        </ThemedText>
                                    )}
                                </Pressable>
                            ) : null}
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.yourListsScroll}
                            contentContainerStyle={styles.yourListsRow}>
                            {(lists ?? []).map((l) => {
                                const summary = listSummaries.get(l.id) ?? {
                                    open: 0,
                                    done: 0,
                                    progress: 0,
                                };
                                return (
                                    <ListCardV2
                                        key={l.id}
                                        color={l.color}
                                        name={l.name}
                                        owner={l.is_default ? 'Inbox' : 'Shared'}
                                        open={summary.open}
                                        done={summary.done}
                                        progress={summary.progress}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/list/[id]',
                                                params: { id: l.id },
                                            })
                                        }
                                        colors={colors}
                                    />
                                );
                            })}
                            {showCreateAffordances ? (
                                <NewListCard
                                    onPress={() => router.push('/list/new')}
                                    colors={colors}
                                />
                            ) : null}
                        </ScrollView>
                    </>
                ) : null}

                {/* List chip strip. Horizontal scroll so households with many
                    lists don't get truncated. flexGrow:0 because of the
                    react-native-web quirk where horizontal ScrollViews try
                    to fill the column. Hidden while search is open — the
                    chip is a list-axis filter that wouldn't honestly
                    describe the search-results state below it (search
                    runs across all lists). Restored on Cancel. */}
                {!searchOpen ? (
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
                            // Chip vocabulary per the redesign (direction-c-pro.jsx
                            // CChip, ~880-894): active = filled accent + onAccent
                            // text (carries the "current selection" signal as a
                            // strong color block, not a list-color tint that would
                            // visually clash with the list-identity dots). Inactive
                            // = card surface + hair border, plus a small 6px color
                            // dot that holds the per-child identity signal.
                            return (
                                <Pressable
                                    key={`child-${c.id}`}
                                    onPress={() => setActiveChildId(c.id)}
                                    style={({ pressed }) => [
                                        styles.listChip,
                                        selected
                                            ? {
                                                  backgroundColor: colors.accent,
                                                  borderColor: colors.accent,
                                              }
                                            : {
                                                  backgroundColor:
                                                      colors.backgroundElement,
                                                  borderColor: colors.hair,
                                              },
                                        pressed && styles.pressed,
                                    ]}>
                                    {/* When selected the avatar already carries
                                        identity color; when not selected we
                                        still render it so the chip has a face. */}
                                    <ChildBadge
                                        name={c.display_name}
                                        color={c.color}
                                        size="sm"
                                    />
                                    <ThemedText
                                        style={[
                                            styles.chipLabel,
                                            {
                                                color: selected
                                                    ? colors.onAccent
                                                    : colors.text,
                                            },
                                        ]}>
                                        {c.display_name}
                                    </ThemedText>
                                    {openCount > 0 ? (
                                        <ThemedText
                                            style={[
                                                styles.chipCount,
                                                {
                                                    color: selected
                                                        ? colors.onAccent
                                                        : colors.textSecondary,
                                                },
                                            ]}>
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
                                    style={[
                                        styles.dropMarker,
                                        { backgroundColor: colors.accent },
                                    ]}
                                />,
                            );
                        }
                        // Chip vocabulary per the redesign (direction-c-pro.jsx
                        // CChip, ~880-894): active = filled accent + onAccent text
                        // (the strong color block is the selection signal). Inactive
                        // = card surface + hair border + a small 6px color dot that
                        // carries the per-list identity. We deliberately do NOT fill
                        // active chips with the list's own color — that would make
                        // every chip in the strip a different hue and the "selected"
                        // state would have to fight the identity signal for legibility.
                        // Phase 6.7 follow-up (#326): Edit affordance moved
                        // from a per-chip pencil button to a long-press /
                        // right-click context menu. The pencil added ~14px
                        // of horizontal real estate on every active chip
                        // for an action most users only reach occasionally;
                        // long-press is the iOS-native pattern and matches
                        // the "quiet UI" intent of the chip vocabulary.
                        // Lists v2 split (design_handoff_fab_rule):
                        // chip taps select the active list (handled by
                        // the outer Pressable's onPress). The long-press /
                        // right-click menu now routes to the *edit* form
                        // explicitly — read-mode detail lives at the
                        // sibling /list/[id] route and is reached by
                        // tapping a ListCardV2 in the "Your lists" row.
                        const openListMenu = () => {
                            if (Platform.OS === 'web') {
                                router.push({
                                    pathname: '/list/[id]/edit',
                                    params: { id: l.id },
                                });
                            } else {
                                Alert.alert(l.name, undefined, [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'View list',
                                        onPress: () =>
                                            router.push({
                                                pathname: '/list/[id]',
                                                params: { id: l.id },
                                            }),
                                    },
                                    {
                                        text: 'Edit list',
                                        onPress: () =>
                                            router.push({
                                                pathname: '/list/[id]/edit',
                                                params: { id: l.id },
                                            }),
                                    },
                                ]);
                            }
                        };
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
                                    onLongPress={openListMenu}
                                    delayLongPress={400}
                                    {...(Platform.OS === 'web'
                                        ? ({
                                              onContextMenu: (
                                                  e: { preventDefault: () => void },
                                              ) => {
                                                  e.preventDefault();
                                                  openListMenu();
                                              },
                                          } as object)
                                        : null)}
                                    accessibilityHint="Long-press to edit"
                                    style={({ pressed }) => [
                                        styles.listChip,
                                        selected
                                            ? {
                                                  backgroundColor: colors.accent,
                                                  borderColor: colors.accent,
                                              }
                                            : {
                                                  backgroundColor:
                                                      colors.backgroundElement,
                                                  borderColor: colors.hair,
                                              },
                                        Platform.OS === 'web' && !l.is_default
                                            ? ({ cursor: 'grab' } as object)
                                            : null,
                                        dragging && { opacity: 0.4 },
                                        pressed && styles.pressed,
                                    ]}>
                                    {/* Identity dot for inactive chips. The active
                                        chip's accent fill already says "selected"
                                        loud enough — adding the dot there would
                                        crowd the small chip with two color signals. */}
                                    {!selected ? (
                                        <View
                                            style={[
                                                styles.chipDot,
                                                { backgroundColor: l.color },
                                            ]}
                                        />
                                    ) : null}
                                    <ThemedText
                                        style={[
                                            styles.chipLabel,
                                            {
                                                color: selected
                                                    ? colors.onAccent
                                                    : colors.text,
                                            },
                                        ]}>
                                        {l.name}
                                    </ThemedText>
                                    {openCount > 0 ? (
                                        <ThemedText
                                            style={[
                                                styles.chipCount,
                                                {
                                                    color: selected
                                                        ? colors.onAccent
                                                        : colors.textSecondary,
                                                },
                                            ]}>
                                            · {openCount}
                                        </ThemedText>
                                    ) : null}
                                    {/* (Phase 6.7 follow-up #326: per-chip pencil
                                        removed. Edit is reachable via long-press
                                        on native or right-click on web — see
                                        openListMenu above.) */}
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
                        <View
                            key="marker-end"
                            style={[
                                styles.dropMarker,
                                { backgroundColor: colors.accent },
                            ]}
                        />
                    ) : null}
                    {/* Inline "+ New list" chip was removed — the floating FAB in
                        the bottom-right of this screen already creates new lists
                        with the same one-tap reach as Home / Calendar / Contacts.
                        Two affordances doing the same thing crowds the chip strip
                        without adding capability. */}
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
                ) : null}

                {/* Render the task pane when the active container exists for the
                    current view mode. by-list needs an activeList; by-child needs
                    an activeChild. */}
                {(viewMode === 'by-list' && activeList) ||
                (viewMode === 'by-child' && activeChildId) ? (
                    <>
                        {/* (Phase 8.x audit: Mine/All scope toggle removed —
                            design's ProLists has no such toggle, and Lists
                            shows all household tasks with per-person
                            filtering implicit via the assignee avatar on
                            each row. The bulk-mode "Select" button was
                            also removed for the same reason: the design
                            has no entry point for bulk select. Per-row
                            swipe (Done / +1d / Delete) covers the common
                            multi-task workflow at the row granularity the
                            design supports.) */}

                        {/* (Phase 8.x audit: Quick-add bar moved out of this
                            conditional and hoisted above the chip strip per
                            design — see ProLists direction-c-pro.jsx where
                            the Cmd-K input sits between the header and the
                            list chips, NOT below them.) */}

                        <ScrollView
                            style={styles.tasksScroll}
                            contentContainerStyle={styles.tasksContent}
                            showsVerticalScrollIndicator={false}>
                            {/* UX-009: inline spinner while tasks fetch on initial mount
                                or after a refetch. The chip strip + quick-add stay usable
                                above; only the row area shows the loading state. */}
                            {tasksLoading ? (
                                <View style={styles.empty}>
                                    <ActivityIndicator color={colors.text} />
                                </View>
                            ) : openTasks.length === 0 && completedTasks.length === 0 ? (
                                <View style={styles.empty}>
                                    <ThemedText themeColor="textSecondary">
                                        {searchActive
                                            ? `No tasks match "${searchText.trim()}".`
                                            : isCaregiver
                                              ? 'No tasks assigned to you here yet.'
                                              : 'No tasks yet. Type one above to get started.'}
                                    </ThemedText>
                                </View>
                            ) : null}

                            {/* Due-date bucketed sections per the redesign
                                (direction-c-pro.jsx ~989-1021). Each bucket
                                renders its rows inside a single white card
                                with hairline dividers between them — visually
                                groups the rows so the section reads as one
                                unit. Overdue's section header tints to
                                colors.alert; the others use the default ink-
                                secondary tracked-caps treatment. */}
                            {taskBuckets.overdue.length > 0 ? (
                                <TaskBucketSection
                                    label="Overdue"
                                    tasks={taskBuckets.overdue}
                                    accentColor={colors.alert}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expandedRowId={expandedRowId}
                                    setExpandedRowId={setExpandedRowId}
                                    handleToggleTaskList={
                                        handleToggleTaskList
                                    }
                                    handleToggleComplete={
                                        handleToggleComplete
                                    }
                                    handleTapTask={handleTapTask}
                                    handleDeleteTask={handleDeleteTask}
                                    handleSnoozeTask={handleSnoozeTask}
                                />
                            ) : null}
                            {taskBuckets.today.length > 0 ? (
                                <TaskBucketSection
                                    label="Today"
                                    tasks={taskBuckets.today}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expandedRowId={expandedRowId}
                                    setExpandedRowId={setExpandedRowId}
                                    handleToggleTaskList={
                                        handleToggleTaskList
                                    }
                                    handleToggleComplete={
                                        handleToggleComplete
                                    }
                                    handleTapTask={handleTapTask}
                                    handleDeleteTask={handleDeleteTask}
                                    handleSnoozeTask={handleSnoozeTask}
                                />
                            ) : null}
                            {taskBuckets.thisWeek.length > 0 ? (
                                <TaskBucketSection
                                    label="This week"
                                    tasks={taskBuckets.thisWeek}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expandedRowId={expandedRowId}
                                    setExpandedRowId={setExpandedRowId}
                                    handleToggleTaskList={
                                        handleToggleTaskList
                                    }
                                    handleToggleComplete={
                                        handleToggleComplete
                                    }
                                    handleTapTask={handleTapTask}
                                    handleDeleteTask={handleDeleteTask}
                                    handleSnoozeTask={handleSnoozeTask}
                                />
                            ) : null}
                            {taskBuckets.later.length > 0 ? (
                                <TaskBucketSection
                                    label="Later"
                                    tasks={taskBuckets.later}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expandedRowId={expandedRowId}
                                    setExpandedRowId={setExpandedRowId}
                                    handleToggleTaskList={
                                        handleToggleTaskList
                                    }
                                    handleToggleComplete={
                                        handleToggleComplete
                                    }
                                    handleTapTask={handleTapTask}
                                    handleDeleteTask={handleDeleteTask}
                                    handleSnoozeTask={handleSnoozeTask}
                                />
                            ) : null}

                            {completedTasks.length > 0 ? (
                                <TaskBucketSection
                                    label="Completed"
                                    tasks={completedTasks}
                                    members={members ?? []}
                                    colorMap={colorMap}
                                    allLists={lists ?? []}
                                    activeListId={activeList?.id ?? null}
                                    expandedRowId={expandedRowId}
                                    setExpandedRowId={setExpandedRowId}
                                    handleToggleTaskList={
                                        handleToggleTaskList
                                    }
                                    handleToggleComplete={
                                        handleToggleComplete
                                    }
                                    handleTapTask={handleTapTask}
                                    handleDeleteTask={handleDeleteTask}
                                    handleSnoozeTask={handleSnoozeTask}
                                />
                            ) : null}
                        </ScrollView>
                    </>
                ) : (
                    <View style={styles.empty}>
                        <ThemedText themeColor="textSecondary">
                            Tap a list above to see its tasks.
                        </ThemedText>
                    </View>
                )}
                {/* (Phase 8.x audit: bulk-action bar removed alongside the
                    Select button — design's ProLists doesn't surface a
                    bulk-select mode, and the per-row swipe panels (Done
                    / +1d / Delete) cover the common multi-task workflow
                    at the row granularity the design supports.) */}
            </SafeAreaView>
            {/* FAB — per the v2 FAB consistency rule
                (docs/design-handoffs/onenest-spec-v2/design_handoff_fab_rule/README.md):
                Lists is a kind-committed tab (tasks are the content), so the
                FAB short-circuits straight to /task/new and the label names
                the kind. The secondary "+ NEW LIST" affordance lives in the
                "Your lists" section header (Phase B of the v2 spec); for
                now the long-press / context-menu on a list chip still
                surfaces list editing, but the FAB no longer creates lists. */}
            {showCreateAffordances ? (
                <Pressable
                    onPress={() => router.push('/task/new')}
                    accessibilityRole="button"
                    accessibilityLabel="Create new task"
                    style={({ pressed }) => [
                        styles.fab,
                        { backgroundColor: colors.accent },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="plus" size={18} color={colors.onAccent} />
                    <ThemedText style={[styles.fabText, { color: colors.onAccent }]}>
                        New task
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

/**
 * A bucketed group of task rows — `Overdue` / `Today` / `This week` / `Later` /
 * `Completed`. Renders a SectionHeader above a single white card containing
 * the rows, with hairline dividers between them.  The accentColor prop tints
 * the section header (used by Overdue → colors.alert).
 *
 * Lives here so the bulk of the lists.tsx render block stays readable — the
 * Section + Card wrapper would otherwise repeat five times inline.
 */
function TaskBucketSection({
    label,
    tasks,
    accentColor,
    members,
    colorMap,
    allLists,
    activeListId,
    expandedRowId,
    setExpandedRowId,
    handleToggleTaskList,
    handleToggleComplete,
    handleTapTask,
    handleDeleteTask,
    handleSnoozeTask,
}: {
    label: string;
    tasks: Task[];
    accentColor?: string;
    members: { profile_id: string; display_name: string }[];
    colorMap: Map<string, string>;
    allLists: TaskList[];
    activeListId: string | null;
    expandedRowId: string | null;
    setExpandedRowId: (updater: (curr: string | null) => string | null) => void;
    handleToggleTaskList: (task: Task, listId: string) => void;
    handleToggleComplete: (task: Task) => void;
    handleTapTask: (task: Task) => void;
    handleDeleteTask: (task: Task) => void;
    handleSnoozeTask: (task: Task) => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={styles.bucketSection}>
            <View style={styles.bucketHeaderRow}>
                {/* Overdue gets its own accent color (alert red) per the design;
                    other buckets fall back to SectionHeader's default ink-secondary
                    tint. We hand-roll the label here for Overdue to inject the
                    color override; otherwise we use SectionHeader for shape +
                    count consistency. */}
                {accentColor ? (
                    <>
                        {/* paddingHorizontal: Spacing.one on both children so
                            this hand-rolled Overdue row visually aligns with
                            SectionHeader's internal horizontal padding (used
                            by the other buckets below). Without it, OVERDUE
                            sat 4px to the left of TODAY / THIS WEEK / etc. */}
                        <ThemedText
                            style={[
                                Typography.sectionHeader,
                                {
                                    color: accentColor,
                                    paddingHorizontal: Spacing.one,
                                },
                            ]}>
                            {label.toUpperCase()}
                        </ThemedText>
                        <ThemedText
                            style={[
                                styles.bucketCount,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoMedium,
                                    paddingHorizontal: Spacing.one,
                                },
                            ]}>
                            {tasks.length}
                        </ThemedText>
                    </>
                ) : (
                    <View style={styles.bucketHeaderShim}>
                        <SectionHeader label={label} count={tasks.length} />
                    </View>
                )}
            </View>
            <View
                style={[
                    styles.bucketCard,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {tasks.map((t, idx) => (
                    <TaskRow
                        key={t.id}
                        task={t}
                        members={members}
                        colorMap={colorMap}
                        allLists={allLists}
                        activeListId={activeListId}
                        expanded={expandedRowId === t.id}
                        onToggleExpanded={() =>
                            setExpandedRowId((curr) =>
                                curr === t.id ? null : t.id,
                            )
                        }
                        onToggleList={(listId) =>
                            handleToggleTaskList(t, listId)
                        }
                        onToggle={() => handleToggleComplete(t)}
                        onTap={() => handleTapTask(t)}
                        onDelete={() => handleDeleteTask(t)}
                        onSnooze={() => handleSnoozeTask(t)}
                        // Last row in the bucket skips its bottom divider —
                        // the card's own bottom edge is the visual end.
                        isLast={idx === tasks.length - 1}
                    />
                ))}
            </View>
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1 },
    // SafeAreaView edges={['top']} handles the notch; the page header below
    // carries its own padding. Removed the bare Spacing.four top padding that
    // was a workaround for the now-restored screen title.
    safe: { flex: 1 },
    // Mist Forest page-level header — counts strip + 22px title on the
    // left, 30x30 search button on the right (direction-c-pro.jsx
    // ~947-964). The search button toggles a mode-swap input below.
    pageHeader: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pageHeaderLeft: { flex: 1 },
    countsStrip: {
        fontSize: 10,
        letterSpacing: -0.2,
    },
    headerSearchBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Search row's trailing "Cancel" link. Mono semibold accent — same
    // vocabulary as the "+ NEW LIST" link so the affordance reads as a
    // peer chrome control, not a destructive button.
    searchCancelText: {
        fontSize: 12,
        letterSpacing: -0.2,
    },
    // "Your lists" card-row header — caps section label on the left,
    // mono accent "+ NEW LIST" link on the right. Lives between the
    // Cmd-K quick-add row and the chip strip.
    yourListsHeader: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    yourListsHeaderLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    yourListsNewLink: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    // Horizontal-scroll row holding ListCardV2 cards + the trailing
    // NewListCard. flexGrow:0 mirrors chipScroll for the same RN-web
    // height quirk.
    yourListsScroll: { flexGrow: 0, flexShrink: 0 },
    yourListsRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 14,
        alignItems: 'stretch',
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
    // Chip vocabulary from the design (direction-c-pro.jsx CChip ~881-894):
    // pill-shaped 0.5px hair border, exact `padding: '4px 10px'`. Active
    // chips fill with accent + drop the border into the same color; inactive
    // chips sit on the card surface with a leading 6px identity dot. No
    // PILL_SHADOW lift, no inactive opacity dim — neither is in the spec,
    // and the accent-fill alone carries the selection signal cleanly. The
    // paddingVertical landed at literal 4 (not Spacing.one + 2 = 6) so the
    // chip's height matches the design — the previous +2 padded chips
    // significantly taller than the source.
    listChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    // Chip label typography per direction-c-pro.jsx CChip (~887):
    // `fontSize: 11.5, fontWeight: 600, letterSpacing: -0.1`. We bypass
    // ThemedText's `type="small"` preset (which is 14/500) so the chip
    // text matches the design's compact mono-adjacent tag-like weight.
    // Used by both list chips and child chips so the strip reads
    // consistently across view modes.
    chipLabel: {
        fontSize: 11.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    // Open-count suffix ("· 4") that follows the label. Same size +
    // letter-spacing as the label so the two read as one continuous
    // chip caption, but slightly lighter (weight 500 + 75% opacity) so
    // the label remains the dominant glyph. Lives inside the chip body
    // and inherits the chip's gap:5 — no extra margin needed.
    chipCount: {
        fontSize: 11.5,
        fontWeight: '500',
        letterSpacing: -0.1,
        opacity: 0.75,
    },
    // 6px identity dot rendered inside inactive chips. Carries the per-list
    // (or per-child) color signal without filling the chip body. Hidden on
    // the active chip — see the chip render site for why.
    chipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    // Each chip is wrapped so we can render an optional drop marker as its sibling
    // without breaking the flex layout. The wrapper itself has no margin/padding;
    // chipRow's `gap` handles spacing between wrappers.
    chipWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
    },
    // Drop-position indicator during a drag. Vertical accent bar tall enough
    // to span the chip height. backgroundColor is set inline at the render
    // site so it tracks colors.accent (brighter green in dark mode).
    dropMarker: {
        width: 3,
        height: 28,
        borderRadius: 2,
    },
    // (Phase 6.7 follow-up #326: chipEditBtn removed with the pencil button.)
    // (Phase 8.x audit: scopeRow / viewToggleRow / scopeToggle / scopeBtn /
    // hiddenHint / selectBtn / bulkBar / bulkBarRow / bulkBarActions /
    // bulkBtn / bulkBtnInline / bulkListPicker were removed alongside the
    // Mine/All toggle, by-list/by-child toggle, Select button, and
    // bulk-action bar — none in the design source, none reachable now.)

    // Cmd-N quick-add bar. 0.5px hair border + 10px radius per the redesign
    // (vs. the old 1px + Spacing.two radius "form input" treatment). Sits on
    // backgroundElement so it lifts off the page bg the same way cards do.
    quickAddRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: Spacing.three,
        marginBottom: Spacing.three,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    quickAddInput: {
        flex: 1,
        fontSize: 12,
        letterSpacing: -0.2,
        // Trim platform-default vertical padding; the row's paddingVertical
        // already gives the input its breathing room and the design renders
        // the placeholder snug against the leading "+".
        paddingVertical: 0,
    },
    // Trailing ⌘N kbd-style pill. Tiny mono badge with an accent-tinted bg,
    // matches the design's "this is a keyboard shortcut hint" treatment in
    // the AI Cmd-K input pattern.
    kbdBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 3,
    },
    kbdBadgeText: {
        fontSize: 9.5,
        letterSpacing: -0.2,
    },
    tasksScroll: { flex: 1 },
    tasksContent: {
        paddingHorizontal: Spacing.three,
        paddingBottom: Spacing.six,
    },
    empty: {
        padding: Spacing.six,
        alignItems: 'center',
    },
    // Due-date bucket section ("Overdue" / "Today" / "This week" / etc.).
    // Sits as a stand-alone unit: caps section header + count above, white
    // card with hairline dividers between rows below. paddingTop spaces it
    // from the preceding bucket — the old gap:Spacing.two on tasksContent
    // gave every row+section the same spacing, which doesn't match the
    // design's "header floats slightly above its card" pattern.
    bucketSection: {
        paddingTop: Spacing.three,
    },
    // paddingHorizontal dropped — SectionHeader owns its own horizontal
    // padding (`Spacing.one` baked into its row), and we were doubling it
    // for non-Overdue buckets while the Overdue branch (hand-rolled label)
    // only got the row's 4px. Net result was misaligned bucket headers.
    // Letting SectionHeader own the padding fixes both branches.
    bucketHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingBottom: Spacing.two,
    },
    // Shim wraps SectionHeader so its internal horizontal padding doesn't
    // double up with bucketHeaderRow's. SectionHeader is fixed-shape but it
    // owns its own justify-between; we drop the row's flex on it via
    // flex:1 here so it spans the available width.
    bucketHeaderShim: { flex: 1 },
    bucketCount: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    // White card wrapping each bucket's rows. 10px radius + 0.5px hair
    // border per direction-c-pro.jsx (~992, ~1002, ~1014). overflow:hidden
    // keeps the row hairline dividers inside the card's rounded corners.
    bucketCard: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    pressed: { opacity: 0.7 },
    // UX-004: FAB anchored bottom-right. Mirrors src/app/(app)/index.tsx fab/fabText
    // so the create affordance reads identically on Home, Calendar, and Lists.
    // FAB pill — same vocabulary as Home / Calendar / Contacts. Background +
    // text color are applied inline at the render site so they track
    // colors.accent / colors.onAccent across themes.
    fab: {
        position: 'absolute',
        right: 16,
        // Matches Home's fabPill `bottom: 16` (index.tsx). The legacy 96
        // here was protecting against a tab-bar overlap that no longer
        // applies — the bottom tab bar sits below the screen area, not
        // overlaid on it, so the FAB only needs ~16px of breathing room
        // from the screen-area bottom edge.
        bottom: 16,
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
});
