import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    addDays,
    addMonths,
    addWeeks,
    format,
    isBefore,
    isSameDay,
    isSameMonth,
    isToday,
    parseISO,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths,
    subWeeks,
} from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { EventChildBadges } from '@/components/event-child-badges';
import { LoadingScreen } from '@/components/loading-screen';
import {
    ScrollOverflowChevron,
    useHorizontalOverflow,
} from '@/components/scroll-overflow-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { FAB_SHADOW, withAlpha } from '@/lib/platform-styles';
import { useChildren } from '@/hooks/use-children';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useEventOccurrenceOverrides } from '@/hooks/use-event-occurrence-overrides';
import { useEvents } from '@/hooks/use-events';
import { useHouseholdBusyBlocks } from '@/hooks/use-household-busy-blocks';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { useMyExternalEvents } from '@/hooks/use-my-external-events';
import { memberColorMap, colorForResponsible } from '@/lib/colors';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import type { Event, ExternalEvent, HouseholdBusyBlock } from '@/lib/db';
import { parseRecurrence } from '@/lib/recurrence';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
import { iconForType } from '@/lib/event-types';
import { useAppColorScheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';

const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_COLUMN_WIDTH = 56;
const DEFAULT_SCROLL_HOUR = 7;
const ALL_DAY_ROW_HEIGHT = 28;

// Drag-to-create snaps to 15-minute increments. Empty-space click without drag creates a
// single 15-minute slot at the snapped start time — turns a stray click into a quick
// "add a 15-min slot here" rather than an annoying full-form-with-arbitrary-time.
const DRAG_SNAP_MIN = 15;

/** Pixel y inside a day column → minute-of-day, clamped to [0, 1439]. */
function yToMinutes(y: number): number {
    const m = Math.round((y / HOUR_HEIGHT) * 60);
    return Math.max(0, Math.min(24 * 60 - 1, m));
}
function snapMinutes(m: number): number {
    return Math.round(m / DRAG_SNAP_MIN) * DRAG_SNAP_MIN;
}
function minutesToHHmm(m: number): string {
    const mm = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(mm / 60);
    const min = mm % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Marker prop spread onto every block inside a day column (events + busy windows).
// React Native Web rewrites `dataSet={{ calBlock: 'true' }}` to `data-cal-block="true"`
// on the DOM, and the drag-to-create pointerdown handler uses
// `closest('[data-cal-block]')` to bail when the user clicks on a block instead of empty
// space. Casting because RN's bundled types don't include dataSet (RN-web supports it).
const CAL_BLOCK_DATASET = { dataSet: { calBlock: 'true' } } as object;

// Calendar view toggle. Day and Week share the same time-grid renderer with a different
// number of columns; Month gets its own compact grid renderer with dot indicators.
type ViewMode = 'day' | 'week' | 'month';
const VIEW_MODE_STORAGE_KEY = 'onenest:calendar-view-mode';
// UX-029: persistent press-and-hold discoverability hint. Native-only — web
// uses drag-to-create with a crosshair cursor that already communicates
// interactivity. We show the hint for the first N Calendar sessions even when
// the user has events (the empty-state banner only fires on zero events, so
// users with even one event never saw the long-press copy). After N visits OR
// after the first successful long-press OR after manual dismissal, the hint
// is gone for good.
const LONGPRESS_HINT_STORAGE_KEY = 'onenest:calendar-longpress-hint';
const LONGPRESS_HINT_MAX_SHOWS = 3;
const VIEW_MODES: ViewMode[] = ['day', 'week', 'month'];
function isViewMode(v: unknown): v is ViewMode {
    return v === 'day' || v === 'week' || v === 'month';
}

function formatHourLabel(h: number): string {
    if (h === 0) return '';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
}

function eventsForDay(events: Event[], day: Date): Event[] {
    return events.filter((e) => isSameDay(new Date(e.starts_at), day));
}

/**
 * "Does this all-day event cover the given day?" An all-day event from Mon to Wed
 * (inclusive) is stored at UTC midnight: starts_at = Mon 00:00 UTC, ends_at = Thu
 * 00:00 UTC (exclusive). The viewer's day cell is identified by its local
 * calendar date (`day` is a local-time Date object whose YYYY-MM-DD label is
 * what the user sees in the header). To check coverage we compare YYYY-MM-DD
 * strings: the day cell's local-date key against the event's UTC-date range.
 * Both sides agree because UTC midnight resolves to the same calendar date in
 * every viewer's local rendering (QA-005).
 *
 * Single-day events fall out as a special case — start === end-1day, so
 * dayKey === startKey passes and dayKey > startKey fails.
 *
 * Timed events that span midnight still only show on their start day — those
 * aren't currently representable through "all-day", so we keep the simpler
 * semantic for them.
 */
function allDayEventsForDay(allDayEvents: Event[], day: Date): Event[] {
    const dayKey = format(day, 'yyyy-MM-dd');
    return allDayEvents.filter((e) => {
        const startKey = e.starts_at.slice(0, 10);
        const endExclusive = new Date(e.ends_at);
        // exclusive UTC end → inclusive last-covered UTC date
        endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
        const endKey = endExclusive.toISOString().slice(0, 10);
        return dayKey >= startKey && dayKey <= endKey;
    });
}

export default function CalendarScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { user } = useAuth();
    const { households } = useHouseholds();
    const household = households?.[0];
    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    const { children, refetch: refetchChildren } = useChildren(household?.id);
    // Caregivers see Calendar read-only: no FAB, no drag/tap-to-create on the
    // grid, no tappable custody bands. RLS in migration 0031 enforces the same
    // boundary server-side; this is the UI defense layer. `roleLoading` guards
    // against a one-frame FAB flash for caregivers on cold start.
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const showCreateAffordances = !roleLoading && !isCaregiver;
    const { schedule: custodySchedule, refetch: refetchCustody } = useCustodySchedule(
        household?.id,
    );

    // Calendar-only child filter. Resets each session — we don't persist the selection
    // because users generally want the full picture by default, and the pill makes the
    // current filter obvious. null = "All".
    const [childFilter, setChildFilter] = useState<string | null>(null);
    // UX-010: overflow indicator for the child-filter chip strip. Drives the
    // right-edge chevron rendered alongside the ScrollView.
    const childFilterOverflow = useHorizontalOverflow();

    // View toggle. Default to Week until the persisted value hydrates. We accept the small
    // first-paint flash because the alternative (suspending render) makes the screen feel
    // janky on cold start.
    const [viewMode, setViewModeState] = useState<ViewMode>('week');
    useEffect(() => {
        AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
            .then((v) => {
                if (isViewMode(v)) setViewModeState(v);
            })
            .catch(() => undefined);
    }, []);
    const setViewMode = useCallback((next: ViewMode) => {
        setViewModeState(next);
        AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, next).catch(() => undefined);
    }, []);

    // UX-029: native press-and-hold tip state. `null` until AsyncStorage
    // resolves so we don't flash the hint on cold start for users who've
    // already seen it. After mount we increment the persisted count; if the
    // post-increment value exceeds the show limit, the hint stays hidden.
    // Dismissing manually OR firing a successful long-press both bump the
    // count past the limit so the hint goes away immediately.
    const [longPressHintVisible, setLongPressHintVisible] = useState<boolean | null>(
        Platform.OS === 'web' ? false : null,
    );
    useEffect(() => {
        if (Platform.OS === 'web') return;
        let active = true;
        AsyncStorage.getItem(LONGPRESS_HINT_STORAGE_KEY)
            .then((raw) => {
                const prev = raw ? Number(raw) || 0 : 0;
                const next = prev + 1;
                AsyncStorage.setItem(
                    LONGPRESS_HINT_STORAGE_KEY,
                    String(next),
                ).catch(() => undefined);
                if (active) setLongPressHintVisible(next <= LONGPRESS_HINT_MAX_SHOWS);
            })
            .catch(() => {
                if (active) setLongPressHintVisible(false);
            });
        return () => {
            active = false;
        };
    }, []);
    const dismissLongPressHint = useCallback(() => {
        setLongPressHintVisible(false);
        AsyncStorage.setItem(
            LONGPRESS_HINT_STORAGE_KEY,
            String(LONGPRESS_HINT_MAX_SHOWS + 1),
        ).catch(() => undefined);
    }, []);

    // `anchor` is the "current position" date the user is looking at. Its meaning depends
    // on the active view:
    //   - day:   the single day shown
    //   - week:  any date inside the displayed week (we derive the Sunday on the fly)
    //   - month: any date inside the displayed month (we derive the first-day on the fly)
    // Keeping anchor view-agnostic means switching views preserves "where" you were
    // looking instead of resetting to today.
    const [anchor, setAnchor] = useState<Date>(() => new Date());

    // Derive the fetch range and the day cells the grid renders. Month view fetches a 6-week
    // window starting from the Sunday on/before the first of the month, which is what the
    // month grid renders.
    const { rangeStart, numDays, days } = useMemo(() => {
        if (viewMode === 'day') {
            const day = new Date(
                anchor.getFullYear(),
                anchor.getMonth(),
                anchor.getDate(),
            );
            return { rangeStart: day, numDays: 1, days: [day] };
        }
        if (viewMode === 'week') {
            const start = startOfWeek(anchor, { weekStartsOn: 0 });
            const out: Date[] = [];
            for (let i = 0; i < 7; i++) out.push(addDays(start, i));
            return { rangeStart: start, numDays: 7, days: out };
        }
        // month: fetch a 6-row × 7-col grid starting from the Sunday on/before the 1st.
        const first = startOfMonth(anchor);
        const start = startOfWeek(first, { weekStartsOn: 0 });
        const out: Date[] = [];
        for (let i = 0; i < 42; i++) out.push(addDays(start, i));
        return { rangeStart: start, numDays: 42, days: out };
    }, [viewMode, anchor]);
    const rangeEndInclusive = useMemo(
        () => addDays(rangeStart, numDays - 1),
        [rangeStart, numDays],
    );

    // UX-025: the past-day dim should only fire when the visible range
    // anchors against the present — i.e. when today or a future day is on
    // screen. If the user has navigated entirely into the past (e.g.
    // browsing last month for reference), dimming every cell to 55% just
    // makes a wall of washed-out data. In that case the "where am I in
    // time" cue isn't needed; show everything at full opacity.
    const rangeAnchorsPresentOrFuture = useMemo(
        () => days.some((d) => !isBefore(d, startOfDay(new Date()))),
        [days],
    );

    const { overrides: custodyOverrides, refetch: refetchOverrides } = useCustodyOverrides(
        household?.id,
        rangeStart,
        rangeEndInclusive,
    );
    const {
        overrideMap: occurrenceOverrideMap,
        refetch: refetchOccurrenceOverrides,
    } = useEventOccurrenceOverrides(household?.id, rangeStart, rangeEndInclusive);
    const { events, isLoading, refetch: refetchEvents } = useEvents(
        household?.id,
        rangeStart,
        numDays,
    );
    const { events: externalEvents, refetch: refetchExternalEvents } = useMyExternalEvents(
        rangeStart,
        numDays,
    );
    // Caregivers don't get busy blocks. The server-side RPC
    // (household_busy_blocks) was tightened to parent-only in migration 0032 —
    // calling it as a caregiver would 42501; pass undefined household_id so the
    // hook short-circuits without firing. Defense in depth: even if the RPC
    // were left open, parents' opaque busy windows shouldn't leak the quantity
    // and timing of their external commitments to a nanny.
    const { blocks: householdBusyBlocks, refetch: refetchBusyBlocks } = useHouseholdBusyBlocks(
        isCaregiver ? undefined : household?.id,
        rangeStart,
        numDays,
    );

    useFocusEffect(
        useCallback(() => {
            refetchEvents();
            refetchMembers();
            refetchChildren();
            refetchCustody();
            refetchOverrides();
            refetchOccurrenceOverrides();
            refetchExternalEvents();
            refetchBusyBlocks();
        }, [
            refetchEvents,
            refetchMembers,
            refetchChildren,
            refetchCustody,
            refetchOverrides,
            refetchOccurrenceOverrides,
            refetchExternalEvents,
            refetchBusyBlocks,
        ]),
    );

    const overrideMap = useMemo(
        () => buildOverrideMap(custodyOverrides),
        [custodyOverrides],
    );

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    // Apply the child filter before splitting all-day vs timed so both lists share the
    // same visibility rule. Household-wide events (empty child_ids) always show — they
    // affect everyone, and hiding "Family dinner" when filtering to Anna would feel like
    // a bug. Selected-child events show when the filter matches.
    const visibleEvents = useMemo(() => {
        const all = events ?? [];
        if (!childFilter) return all;
        return all.filter(
            (e) =>
                e.child_ids.length === 0 || e.child_ids.includes(childFilter),
        );
    }, [events, childFilter]);

    // Pre-bucket events by their YYYY-MM-DD start key for the month grid's per-cell
    // lookup. Cheaper than scanning visibleEvents 42 times per render. Sorted by start
    // so the first three dots reliably reflect the earliest events of the day.
    //
    // Multi-day all-day events get a dot on EVERY day they cover, not just the
    // start day — same convention as the all-day chip in week/day view. Timed
    // events only appear on their start day (we don't currently support timed
    // events that span midnight as a first-class concept).
    const eventsByDay = useMemo(() => {
        const map = new Map<string, Event[]>();
        const sorted = [...visibleEvents].sort(
            (a, b) =>
                new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        );
        for (const e of sorted) {
            const start = new Date(e.starts_at);
            const end = new Date(e.ends_at);
            if (e.all_day) {
                // QA-005: walk each UTC calendar day in [start, end). All-day
                // events are anchored at UTC midnight, so a Mon→Wed inclusive
                // run is [Mon 00:00 UTC, Thu 00:00 UTC). We compare YYYY-MM-DD
                // strings (cheap and tz-stable) and advance via setUTCDate so
                // DST doesn't shift the iteration.
                const cursor = new Date(start);
                const endKey = end.toISOString().slice(0, 10);
                while (cursor.toISOString().slice(0, 10) < endKey) {
                    const key = cursor.toISOString().slice(0, 10);
                    const arr = map.get(key);
                    if (arr) arr.push(e);
                    else map.set(key, [e]);
                    cursor.setUTCDate(cursor.getUTCDate() + 1);
                }
            } else {
                const key = format(start, 'yyyy-MM-dd');
                const arr = map.get(key);
                if (arr) arr.push(e);
                else map.set(key, [e]);
            }
        }
        return map;
    }, [visibleEvents]);

    const allDayEvents = useMemo(
        () => visibleEvents.filter((e) => e.all_day),
        [visibleEvents],
    );
    const timedEvents = useMemo(
        () => visibleEvents.filter((e) => !e.all_day),
        [visibleEvents],
    );
    const timedExternalEvents = useMemo(
        () => (externalEvents ?? []).filter((e) => !e.is_all_day),
        [externalEvents],
    );
    const externalEventsForDay = (day: Date): ExternalEvent[] =>
        timedExternalEvents.filter((e) => isSameDay(new Date(e.starts_at), day));

    // Other members' opaque busy windows from household_busy_blocks() RPC. We filter out our
    // own (those come from useMyExternalEvents above with full titles).
    const otherMembersBusyBlocks = useMemo<HouseholdBusyBlock[]>(
        () =>
            (householdBusyBlocks ?? []).filter(
                (b) => !b.is_all_day && (!user || b.profile_id !== user.id),
            ),
        [householdBusyBlocks, user],
    );
    const otherMembersBusyForDay = (day: Date): HouseholdBusyBlock[] =>
        otherMembersBusyBlocks.filter((b) => isSameDay(new Date(b.starts_at), day));

    const gridScrollRef = useRef<ScrollView | null>(null);
    useEffect(() => {
        // Re-fire on every Day/Week mount, not just initial CalendarScreen mount.
        // Switching to Month unmounts the inner ScrollView (it's in a non-month
        // conditional branch), and switching back remounts it at scroll-top
        // (midnight). Keying this effect on viewMode keeps the 7AM landing
        // consistent across view re-entries. Gated to non-month so the timer
        // doesn't fire pointlessly while the user is in Month view.
        if (viewMode === 'month') return;
        const t = setTimeout(() => {
            gridScrollRef.current?.scrollTo({
                y: DEFAULT_SCROLL_HOUR * HOUR_HEIGHT,
                animated: false,
            });
        }, 0);
        return () => clearTimeout(t);
    }, [viewMode]);

    // ─── Drag-to-create (web only) ──────────────────────────────────────────────
    // Click + drag on an empty area of a day column creates an event with the dragged
    // time range. Tap (no drag) creates a single 15-minute slot.
    //
    // Implementation: we attach native `pointerdown` to each day column's DOM node
    // (react-native-web's View ref IS the underlying div). The handler bails when the
    // click lands on an existing event/busy block — those carry data-cal-block via
    // `dataSet`, and `closest()` catches the bubbled event regardless of z-index.
    //
    // During drag we render a translucent "ghost" preview inside the active column. On
    // pointerup we router.push('/event/new', { date, startTime, endTime }) — the new
    // route reads these params and pre-fills the form.
    //
    // Native (iOS/Android) handling deferred until we're on an EAS build. Pointer
    // events don't translate cleanly through react-native-gesture-handler, and we'd
    // want a long-press to start the drag anyway to avoid stealing taps.
    type DragState = {
        dayIndex: number;
        startMins: number;
        endMins: number;
    };
    const [dragState, setDragState] = useState<DragState | null>(null);
    // Mirror of dragState in a ref so the pointer handlers can read the latest value
    // synchronously without going through React's state-batching. We also need a
    // synchronous read on pointerup so the navigation can fire OUTSIDE the React commit
    // phase — `router.push` inside a setState updater triggers a "Cannot update a
    // component while rendering a different component" warning because Navigation's
    // setState lands during the calendar's render.
    const dragStateRef = useRef<DragState | null>(null);
    const setDrag = useCallback((next: DragState | null) => {
        dragStateRef.current = next;
        setDragState(next);
    }, []);
    const dayColRefs = useRef<Array<HTMLDivElement | null>>([]);
    useEffect(() => {
        // Trim stale refs when switching from Week (7) to Day (1) so the effect below
        // doesn't try to attach to ghosts from the previous render.
        dayColRefs.current.length = days.length;
    }, [days.length]);

    // QA-010: track an in-flight drag's window-level handlers so the outer
    // effect's cleanup can detach them. Without this, switching viewMode /
    // anchor / days mid-drag re-runs the effect, removes pointerdown but
    // leaks the active pointermove/pointerup handlers — they keep firing
    // against a stale `days` array and `rect`.
    const activeDragHandlersRef = useRef<{
        onMove: (e: PointerEvent) => void;
        onUp: (e: PointerEvent) => void;
    } | null>(null);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (viewMode === 'month') return;
        // Caregivers can't create events (RLS would block the insert anyway),
        // so skip wiring the drag-to-create listeners. Their tap on an empty
        // grid cell falls through to a no-op instead of opening /event/new.
        if (isCaregiver) return;
        const cleanups: Array<() => void> = [];
        dayColRefs.current.forEach((el, idx) => {
            if (!el) return;
            const onDown = (e: PointerEvent) => {
                if (e.button !== 0) return; // left button only
                const target = e.target as HTMLElement | null;
                if (target?.closest('[data-cal-block]')) return; // landed on event/busy
                e.preventDefault();
                const rect = el.getBoundingClientRect();
                const y0 = e.clientY - rect.top;
                const startMins = snapMinutes(yToMinutes(y0));
                setDrag({
                    dayIndex: idx,
                    startMins,
                    endMins: startMins + DRAG_SNAP_MIN,
                });
                const onMove = (ev: PointerEvent) => {
                    const prev = dragStateRef.current;
                    if (!prev) return;
                    const y = ev.clientY - rect.top;
                    const m = snapMinutes(yToMinutes(y));
                    setDrag({
                        ...prev,
                        endMins: Math.max(prev.startMins + DRAG_SNAP_MIN, m),
                    });
                };
                const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                    activeDragHandlersRef.current = null;
                    // Snapshot final state from the ref, clear, THEN navigate. The
                    // navigation must happen outside the setState callback to keep
                    // Navigation's own setState from running inside this component's
                    // commit phase.
                    const curr = dragStateRef.current;
                    setDrag(null);
                    if (curr) {
                        const day = days[curr.dayIndex];
                        if (day) {
                            router.push({
                                pathname: '/event/new',
                                params: {
                                    date: format(day, 'yyyy-MM-dd'),
                                    startTime: minutesToHHmm(curr.startMins),
                                    endTime: minutesToHHmm(curr.endMins),
                                },
                            });
                        }
                    }
                };
                activeDragHandlersRef.current = { onMove, onUp };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
            };
            el.addEventListener('pointerdown', onDown);
            cleanups.push(() => el.removeEventListener('pointerdown', onDown));
        });
        return () => {
            cleanups.forEach((c) => c());
            // Detach the in-flight drag's window listeners on view change so
            // they don't fire against stale `days` / `rect` data once the
            // effect closure goes out of scope (QA-010).
            const active = activeDragHandlersRef.current;
            if (active) {
                window.removeEventListener('pointermove', active.onMove);
                window.removeEventListener('pointerup', active.onUp);
                activeDragHandlersRef.current = null;
                setDrag(null);
            }
        };
    }, [days, viewMode, router, setDrag, isCaregiver]);

    // ─── Native press-and-hold to create (UX-005 + UX-017) ─────────────────────
    // Drag-to-create is web-only (the pointer-events API doesn't translate cleanly
    // to react-native-gesture-handler without an EAS build). On native we give the
    // user the closest equivalent: PRESS AND HOLD an empty spot on a day column
    // (~500 ms) and we open /event/new with the day's date + a start time snapped
    // to the nearest 15-min slot under the touch.
    //
    // UX-017: the initial tap-to-fire was too eager — a stray finger touch while
    // scrolling the grid would route into /event/new for an event the user never
    // wanted. Long-press is the standard mobile "I really mean this" affordance:
    // it filters out scroll-through taps and accidental brushes, while still
    // giving native users a meaningful way to create at a specific time.
    // A plain tap on empty space now does nothing — matches the convention that
    // a tap on the grid is a "look at this slot" gesture, not a destructive one.
    // Event blocks + busy blocks are their own Pressables, so they still consume
    // taps for navigation before this fallback fires.
    const handleDayColumnTapNative = useCallback(
        (day: Date, locationY: number) => {
            // Caregivers can't create events; swallow the long-press silently.
            // (The hint banner doesn't render for them either — see the
            // !isCaregiver gate on the banner below.)
            if (isCaregiver) return;
            // UX-029: a successful press-and-hold means the user discovered the
            // gesture, so the persistent hint has done its job — stop showing it.
            dismissLongPressHint();
            const startMins = snapMinutes(yToMinutes(locationY));
            const endMins = startMins + DRAG_SNAP_MIN;
            router.push({
                pathname: '/event/new',
                params: {
                    date: format(day, 'yyyy-MM-dd'),
                    startTime: minutesToHHmm(startMins),
                    endTime: minutesToHHmm(endMins),
                },
            });
        },
        [router, dismissLongPressHint, isCaregiver],
    );

    // Header label is view-specific:
    //   - day:   "Tuesday, May 22, 2026"
    //   - week:  "May 17 – May 23, 2026"
    //   - month: "May 2026"
    const headerLabel = useMemo(() => {
        if (viewMode === 'day') {
            return format(days[0], 'EEEE, MMM d, yyyy');
        }
        if (viewMode === 'week') {
            const last = days[days.length - 1];
            return `${format(days[0], 'MMM d')} – ${format(last, 'MMM d, yyyy')}`;
        }
        return format(anchor, 'MMMM yyyy');
    }, [viewMode, days, anchor]);

    // Step forward/back by the view-appropriate unit.
    const stepBack = useCallback(() => {
        if (viewMode === 'day') setAnchor((a) => addDays(a, -1));
        else if (viewMode === 'week') setAnchor((a) => subWeeks(a, 1));
        else setAnchor((a) => subMonths(a, 1));
    }, [viewMode]);
    const stepForward = useCallback(() => {
        if (viewMode === 'day') setAnchor((a) => addDays(a, 1));
        else if (viewMode === 'week') setAnchor((a) => addWeeks(a, 1));
        else setAnchor((a) => addMonths(a, 1));
    }, [viewMode]);
    const jumpToToday = useCallback(() => setAnchor(new Date()), []);

    const hasAllDay = allDayEvents.length > 0;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    {/* Day / Week / Month pill toggle. Lives above the nav row so it's the
                        first thing the eye lands on and so the nav-arrow step semantics
                        are clearly tied to it. */}
                    <View style={styles.viewToggleRow}>
                        {VIEW_MODES.map((mode) => {
                            const selected = viewMode === mode;
                            return (
                                <Pressable
                                    key={mode}
                                    onPress={() => setViewMode(mode)}
                                    style={({ pressed }) => [
                                        styles.viewToggleChip,
                                        {
                                            borderColor: colors.backgroundSelected,
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
                                            fontWeight: '600',
                                            textTransform: 'capitalize',
                                        }}>
                                        {mode}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                    <View style={styles.headerRow}>
                        <Pressable
                            onPress={stepBack}
                            accessibilityRole="button"
                            accessibilityLabel={`Previous ${viewMode}`}
                            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
                            <ThemedText themeColor="textSecondary" type="subtitle">
                                ‹
                            </ThemedText>
                        </Pressable>
                        <View style={styles.headerTitle}>
                            <ThemedText type="smallBold">{headerLabel}</ThemedText>
                            {household ? (
                                <ThemedText themeColor="textSecondary" type="small">
                                    {household.name}
                                </ThemedText>
                            ) : null}
                        </View>
                        <Pressable
                            onPress={stepForward}
                            accessibilityRole="button"
                            accessibilityLabel={`Next ${viewMode}`}
                            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
                            <ThemedText themeColor="textSecondary" type="subtitle">
                                ›
                            </ThemedText>
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={jumpToToday}
                        style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary" type="small">
                            Jump to today
                        </ThemedText>
                    </Pressable>
                </View>

                {/* Per-child filter pill row. Hidden for households with no kids — there's
                    nothing to filter by. "All" stays selected by default. Household-wide
                    events (no child tags) stay visible no matter which kid is selected. */}
                {children && children.length > 0 ? (
                    <View style={styles.filterScrollWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        // flexGrow:0 stops react-native-web from letting this horizontal
                        // ScrollView consume the column's leftover vertical space (without it
                        // the filter row would push the calendar grid halfway down the screen).
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterRow}
                        onContentSizeChange={childFilterOverflow.onContentSizeChange}
                        onLayout={childFilterOverflow.onLayout}
                        onScroll={childFilterOverflow.onScroll}
                        scrollEventThrottle={32}>
                        <Pressable
                            onPress={() => setChildFilter(null)}
                            style={({ pressed }) => [
                                styles.filterChip,
                                {
                                    borderColor: colors.backgroundSelected,
                                    backgroundColor:
                                        childFilter === null
                                            ? '#6F7FA5'
                                            : 'transparent',
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                type="small"
                                style={{
                                    color: childFilter === null ? '#fff' : colors.text,
                                    fontWeight: '600',
                                }}>
                                All
                            </ThemedText>
                        </Pressable>
                        {children.map((c) => {
                            const selected = childFilter === c.id;
                            return (
                                <Pressable
                                    key={c.id}
                                    onPress={() => setChildFilter(c.id)}
                                    style={({ pressed }) => [
                                        styles.filterChip,
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
                                            color: colors.text,
                                            fontWeight: '500',
                                        }}>
                                        {c.display_name}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                    <ScrollOverflowChevron
                        visible={childFilterOverflow.showLeftIndicator}
                        side="left"
                    />
                    <ScrollOverflowChevron
                        visible={childFilterOverflow.showRightIndicator}
                        side="right"
                    />
                    </View>
                ) : null}

                {/* UX-022: empty-state banner above the grid when the visible
                    range has zero events. UX-024 fix: hoisted out of the
                    non-month branch of the viewMode ternary below so the
                    "Nothing scheduled this month" copy actually renders in
                    Month view (it was previously dead code).
                    Banner copy adapts per view so "Nothing scheduled this week"
                    reads better than a bare "Nothing scheduled". Drag-to-
                    create / press-and-hold-to-create still work on the grid
                    below; the banner just acknowledges emptiness and surfaces
                    the create affordance for users who don't notice the FAB. */}
                {visibleEvents.length === 0 ? (
                    <View
                        style={[
                            styles.dayEmptyBanner,
                            { borderBottomColor: colors.backgroundSelected },
                        ]}>
                        <ThemedText themeColor="textSecondary" type="small">
                            {viewMode === 'day'
                                ? 'Nothing scheduled.'
                                : viewMode === 'week'
                                  ? 'Nothing scheduled this week.'
                                  : 'Nothing scheduled this month.'}
                            {/* Caregivers get an honest empty state — no
                                create CTAs, since they can't create events.
                                Parents see the platform-specific drag /
                                press-and-hold copy + "+ new event" link. */}
                            {isCaregiver ? null : (
                                <>
                                    {' '}
                                    {Platform.OS === 'web'
                                        ? 'Drag on the grid to add an event, or tap'
                                        : 'Press and hold a time slot to add an event, or tap'}{' '}
                                    <ThemedText
                                        onPress={() => router.push('/event/new')}
                                        style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                        + new event
                                    </ThemedText>
                                    .
                                </>
                            )}
                        </ThemedText>
                    </View>
                ) : longPressHintVisible && Platform.OS !== 'web' && !isCaregiver ? (
                    // UX-029: native-only press-and-hold discoverability tip.
                    // Shows only when (a) we have events to render (otherwise
                    // the empty-state banner above already says it) and (b)
                    // the user is in their first N Calendar visits AND hasn't
                    // dismissed manually. Self-dismissing × on the right.
                    <View
                        style={[
                            styles.longPressHintBar,
                            { borderBottomColor: colors.backgroundSelected },
                        ]}>
                        <ThemedText
                            themeColor="textSecondary"
                            type="small"
                            style={{ flex: 1 }}>
                            Tip: press and hold any time slot to add an event there.
                        </ThemedText>
                        <Pressable
                            onPress={dismissLongPressHint}
                            accessibilityRole="button"
                            accessibilityLabel="Dismiss press-and-hold tip"
                            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                            <ThemedText
                                themeColor="textSecondary"
                                style={{ fontSize: 18, lineHeight: 20 }}>
                                ×
                            </ThemedText>
                        </Pressable>
                    </View>
                ) : null}

                {viewMode === 'month' ? (
                    // ─── Month grid ─────────────────────────────────────────────
                    // 7 columns (Sun–Sat) × 6 rows (always 42 cells, even for short
                    // months — keeps row height steady when stepping forward/back).
                    // Each cell shows the day number + up to 3 dots colored by the
                    // resolved-responsible parent of that day's events + a "+N" if
                    // there are more. Out-of-month cells are dimmed but still
                    // clickable so a misclick can still navigate.
                    <ScrollView
                        style={styles.monthScroll}
                        // flexGrow:1 on the content container lets the inner grid claim
                        // the full vertical space the ScrollView is given. Without it,
                        // the rows hug their minHeight and leave acres of empty space
                        // on tall desktop windows. The ScrollView still kicks in if the
                        // grid's minHeight total exceeds a short viewport.
                        contentContainerStyle={styles.monthScrollContent}
                        showsVerticalScrollIndicator={false}>
                        <View style={styles.monthGrid}>
                            <View
                                style={[
                                    styles.monthDowRow,
                                    { borderBottomColor: colors.backgroundSelected },
                                ]}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                                    (d) => (
                                        <View key={d} style={styles.monthDowCell}>
                                            <ThemedText
                                                type="small"
                                                themeColor="textSecondary">
                                                {d}
                                            </ThemedText>
                                        </View>
                                    ),
                                )}
                            </View>
                            {[0, 1, 2, 3, 4, 5].map((rowIdx) => (
                                <View
                                    key={rowIdx}
                                    style={[
                                        styles.monthRow,
                                        { borderBottomColor: colors.backgroundSelected },
                                    ]}>
                                    {days
                                        .slice(rowIdx * 7, rowIdx * 7 + 7)
                                        .map((day) => {
                                            const dayKey = format(day, 'yyyy-MM-dd');
                                            const dayEvents =
                                                eventsByDay.get(dayKey) ?? [];
                                            const inMonth = isSameMonth(day, anchor);
                                            const dayIsToday = isToday(day);
                                            // UX-025: only dim past days when the
                                            // visible month actually contains today
                                            // or future. If user has navigated
                                            // entirely to a past month, leave the
                                            // grid at full contrast.
                                            const isPast =
                                                rangeAnchorsPresentOrFuture &&
                                                isBefore(
                                                    day,
                                                    startOfDay(new Date()),
                                                );
                                            const visible = dayEvents.slice(0, 3);
                                            const overflow = Math.max(
                                                0,
                                                dayEvents.length - 3,
                                            );
                                            // Custody Ribbon — Month variant.
                                            // A 3px colored stripe at the top
                                            // of each cell, tinted to the day's
                                            // custodian. Same data source as
                                            // the Day/Week ribbon, miniaturized
                                            // so 42 cells can carry the signal
                                            // without dominating the grid. Only
                                            // rendered when a custody schedule
                                            // exists (non-separated households
                                            // hide it entirely).
                                            const monthCustodian = custodySchedule
                                                ? resolveCustodianOnDate(
                                                      custodySchedule,
                                                      overrideMap,
                                                      day,
                                                  )
                                                : null;
                                            const monthCustodyColor = monthCustodian
                                                ? colorForResponsible(
                                                      monthCustodian.profileId,
                                                      colorMap,
                                                  )
                                                : null;
                                            return (
                                                <Pressable
                                                    key={dayKey}
                                                    onPress={() => {
                                                        // Drill into Day view for the
                                                        // clicked cell. Both updates
                                                        // are batched so the days
                                                        // memo re-derives once.
                                                        setAnchor(day);
                                                        setViewMode('day');
                                                    }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`${format(day, 'EEEE, MMMM d')}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                                                    style={({ pressed }) => [
                                                        styles.monthCell,
                                                        {
                                                            borderRightColor:
                                                                colors.backgroundSelected,
                                                        },
                                                        dayIsToday && {
                                                            backgroundColor:
                                                                colors.backgroundElement,
                                                        },
                                                        isPast &&
                                                            !dayIsToday && {
                                                                opacity: 0.55,
                                                            },
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    {monthCustodyColor ? (
                                                        <View
                                                            style={[
                                                                styles.monthCellCustodyStripe,
                                                                {
                                                                    backgroundColor:
                                                                        monthCustodyColor,
                                                                },
                                                            ]}
                                                            pointerEvents="none"
                                                        />
                                                    ) : null}
                                                    <ThemedText
                                                        type="small"
                                                        style={[
                                                            styles.monthCellDayNum,
                                                            {
                                                                color: dayIsToday
                                                                    ? '#6F7FA5'
                                                                    : inMonth
                                                                      ? colors.text
                                                                      : colors.textSecondary,
                                                                fontWeight: dayIsToday
                                                                    ? '700'
                                                                    : '500',
                                                                opacity: inMonth
                                                                    ? 1
                                                                    : 0.5,
                                                            },
                                                        ]}>
                                                        {format(day, 'd')}
                                                    </ThemedText>
                                                    <View
                                                        style={styles.monthCellEvents}>
                                                        {visible.map((e) => {
                                                            // QA-022: resolve responsible
                                                            // per cell-day for multi-day
                                                            // all-day events. For timed
                                                            // events this is the same
                                                            // calendar date as the start
                                                            // (they only appear on their
                                                            // start day in month view), so
                                                            // the swap is a no-op there;
                                                            // for an all-day Mon→Wed series
                                                            // it now shows each cell's
                                                            // actual responsible parent.
                                                            const responsible =
                                                                resolveResponsibleProfileId(
                                                                    {
                                                                        event: e,
                                                                        occurrenceDate:
                                                                            e.all_day
                                                                                ? day
                                                                                : new Date(
                                                                                      e.starts_at,
                                                                                  ),
                                                                        custodySchedule,
                                                                        custodyOverrides:
                                                                            overrideMap,
                                                                        occurrenceOverrides:
                                                                            occurrenceOverrideMap,
                                                                    },
                                                                );
                                                            const c = colorForResponsible(
                                                                responsible,
                                                                colorMap,
                                                            );
                                                            // Time prefix for timed events
                                                            // helps the user disambiguate
                                                            // two events on the same day.
                                                            // All-day events skip the
                                                            // prefix.
                                                            const startTime = e.all_day
                                                                ? null
                                                                : format(
                                                                      new Date(e.starts_at),
                                                                      'h:mma',
                                                                  )
                                                                      .toLowerCase()
                                                                      .replace(':00', '');
                                                            return (
                                                                <View
                                                                    key={`${e.id}-${e.starts_at}`}
                                                                    style={[
                                                                        styles.monthEventPill,
                                                                        {
                                                                            backgroundColor:
                                                                                c,
                                                                            opacity:
                                                                                inMonth
                                                                                    ? 1
                                                                                    : 0.45,
                                                                        },
                                                                    ]}>
                                                                    {/* UX-030: dropped the event-type icon in Month
                                                                        view. On narrow phones (375pt → ~45pt usable
                                                                        per cell) the icon stole 1-2 chars and pushed
                                                                        the title past truncation immediately. Title
                                                                        is the content that disambiguates events;
                                                                        icon is decorative. Time prefix stays —
                                                                        it's the next most-informative bit when
                                                                        two events share a busy day. */}
                                                                    <ThemedText
                                                                        style={
                                                                            styles.monthEventPillText
                                                                        }
                                                                        numberOfLines={1}>
                                                                        {startTime
                                                                            ? `${startTime} `
                                                                            : ''}
                                                                        {e.title}
                                                                    </ThemedText>
                                                                </View>
                                                            );
                                                        })}
                                                        {overflow > 0 ? (
                                                            <ThemedText
                                                                style={[
                                                                    styles.monthOverflow,
                                                                    {
                                                                        color: colors.textSecondary,
                                                                        opacity: inMonth
                                                                            ? 1
                                                                            : 0.5,
                                                                    },
                                                                ]}>
                                                                +{overflow} more
                                                            </ThemedText>
                                                        ) : null}
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                ) : (
                    <>
                <View
                    style={[
                        styles.dayHeaderRow,
                        { borderBottomColor: colors.backgroundSelected },
                    ]}>
                    <View style={{ width: TIME_COLUMN_WIDTH }} />
                    {days.map((day) => {
                        const dayIsToday = isToday(day);
                        // UX-025: only dim past day headers when today/future
                        // is also in the visible range. Past day headers contain
                        // only text, so opacity is fine here (no event blocks
                        // to cascade into).
                        const isPast =
                            rangeAnchorsPresentOrFuture &&
                            isBefore(day, startOfDay(new Date()));
                        return (
                            <View
                                key={day.toISOString()}
                                style={[
                                    styles.dayLabel,
                                    dayIsToday && { backgroundColor: colors.backgroundElement },
                                    isPast && !dayIsToday && { opacity: 0.55 },
                                ]}>
                                <ThemedText
                                    type="small"
                                    themeColor={dayIsToday ? 'text' : 'textSecondary'}>
                                    {format(day, 'EEE')}
                                </ThemedText>
                                <ThemedText
                                    type="smallBold"
                                    style={dayIsToday ? { color: '#6F7FA5' } : undefined}>
                                    {format(day, 'd')}
                                </ThemedText>
                            </View>
                        );
                    })}
                </View>

                {custodySchedule ? (
                    // ─── Custody Ribbon ──────────────────────────────────────
                    // Continuous segmented band across the top of the time grid,
                    // colored per-day by the custodian. This is the calendar's
                    // identity feature — every competitor has a calendar; only
                    // OneNest has the ribbon. Previously a series of margin'd
                    // pills that read as "decorations on a calendar"; now a
                    // continuous identity element.
                    //
                    // Segments butt against each other (no cell margin/radius),
                    // names in 11px caps centered, override days get a ↻ glyph
                    // and a 2px white inner border so they pop. Day view gets
                    // a single full-width segment with a larger name. The TIME
                    // column on the left stays a spacer for grid alignment
                    // but is no longer labeled "custody" — the colors and the
                    // names make that self-evident.
                    <View
                        style={[
                            styles.custodyRibbon,
                            { borderBottomColor: colors.backgroundSelected },
                        ]}>
                        <View style={{ width: TIME_COLUMN_WIDTH }} />
                        {days.map((day) => {
                            const resolved = resolveCustodianOnDate(custodySchedule, overrideMap, day);
                            const member = members?.find((m) => m.profile_id === resolved.profileId);
                            const c = colorForResponsible(resolved.profileId, colorMap);
                            const firstName = member?.display_name?.split(' ')[0] ?? '—';
                            const dateParam = format(day, 'yyyy-MM-dd');
                            const isDayView = days.length === 1;
                            return (
                                <Pressable
                                    key={`custody-${day.toISOString()}`}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/custody/[date]',
                                            params: { date: dateParam },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`${firstName}${resolved.isOverride ? ' (custody override)' : ''} on ${format(day, 'EEEE, MMMM d')}. Tap to edit.`}
                                    style={({ pressed }) => [
                                        styles.custodySegment,
                                        { backgroundColor: c },
                                        // Override segments get a 2px white inner
                                        // border that visually "lifts" them out
                                        // of the surrounding flat color. Pairs
                                        // with the ↻ glyph below.
                                        resolved.isOverride && styles.custodySegmentOverride,
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.custodySegmentText,
                                            isDayView && styles.custodySegmentTextDay,
                                        ]}
                                        numberOfLines={1}>
                                        {resolved.isOverride ? '↻ ' : ''}
                                        {firstName}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}

                {hasAllDay ? (
                    <View
                        style={[
                            styles.allDayRow,
                            { borderBottomColor: colors.backgroundSelected },
                        ]}>
                        <View style={[styles.allDayLabelCell, { width: TIME_COLUMN_WIDTH }]}>
                            <ThemedText type="small" themeColor="textSecondary">
                                all day
                            </ThemedText>
                        </View>
                        {days.map((day) => (
                            <View key={day.toISOString()} style={styles.allDayCell}>
                                {allDayEventsForDay(allDayEvents, day).map((event) => {
                                    // QA-022: for multi-day all-day events the
                                    // responsible parent should be resolved
                                    // PER-CELL DAY, not for the whole event.
                                    // A Mon→Wed vacation with custody alternation
                                    // should show Mon's parent in the Mon cell,
                                    // Tue's parent in the Tue cell, etc. Using
                                    // event.starts_at here showed Mon's color
                                    // in every cell. The cell's own `day` is
                                    // the correct lookup date — the alternation
                                    // resolver consumes a Date, not a key.
                                    const occurrenceDate = day;
                                    const resolvedResponsible = resolveResponsibleProfileId({
                                        event,
                                        occurrenceDate,
                                        custodySchedule,
                                        custodyOverrides: overrideMap,
                                        occurrenceOverrides: occurrenceOverrideMap,
                                    });
                                    return (
                                    <Pressable
                                        key={`${event.id}-${event.starts_at}`}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/event/[id]',
                                                params: {
                                                    id: event.id,
                                                    // Pass the occurrence's date so the edit
                                                    // screen knows which instance was clicked.
                                                    // For one-off events this is identical to
                                                    // the event's start date and is harmless.
                                                    date: format(occurrenceDate, 'yyyy-MM-dd'),
                                                },
                                            })
                                        }
                                        style={({ pressed }) => [
                                            styles.allDayChip,
                                            {
                                                backgroundColor: colorForResponsible(
                                                    resolvedResponsible,
                                                    colorMap,
                                                ),
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <View style={styles.allDayChipRow}>
                                            <ThemedText
                                                type="small"
                                                style={[styles.allDayChipText, { flex: 1 }]}
                                                numberOfLines={1}>
                                                {iconForType(event.event_type)}
                                                {iconForType(event.event_type) ? ' ' : ''}
                                                {event.title}
                                                {event.description ? ' 📝' : ''}
                                            </ThemedText>
                                            <EventChildBadges
                                                allChildren={children ?? []}
                                                childIds={event.child_ids}
                                                size="sm"
                                                maxVisible={2}
                                            />
                                        </View>
                                    </Pressable>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                ) : null}

                {isLoading && !events ? (
                    <LoadingScreen />
                ) : (
                    <ScrollView
                        ref={gridScrollRef}
                        style={styles.gridScroll}
                        showsVerticalScrollIndicator={false}>
                        <View style={[styles.gridRow, { height: 24 * HOUR_HEIGHT }]}>
                            <View
                                style={[
                                    styles.timeColumn,
                                    {
                                        width: TIME_COLUMN_WIDTH,
                                        borderRightColor: colors.backgroundSelected,
                                    },
                                ]}>
                                {HOURS.map((h) => (
                                    <View
                                        key={h}
                                        style={{
                                            height: HOUR_HEIGHT,
                                            paddingHorizontal: Spacing.one,
                                            paddingTop: 2,
                                        }}>
                                        <ThemedText themeColor="textSecondary" type="small">
                                            {formatHourLabel(h)}
                                        </ThemedText>
                                    </View>
                                ))}
                            </View>

                            {days.map((day, dayIdx) => {
                                const dayIsToday = isToday(day);
                                // UX-025: only dim past day columns when today/future
                                // is in the visible range. If the user has navigated
                                // entirely into the past, leave everything at full
                                // opacity — there's nothing to orient against.
                                const isPast =
                                    rangeAnchorsPresentOrFuture &&
                                    isBefore(day, startOfDay(new Date()));
                                const dayTimed = eventsForDay(timedEvents, day);
                                const draggingThisDay =
                                    dragState && dragState.dayIndex === dayIdx;
                                // UX-005: on native we render the column as a Pressable so
                                // empty-area taps route to /event/new with a snapped time.
                                // On web it stays a View — the drag-to-create effect attaches
                                // pointerdown directly to the DOM ref, and we don't want a
                                // Pressable's synthetic click double-firing after a drag.
                                const Wrapper: typeof View | typeof Pressable =
                                    Platform.OS === 'web' ? View : Pressable;
                                const wrapperProps =
                                    Platform.OS === 'web'
                                        ? {
                                              ref: (el: unknown) => {
                                                  dayColRefs.current[dayIdx] =
                                                      (el as HTMLDivElement | null) ?? null;
                                              },
                                          }
                                        : {
                                              // UX-017: press-and-hold instead of plain
                                              // tap — see handleDayColumnTapNative comment.
                                              onLongPress: (e: {
                                                  nativeEvent: { locationY: number };
                                              }) =>
                                                  handleDayColumnTapNative(
                                                      day,
                                                      e.nativeEvent.locationY,
                                                  ),
                                              // ~500ms felt right in informal mobile usage:
                                              // long enough to disqualify accidental brushes,
                                              // short enough to feel intentional.
                                              delayLongPress: 500,
                                              accessibilityRole: 'button' as const,
                                              accessibilityLabel: `Press and hold to add an event on ${format(day, 'EEEE, MMMM d')}`,
                                          };
                                return (
                                    <Wrapper
                                        key={day.toISOString()}
                                        {...(wrapperProps as object)}
                                        style={[
                                            styles.dayColumn,
                                            { borderRightColor: colors.backgroundSelected },
                                            dayIsToday && {
                                                backgroundColor: colors.backgroundElement,
                                            },
                                            // UX-025: do NOT apply `opacity` here — RN
                                            // cascades opacity into children, which
                                            // washed out the colored event blocks below.
                                            // We render a translucent overlay layer
                                            // instead (see end of this column's children).
                                            // Crosshair cursor on web hints "drag here". On
                                            // native this style is ignored.
                                            Platform.OS === 'web'
                                                ? ({ cursor: 'crosshair' } as object)
                                                : null,
                                        ]}>
                                        {HOURS.map((h) => (
                                            <View
                                                key={h}
                                                style={[
                                                    styles.hourLine,
                                                    {
                                                        height: HOUR_HEIGHT,
                                                        borderTopColor: colors.backgroundSelected,
                                                    },
                                                ]}
                                            />
                                        ))}

                                        {/* External busy blocks — own paired-calendar events.
                                            Layered behind regular events via zIndex. */}
                                        {externalEventsForDay(day).map((ext) => {
                                            const start = new Date(ext.starts_at);
                                            const end = new Date(ext.ends_at);
                                            const startMins =
                                                start.getHours() * 60 + start.getMinutes();
                                            const durationMs = end.getTime() - start.getTime();
                                            const top = (startMins / 60) * HOUR_HEIGHT;
                                            const height = Math.max(
                                                (durationMs / 3600000) * HOUR_HEIGHT,
                                                14,
                                            );
                                            return (
                                                <View
                                                    key={`busy-${ext.id}`}
                                                    // Marked so the drag-to-create handler
                                                    // bails when the user clicks on a busy
                                                    // block instead of empty space.
                                                    {...CAL_BLOCK_DATASET}
                                                    style={[styles.busyBlock, { top, height }]}>
                                                    <ThemedText
                                                        style={styles.busyBlockText}
                                                        numberOfLines={1}>
                                                        {ext.title ?? 'Busy'}
                                                    </ThemedText>
                                                </View>
                                            );
                                        })}

                                        {/* Other members' opaque busy windows — no titles,
                                            tinted in that member's color, with their first
                                            initial. Sourced from household_busy_blocks() RPC. */}
                                        {otherMembersBusyForDay(day).map((b) => {
                                            const start = new Date(b.starts_at);
                                            const end = new Date(b.ends_at);
                                            const startMins =
                                                start.getHours() * 60 + start.getMinutes();
                                            const durationMs = end.getTime() - start.getTime();
                                            const top = (startMins / 60) * HOUR_HEIGHT;
                                            const height = Math.max(
                                                (durationMs / 3600000) * HOUR_HEIGHT,
                                                14,
                                            );
                                            const memberColor = colorForResponsible(
                                                b.profile_id,
                                                colorMap,
                                            );
                                            const member = members?.find(
                                                (m) => m.profile_id === b.profile_id,
                                            );
                                            const initial =
                                                member?.display_name?.charAt(0).toUpperCase() ?? '·';
                                            return (
                                                <View
                                                    key={`other-busy-${b.profile_id}-${b.starts_at}`}
                                                    // Marked so drag-to-create skips when
                                                    // the user clicks on a member's busy
                                                    // window instead of empty space.
                                                    {...CAL_BLOCK_DATASET}
                                                    style={[
                                                        styles.otherBusyBlock,
                                                        {
                                                            top,
                                                            height,
                                                            // QA-023: safe alpha. Was
                                                            // `${memberColor}26` / `${memberColor}99`,
                                                            // brittle to any palette
                                                            // entry that isn't `#RRGGBB`.
                                                            backgroundColor: withAlpha(
                                                                memberColor,
                                                                0.15,
                                                            ),
                                                            borderLeftColor: withAlpha(
                                                                memberColor,
                                                                0.6,
                                                            ),
                                                        },
                                                    ]}>
                                                    <ThemedText
                                                        style={[
                                                            styles.otherBusyInitial,
                                                            { color: memberColor },
                                                        ]}>
                                                        {initial}
                                                    </ThemedText>
                                                </View>
                                            );
                                        })}

                                        {dayTimed.map((event) => {
                                            const start = new Date(event.starts_at);
                                            const end = new Date(event.ends_at);
                                            const startMins =
                                                start.getHours() * 60 + start.getMinutes();
                                            const durationMs = end.getTime() - start.getTime();
                                            const durationMins = durationMs / 60000;
                                            const top = (startMins / 60) * HOUR_HEIGHT;
                                            const height = Math.max(
                                                (durationMins / 60) * HOUR_HEIGHT,
                                                22,
                                            );
                                            // Resolve the effective responsible parent for
                                            // THIS occurrence — accounts for alternation
                                            // (looking up the custody schedule) and any
                                            // per-occurrence override row.
                                            const resolvedResponsible = resolveResponsibleProfileId({
                                                event,
                                                occurrenceDate: start,
                                                custodySchedule,
                                                custodyOverrides: overrideMap,
                                                occurrenceOverrides: occurrenceOverrideMap,
                                            });
                                            const bg = colorForResponsible(
                                                resolvedResponsible,
                                                colorMap,
                                            );
                                            const hasNote = !!event.description;
                                            // Recurring + end-date check — show "ends MMM d"
                                            // on the block so the user can see series
                                            // boundaries at a glance. parseRecurrence is
                                            // pure (parses the rrule string), no fetches.
                                            const parsedRec = event.recurrence_rule
                                                ? parseRecurrence(event.recurrence_rule)
                                                : null;
                                            const untilLabel =
                                                parsedRec?.until
                                                    ? `ends ${format(parseISO(parsedRec.until), 'MMM d')}`
                                                    : null;
                                            return (
                                                <Pressable
                                                    key={`${event.id}-${event.starts_at}`}
                                                    // data-cal-block tells the drag-to-create
                                                    // handler to bail when the user clicks on
                                                    // this event rather than empty space.
                                                    {...CAL_BLOCK_DATASET}
                                                    onPress={() =>
                                                        router.push({
                                                            pathname: '/event/[id]',
                                                            params: {
                                                                id: event.id,
                                                                date: format(start, 'yyyy-MM-dd'),
                                                            },
                                                        })
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.eventBlock,
                                                        { top, height, backgroundColor: bg },
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <View style={styles.eventTitleRow}>
                                                        <ThemedText
                                                            type="small"
                                                            style={[
                                                                styles.eventTitle,
                                                                { flex: 1 },
                                                            ]}
                                                            numberOfLines={1}>
                                                            {iconForType(event.event_type)}
                                                            {iconForType(event.event_type) ? ' ' : ''}
                                                            {event.title}
                                                        </ThemedText>
                                                        <EventChildBadges
                                                            allChildren={children ?? []}
                                                            childIds={event.child_ids}
                                                            size="sm"
                                                            maxVisible={2}
                                                        />
                                                    </View>
                                                    {height >= 36 ? (
                                                        <ThemedText
                                                            type="small"
                                                            style={styles.eventTime}
                                                            numberOfLines={1}>
                                                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                                                        </ThemedText>
                                                    ) : null}
                                                    {/* "↻ ends MMM d" on recurring events
                                                        that have an end date. Lives below
                                                        the time row when the block is tall
                                                        enough (≥ 1 hour); on short blocks
                                                        we skip it to avoid crowding. */}
                                                    {untilLabel && height >= 56 ? (
                                                        <ThemedText
                                                            type="small"
                                                            style={styles.eventUntil}
                                                            numberOfLines={1}>
                                                            ↻ {untilLabel}
                                                        </ThemedText>
                                                    ) : null}
                                                    {hasNote ? (
                                                        <ThemedText style={styles.noteIcon}>📝</ThemedText>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        })}

                                        {/* Drag-to-create ghost preview. Rendered on top
                                            of empty space (zIndex 3) so the user sees
                                            exactly the range that will get pre-filled in
                                            the event form when they release. */}
                                        {draggingThisDay ? (
                                            <View
                                                style={[
                                                    styles.ghostBlock,
                                                    // pointerEvents on style (was a prop) so taps fall through
                                                    { pointerEvents: 'none' },
                                                    {
                                                        top:
                                                            (dragState!.startMins / 60) *
                                                            HOUR_HEIGHT,
                                                        height:
                                                            ((dragState!.endMins -
                                                                dragState!.startMins) /
                                                                60) *
                                                            HOUR_HEIGHT,
                                                    },
                                                ]}>
                                                <ThemedText
                                                    style={styles.ghostText}
                                                    numberOfLines={1}>
                                                    {minutesToHHmm(dragState!.startMins)} –{' '}
                                                    {minutesToHHmm(dragState!.endMins)}
                                                </ThemedText>
                                            </View>
                                        ) : null}
                                        {/* UX-025: non-cascading past-day dim.
                                            An absolutely-positioned tinted overlay
                                            sits on top of the column at low alpha.
                                            Because the overlay is a sibling (not
                                            an ancestor) of the event blocks, the
                                            event colors render at full saturation
                                            but read through a slight wash that
                                            says "this day already happened."
                                            pointerEvents:none lets the tap /
                                            long-press still reach the column. */}
                                        {isPast && !dayIsToday ? (
                                            <View
                                                style={[
                                                    styles.pastDayOverlay,
                                                    { backgroundColor: colors.background },
                                                    { pointerEvents: 'none' },
                                                ]}
                                            />
                                        ) : null}
                                    </Wrapper>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
                    </>
                )}
            </SafeAreaView>

            {showCreateAffordances ? (
                <Pressable
                    onPress={() => router.push('/event/new')}
                    accessibilityRole="button"
                    accessibilityLabel="New event"
                    style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
                    <ThemedText style={styles.fabText}>+</ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.two,
        gap: Spacing.two,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    headerTitle: { flex: 1, alignItems: 'center' },
    navBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
    todayBtn: { alignSelf: 'center' },
    // View toggle row sits above the nav row. flex-row + center alignment keeps the
    // three chips visually grouped as a single segmented control.
    viewToggleRow: {
        flexDirection: 'row',
        gap: Spacing.two,
        alignSelf: 'center',
    },
    viewToggleChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: 4,
    },
    // Day-view empty banner: a single padded line between the all-day row and the
    // time grid. Border-bottom keeps the visual hierarchy consistent with the other
    // header rows above the grid.
    dayEmptyBanner: {
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.two,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    // UX-029: press-and-hold discoverability bar. Same vertical rhythm as the
    // empty banner above, but adds a flex row so a dismiss × can sit on the
    // right edge.
    longPressHintBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.two,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    // ─── Month view ────────────────────────────────────────────────────────────
    // Vertical scroll wraps the grid so phone heights with tall headers still see
    // the full 6 rows. On wider screens the contentContainerStyle below lets the
    // grid claim the full available height and the rows flex evenly.
    monthScroll: { flex: 1 },
    monthScrollContent: { flexGrow: 1 },
    monthGrid: { flex: 1 },
    monthDowRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    monthDowCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.two,
    },
    monthRow: {
        flex: 1,
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        // Floor for cramped viewports — if the 6 rows together exceed the viewport
        // (very short window or many other UI chrome), the ScrollView lets the user
        // scroll instead of squishing rows into illegibility.
        minHeight: 60,
    },
    // Each day cell. Right border draws the column dividers; the bottom border
    // comes from monthRow above. The cell takes the row's full height via flex.
    monthCell: {
        flex: 1,
        borderRightWidth: StyleSheet.hairlineWidth,
        padding: 4,
        gap: 2,
        // overflow:hidden so the custody stripe (absolutely positioned to
        // the cell's top edge) doesn't bleed past the cell border on the
        // right side — without this it would visually merge with the next
        // day's stripe across the column border.
        overflow: 'hidden',
    },
    // 3px colored bar at the top of each month cell, tinted to the day's
    // custodian. Miniaturized version of the Day/Week ribbon — same data
    // source, same vocabulary, fits inside a 42-cell grid without dominating
    // it. Absolutely positioned so it doesn't push the day-num text down.
    monthCellCustodyStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    monthCellDayNum: { fontSize: 13 },
    // Vertical stack of event title pills + overflow count. Switched from
    // colored dots to thin colored title pills so users can see what's on each
    // day at a glance — dots-only required tapping into Day view to identify
    // anything. Caps at 3 visible pills + "+N more" so a busy day doesn't
    // explode the row height.
    monthCellEvents: {
        flexDirection: 'column',
        gap: 2,
        flexShrink: 1,
    },
    monthEventPill: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    monthEventPillText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    monthOverflow: { fontSize: 10, fontWeight: '600' },
    dayHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dayLabel: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.two,
        gap: 2,
    },
    // ─── Custody Ribbon styles ──────────────────────────────────────────────
    // 28px tall continuous band. Segments are flat (no margin, no border-
    // radius) so neighboring custodian colors butt against each other and
    // read as one ribbon rather than a row of pills. The hairline border on
    // the bottom separates it from the all-day row below; the top border
    // edge is owned by the day-header row above.
    custodyRibbon: {
        flexDirection: 'row',
        height: 28,
        borderBottomWidth: StyleSheet.hairlineWidth,
        // overflow:hidden so the override segment's inner border doesn't
        // clip outside the ribbon when it sits at the edge.
        overflow: 'hidden',
    },
    custodySegment: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    // Override visual: a 2px white inner border that "lifts" the segment
    // out of the flat ribbon. Pairs with the ↻ glyph in the text. Together
    // they give a strong "this day is an exception" signal without
    // introducing a hash-pattern overlay (which would need expo-linear-
    // gradient or a textured image asset, neither worth the cost).
    custodySegmentOverride: {
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.85)',
    },
    custodySegmentText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    // Day view: single segment spans the full width, so the name has room
    // to breathe — bump font size + drop the cramped letterSpacing.
    custodySegmentTextDay: {
        fontSize: 13,
        letterSpacing: 0.8,
    },
    allDayRow: {
        flexDirection: 'row',
        minHeight: ALL_DAY_ROW_HEIGHT,
        paddingVertical: 2,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    allDayLabelCell: {
        justifyContent: 'center',
        paddingLeft: Spacing.one,
    },
    allDayCell: {
        flex: 1,
        paddingHorizontal: 2,
        gap: 2,
    },
    allDayChip: {
        paddingHorizontal: Spacing.one,
        paddingVertical: 2,
        borderRadius: 4,
    },
    allDayChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    gridScroll: { flex: 1 },
    gridRow: { flexDirection: 'row' },
    timeColumn: { borderRightWidth: StyleSheet.hairlineWidth },
    dayColumn: {
        flex: 1,
        position: 'relative',
        borderRightWidth: StyleSheet.hairlineWidth,
    },
    // UX-025: past-day overlay. Translucent layer that sits ABOVE the column
    // children (so it doesn't cascade opacity into them) and dims the visual
    // by ~45%. Z-order: above event blocks but below the drag-ghost (which is
    // a transient interaction layer). Color comes from theme at render time.
    pastDayOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.45,
    },
    hourLine: { borderTopWidth: StyleSheet.hairlineWidth },
    eventBlock: {
        position: 'absolute',
        left: 2,
        right: 2,
        borderRadius: 4,
        padding: 4,
        overflow: 'hidden',
        zIndex: 2,
    },
    busyBlock: {
        position: 'absolute',
        left: 1,
        right: 1,
        backgroundColor: 'rgba(110, 127, 165, 0.18)',
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(110, 127, 165, 0.55)',
        borderRadius: 2,
        paddingHorizontal: 3,
        paddingTop: 1,
        overflow: 'hidden',
        zIndex: 1,
    },
    busyBlockText: { color: 'rgba(42, 46, 58, 0.7)', fontSize: 10, fontStyle: 'italic' },
    otherBusyBlock: {
        position: 'absolute',
        left: 1,
        right: 1,
        borderLeftWidth: 2,
        borderRadius: 2,
        paddingLeft: 3,
        paddingTop: 1,
        overflow: 'hidden',
        zIndex: 1,
    },
    otherBusyInitial: { fontSize: 10, fontWeight: '700' },
    eventTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
    // Inline row that places ChildBadges before the event title in time-grid blocks.
    // Mirror's allDayChipRow but defined here so the time-grid layout can adjust gap
    // independently if we ever need to.
    eventTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    allDayChipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    // Filter pill row above the day-header row. Horizontal scroll so households with many
    // kids don't get clipped; the View is kept tight vertically to avoid stealing too much
    // screen height from the grid.
    // The ScrollView wrapper around filterRow needs an explicit non-growing style on
    // react-native-web. Without it, the horizontal ScrollView greedily fills its parent
    // column's flex space and pushes the calendar grid halfway down the screen.
    filterScroll: { flexGrow: 0, flexShrink: 0 },
    // UX-010: relative-positioned wrapper so the overflow chevron pins to the
    // filter strip's visible right edge.
    filterScrollWrapper: { position: 'relative' },
    filterRow: {
        flexDirection: 'row',
        gap: Spacing.two,
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.two,
        alignItems: 'center',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    eventTime: { color: '#fff', fontSize: 11, opacity: 0.9 },
    // "ends MMM d" line on recurring events with an UNTIL clause. Slightly dimmer
    // than the time row so the eye still anchors on the time first.
    eventUntil: { color: '#fff', fontSize: 10, opacity: 0.7, fontStyle: 'italic' },
    // Drag-to-create ghost: dashed slate-blue outline, semi-translucent fill, no shadow.
    // zIndex 3 places it above the event blocks (z=2) so the user sees it while dragging
    // over existing events, and above busy blocks (z=1). pointerEvents="none" is set on
    // the rendered View so the window-level pointermove keeps reaching this column.
    ghostBlock: {
        position: 'absolute',
        left: 2,
        right: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#6F7FA5',
        backgroundColor: 'rgba(111, 127, 165, 0.22)',
        paddingHorizontal: 4,
        paddingTop: 2,
        zIndex: 3,
    },
    ghostText: { color: '#2A2E3A', fontSize: 11, fontWeight: '600' },
    // Anchored to the bottom-right of the event block so it doesn't crowd the child-badge
    // row at the top-right. Small fontSize keeps it from overlapping the time label.
    noteIcon: { position: 'absolute', bottom: 2, right: 4, fontSize: 10 },
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
    pressed: { opacity: 0.7 },
});
