import { Feather } from '@expo/vector-icons';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// EventChildBadges was previously rendered on Day-view event blocks; the
// v3 spec drops child-avatar ornaments from the time grid (identity reads
// from the leading rail color + title only). Detail-screen badges still
// use the component; only this surface no longer imports it.
// import { EventChildBadges } from '@/components/event-child-badges';
import { LoadingScreen } from '@/components/loading-screen';
import {
    ScrollOverflowChevron,
    useHorizontalOverflow,
} from '@/components/scroll-overflow-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { FAB_SHADOW, withAlpha } from '@/lib/platform-styles';
import { DaySummaryPill } from '@/components/calendar/day-summary-pill';
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
import { useUpcomingTasks } from '@/hooks/use-upcoming-tasks';
import { memberColorMap, colorForResponsible } from '@/lib/colors';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import type { Event, ExternalEvent, HouseholdBusyBlock } from '@/lib/db';
import { parseRecurrence } from '@/lib/recurrence';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
// computeWeekSummary works on any event range, not just a week —
// `useWeekSummary` is one specific 7-day caller. Calendar reuses the
// pure compute function with its own already-loaded events / busy
// blocks so the conflict signal stays consistent with the Home summary
// without an extra fetch.
import { computeWeekSummary } from '@/lib/summary';
import {
    shouldHideEventAsPrivate,
    PRIVATE_EVENT_BUSY_LABEL,
} from '@/lib/event-visibility';
// iconForType previously prefixed event titles with the event-type emoji
// (🩺 doctor, ⚽ activity, etc). The v3 Day-view spec
// (screens-extra-5.jsx::DayBlock) renders title-only and reserves the
// title row for handoff/conflict glyphs — no event-type prefix. Other
// surfaces that still need the icon import directly from lib/event-types.
// import { iconForType } from '@/lib/event-types';
import { useAppColorScheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';

const HOUR_HEIGHT = 56;
// Visible hour range (Calendar week + day grids). Per the v3 spec
// (onenest-spec-v3/design_handoff_calendar_conflicts §Calendar week
// grid extends to the tab bar) the grid renders 6am-10pm — a realistic
// family day from school drop-off through bedtime. Hours outside this
// range are intentionally OFF the time grid (an event starting at 3am
// or ending at 11:30pm doesn't render here); all-day events still ride
// the strip above the grid. A future Settings → Appearance toggle
// could make these configurable for households with early-risers or
// late-night activities (out of scope for this pass).
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => START_HOUR + i,
);
const GRID_ROWS = HOURS.length; // 17 — used for grid-height math.
const GRID_HEIGHT = GRID_ROWS * HOUR_HEIGHT;
// Clamps an event block's `top` / `height` so events that start before
// START_HOUR or end after END_HOUR render only their visible portion.
// Returns `null` when the event is entirely outside the visible range
// (the renderer should skip it).
function clampEventToVisibleRange(
    rawTop: number,
    rawHeight: number,
): { top: number; height: number } | null {
    let top = rawTop;
    let height = rawHeight;
    if (top + height <= 0) return null; // ends before 6am
    if (top >= GRID_HEIGHT) return null; // starts after 10pm
    if (top < 0) {
        height = height + top; // shrink by the cut-off portion
        top = 0;
    }
    if (top + height > GRID_HEIGHT) {
        height = GRID_HEIGHT - top;
    }
    if (height <= 0) return null;
    return { top, height };
}
// 36 — matches the design source exactly (width: 36 on both the day-header
// spacer and the per-hour-row time label column). Mono 9.5px "08:00" labels
// fit in ~30px; the remaining 6px is left padding inside the cell.
const TIME_COLUMN_WIDTH = 36;
// Default landing scroll offset when the calendar mounts. Pre-7.2 this was
// a fixed 7AM (early-morning anchor). The user-facing expectation is "open
// it and see now" so we now compute current local hour and bias it up by
// ~2h so the current-time line sits about a third of the way down the
// visible grid (matches iOS Calendar's "centered on now" landing).
function currentScrollHour(): number {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    // Translate "now" into grid-relative hours (where 0 = START_HOUR /
    // 6am). Pushing the now-line ~2h down from the top of the visible
    // window centers it in the upper third — past context above, the
    // next few hours below. Clamp so we never scroll past the bottom
    // of the GRID_ROWS-tall content.
    const relative = h - START_HOUR;
    return Math.max(0, Math.min(GRID_ROWS - 4, relative - 2));
}

// Deep-link scroll target: turn an "HH:MM" string (24h) into a
// grid-relative scroll-Y offset. Center the requested time roughly
// one-third down the visible window so the user sees context before AND
// after the event — same framing as currentScrollHour's "now" bias.
// Out-of-range times (before 6am / after the visible window's tail)
// clamp to the top / bottom of the grid. Returns null if the input
// can't be parsed so callers can fall back to currentScrollHour().
function scrollHourFromTime(hhmm: string | null | undefined): number | null {
    if (!hhmm) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    const decimalHour = h + min / 60;
    const relative = decimalHour - START_HOUR;
    return Math.max(0, Math.min(GRID_ROWS - 4, relative - 2));
}
const ALL_DAY_ROW_HEIGHT = 28;

// Hard-clip single-line text with NO "..." indicator. Used inside cramped
// event blocks / all-day chips where every pixel of label width matters.
//
// Native:  numberOfLines={1} + ellipsizeMode="clip" — RN respects "clip"
//          and renders no ellipsis. Straightforward.
// Web:     react-native-web maps numberOfLines={1} to CSS
//          `-webkit-line-clamp: 1`, and the browser ALWAYS appends "…"
//          when -webkit-line-clamp truncates — `text-overflow: clip`
//          (i.e. ellipsizeMode="clip") is silently ignored. The only way
//          to opt out is to skip numberOfLines and rely on
//          `whiteSpace: nowrap` + the parent's `overflow: hidden` to
//          single-line-clip the text at the container edge.
//
// `whiteSpace` isn't in RN's TextStyle type (it's a web-only CSS property),
// so we cast through `any`. We also set `overflow: hidden` here so the Text
// itself clips even if a flex parent stretches it past its container —
// belt-and-suspenders against day-view's flex:1 title cell.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HARD_CLIP_STYLE: any =
    Platform.OS === 'web' ? { whiteSpace: 'nowrap', overflow: 'hidden' } : null;
const HARD_CLIP_NUMBER_OF_LINES = Platform.OS === 'web' ? undefined : 1;

// Calendar view toggle. Day and Week share the same time-grid renderer with a different
// number of columns; Month gets its own compact grid renderer with dot indicators.
type ViewMode = 'day' | 'week' | 'month';
const VIEW_MODE_STORAGE_KEY = 'onenest:calendar-view-mode';
const VIEW_MODES: ViewMode[] = ['day', 'week', 'month'];
function isViewMode(v: unknown): v is ViewMode {
    return v === 'day' || v === 'week' || v === 'month';
}

function formatHourLabel(h: number): string {
    // Mist Forest spec: zero-padded 24h with explicit ":00" minutes ("08:00",
    // "09:00", "13:00"). Mono-rendered so every label is the same pixel
    // width — the time column reads as a vertical ruler instead of a column
    // of jaggedly-aligned AM/PM labels.
    if (h === 0) return '';
    return `${String(h).padStart(2, '0')}:00`;
}

function eventsForDay(events: Event[], day: Date): Event[] {
    return events.filter((e) => isSameDay(new Date(e.starts_at), day));
}

/**
 * Lane-assignment for overlapping events in a day column. Returns a Map
 * from event id → `{ lane, lanes }`, where `lane` is the column index
 * (0-based, left to right) and `lanes` is how many columns the event
 * needs to share its space with at the widest point of its overlap.
 *
 * Algorithm:
 *  1. Sort events by start (earlier first); ties broken by longer-first
 *     so a long-running event grabs lane 0 before a short one that
 *     coincides with its start.
 *  2. Walk in order; place each event in the lowest-index lane whose
 *     last-placed event has already ended. Push a new lane if none qualifies.
 *  3. Second pass: each event's `lanes` count = max(lane) + 1 across
 *     all events that directly overlap it. Per-event (not per-cluster)
 *     so events that don't overlap a busy cluster aren't visually
 *     shrunk for nothing. Matches Google Calendar / iCal behaviour.
 *
 * Without this, two events at the same time render on top of each
 * other (only `left: 2, right: 2` set) — the second one hides the
 * first entirely.
 */
function computeEventLanes(
    events: Event[],
): Map<string, { lane: number; lanes: number }> {
    const ranges = events.map((e) => ({
        id: e.id + '|' + e.starts_at, // recurring instances share id; disambiguate by start
        startMs: new Date(e.starts_at).getTime(),
        endMs: new Date(e.ends_at).getTime(),
    }));
    // Stable sort by start asc, then duration desc.
    ranges.sort((a, b) => {
        if (a.startMs !== b.startMs) return a.startMs - b.startMs;
        return b.endMs - b.startMs - (a.endMs - a.startMs);
    });
    const laneLastEndMs: number[] = [];
    const laneByKey = new Map<string, number>();
    for (const r of ranges) {
        let placed = -1;
        for (let i = 0; i < laneLastEndMs.length; i++) {
            if (laneLastEndMs[i] <= r.startMs) {
                placed = i;
                break;
            }
        }
        if (placed === -1) {
            placed = laneLastEndMs.length;
            laneLastEndMs.push(r.endMs);
        } else {
            laneLastEndMs[placed] = r.endMs;
        }
        laneByKey.set(r.id, placed);
    }
    // Second pass: per-event width = max lane index of any overlapping
    // event + 1. O(n²) but n is at most a few dozen per day in practice.
    const result = new Map<string, { lane: number; lanes: number }>();
    for (const r of ranges) {
        let maxLane = laneByKey.get(r.id) ?? 0;
        for (const other of ranges) {
            if (other.id === r.id) continue;
            const overlaps = other.startMs < r.endMs && r.startMs < other.endMs;
            if (overlaps) {
                maxLane = Math.max(maxLane, laneByKey.get(other.id) ?? 0);
            }
        }
        result.set(r.id, { lane: laneByKey.get(r.id) ?? 0, lanes: maxLane + 1 });
    }
    return result;
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

    // Deep-link params. Other surfaces (notably the EventDetail conflict
    // ribbon's "Open in calendar" button) can push to /calendar with
    // ?view=day&date=YYYY-MM-DD&time=HH:MM to land the user on a
    // specific occurrence. The screen consumes the params once on mount
    // and applies them to viewMode + anchor; a one-time pendingScrollHour
    // overrides the focus effect's default "scroll to now" so the day
    // grid centers on the event time instead of the current clock.
    const deepLinkParams = useLocalSearchParams<{
        view?: string | string[];
        date?: string | string[];
        time?: string | string[];
    }>();
    const dlView = Array.isArray(deepLinkParams.view)
        ? deepLinkParams.view[0]
        : deepLinkParams.view;
    const dlDate = Array.isArray(deepLinkParams.date)
        ? deepLinkParams.date[0]
        : deepLinkParams.date;
    const dlTime = Array.isArray(deepLinkParams.time)
        ? deepLinkParams.time[0]
        : deepLinkParams.time;

    // View toggle. Default to Week until the persisted value hydrates. We accept the small
    // first-paint flash because the alternative (suspending render) makes the screen feel
    // janky on cold start.
    const [viewMode, setViewModeState] = useState<ViewMode>('week');
    // Deep-link consumption marker. Set true *synchronously* during the
    // first render that has a usable `view` param so the AsyncStorage
    // hydrate below doesn't clobber the deep link with the user's last
    // stored preference (the hydrate fires async, so without this guard
    // we'd flicker into the right view and then back to 'week' / 'month').
    const deepLinkConsumedRef = useRef(false);
    useEffect(() => {
        // Skip the persisted hydrate when a deep link is active — the
        // deep link below wins, and we don't want the storage read to
        // race-overwrite it. The deep link doesn't write to storage
        // either, so re-opening the tab normally still respects the
        // user's last manual setting.
        if (deepLinkConsumedRef.current) return;
        AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
            .then((v) => {
                if (deepLinkConsumedRef.current) return;
                if (isViewMode(v)) setViewModeState(v);
            })
            .catch(() => undefined);
    }, []);
    const setViewMode = useCallback((next: ViewMode) => {
        setViewModeState(next);
        AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, next).catch(() => undefined);
    }, []);

    // `anchor` is the "current position" date the user is looking at. Its meaning depends
    // on the active view:
    //   - day:   the single day shown
    //   - week:  any date inside the displayed week (we derive the Sunday on the fly)
    //   - month: any date inside the displayed month (we derive the first-day on the fly)
    // Keeping anchor view-agnostic means switching views preserves "where" you were
    // looking instead of resetting to today.
    const [anchor, setAnchor] = useState<Date>(() => new Date());

    // One-shot scroll-hour override for the day/week grid. When a deep
    // link arrives (e.g. "Open in calendar" from a conflict ribbon),
    // setting this to a grid-relative hour makes the focus effect AND
    // the onContentSizeChange handler scroll there *instead of* the
    // default `currentScrollHour()`. Cleared on first consumption so
    // subsequent re-focuses go back to the "scroll to now" default —
    // the deep link is a one-time landing instruction, not a persistent
    // preference. Stored in a ref (not state) because changing it
    // shouldn't re-render; the next scroll attempt reads the current
    // value at call time.
    const pendingScrollHourRef = useRef<number | null>(null);

    // Consume deep-link params (view / date / time) once per unique
    // signature. We track the consumed signature so the effect doesn't
    // re-fire on every render — pressing back from a child screen
    // would otherwise replay the snap-to-day each time.
    const consumedDeepLinkSigRef = useRef<string | null>(null);
    useEffect(() => {
        if (!dlView && !dlDate && !dlTime) return;
        const sig = `${dlView ?? ''}|${dlDate ?? ''}|${dlTime ?? ''}`;
        if (consumedDeepLinkSigRef.current === sig) return;
        consumedDeepLinkSigRef.current = sig;
        deepLinkConsumedRef.current = true;
        if (dlView && isViewMode(dlView)) {
            // Use setViewModeState directly — we don't want a deep-link
            // landing to write the user's view choice to storage.
            setViewModeState(dlView);
        }
        if (dlDate && /^\d{4}-\d{2}-\d{2}$/.test(dlDate)) {
            const parsed = parseISO(dlDate);
            if (!Number.isNaN(parsed.getTime())) setAnchor(parsed);
        }
        const target = scrollHourFromTime(dlTime);
        if (target !== null) {
            pendingScrollHourRef.current = target;
            // Force a re-scroll-to-target. Reset user-scrolled so the
            // focus effect's setTimeout + onContentSizeChange passes pick
            // up our target. The focus effect honors
            // pendingScrollHourRef when present.
            hasUserScrolledRef.current = false;
            // Direct scroll attempts to cover the cases where the focus
            // effect has already run by the time this effect fires (e.g.
            // returning to /calendar with the screen already mounted).
            const t1 = setTimeout(() => {
                if (
                    gridScrollRef.current &&
                    pendingScrollHourRef.current !== null &&
                    !hasUserScrolledRef.current
                ) {
                    gridScrollRef.current.scrollTo({
                        y: pendingScrollHourRef.current * HOUR_HEIGHT,
                        animated: false,
                    });
                }
            }, 0);
            const t2 = setTimeout(() => {
                if (
                    gridScrollRef.current &&
                    pendingScrollHourRef.current !== null &&
                    !hasUserScrolledRef.current
                ) {
                    gridScrollRef.current.scrollTo({
                        y: pendingScrollHourRef.current * HOUR_HEIGHT,
                        animated: false,
                    });
                }
            }, 80);
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [dlView, dlDate, dlTime]);

    // Month view's selected day for the bottom preview card. Tapping a
    // cell selects that day (and updates the card) — drilling into Day
    // view is its own explicit affordance via the card's "Open day view"
    // button. Null = "no manual selection yet"; the derived value falls
    // back to today (if visible in the current month) or the first of
    // the month being browsed. Per the v3 spec
    // (onenest-spec-v3/design_handoff_calendar_conflicts §Calendar month).
    const [monthSelectedDay, setMonthSelectedDay] = useState<Date | null>(null);

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
            const start = startOfWeek(anchor, { weekStartsOn: 1 });
            const out: Date[] = [];
            for (let i = 0; i < 7; i++) out.push(addDays(start, i));
            return { rangeStart: start, numDays: 7, days: out };
        }
        // month: fetch a 6-row × 7-col grid starting from the Sunday on/before the 1st.
        const first = startOfMonth(anchor);
        const start = startOfWeek(first, { weekStartsOn: 1 });
        const out: Date[] = [];
        for (let i = 0; i < 42; i++) out.push(addDays(start, i));
        return { rangeStart: start, numDays: 42, days: out };
    }, [viewMode, anchor]);
    const rangeEndInclusive = useMemo(
        () => addDays(rangeStart, numDays - 1),
        [rangeStart, numDays],
    );

    // Effective selected day for Month view's preview card. Falls back
    // to today (if it's in the visible month) or the 1st of the month
    // being browsed. Recomputes when the user navigates months —
    // re-anchoring resets the implicit selection.
    const monthEffectiveSelectedDay = useMemo<Date>(() => {
        if (monthSelectedDay && isSameMonth(monthSelectedDay, anchor)) {
            return monthSelectedDay;
        }
        const today = new Date();
        return isSameMonth(today, anchor) ? today : startOfMonth(anchor);
    }, [monthSelectedDay, anchor]);

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
    // Day-view summary pills (Phase 8a, v3 spec screens-extra-5.jsx:287-292)
    // need a per-day task count. `useUpcomingTasks` fetches incomplete tasks
    // for today + the next 7 days, which is enough for the common case:
    // Day-view usage skews to today / tomorrow. Days >7 out won't show a
    // task count — acceptable trade-off vs. adding a per-day fetch hook.
    // The hook is harmless on Week / Month (we only read its output when
    // viewMode === 'day'), and it's already used by Home so the cache is
    // typically warm.
    const { tasks: upcomingTasks, refetch: refetchUpcomingTasks } = useUpcomingTasks(
        household?.id,
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
            refetchUpcomingTasks();
        }, [
            refetchEvents,
            refetchMembers,
            refetchChildren,
            refetchCustody,
            refetchOverrides,
            refetchOccurrenceOverrides,
            refetchExternalEvents,
            refetchBusyBlocks,
            refetchUpcomingTasks,
        ]),
    );

    const overrideMap = useMemo(
        () => buildOverrideMap(custodyOverrides),
        [custodyOverrides],
    );

    // Conflict keys for the visible range — set of `id|starts_at` strings
    // identifying each conflicting event instance. Reused by event-block
    // renders (week + day) for the warn-tinted bug badge, and by the
    // month grid (one or more conflicts on a day → warn dot in the cell
    // corner). Per the v3 spec § The conflict-resolver access rule.
    //
    // Compute is pure + cheap; we just hand the same inputs the Home
    // summary card uses to `computeWeekSummary` so the two surfaces
    // never drift. Empty inputs → empty set; the early-return guards
    // against a few extra Map allocations during the initial hydration.
    const conflictKeys = useMemo<Set<string>>(() => {
        const keys = new Set<string>();
        if (!events || events.length === 0) return keys;
        const summary = computeWeekSummary(
            events,
            householdBusyBlocks ?? [],
            custodySchedule,
            overrideMap,
            occurrenceOverrideMap,
        );
        for (const c of summary.conflicts) {
            keys.add(`${c.event.id}|${c.event.starts_at}`);
        }
        return keys;
    }, [
        events,
        householdBusyBlocks,
        custodySchedule,
        overrideMap,
        occurrenceOverrideMap,
    ]);

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

    // Day-view summary counts (Phase 8a, spec screens-extra-5.jsx:287-292).
    // Computed for `days[0]` since Day view is single-day. Each count is
    // an integer; the pill row hides pills whose count is 0 (the design
    // shows non-zero pills only — "0 conflicts" reads as visual clutter).
    //
    // Hand-off detection: 1 when today's resolved custodian differs from
    // tomorrow's (i.e. the kids change hands at end-of-day). We don't
    // double-count yesterday → today since the user already saw that
    // pill the day before, and the pill is informational, not a counter.
    //
    // Tasks: we count tasks with `due_at` falling within the visible
    // day. `useUpcomingTasks` covers today through day +6, so days
    // outside that window will read 0 (acceptable — Day view skews to
    // near-term). We don't filter by assignee here because the pill is
    // a household-level summary, mirroring the Home summary's framing.
    const daySummaryCounts = useMemo(() => {
        if (viewMode !== 'day') {
            // Cheap guard so Week/Month renders don't pay for this work.
            return { events: 0, conflicts: 0, handoffs: 0, tasks: 0 };
        }
        const day = days[0];
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay.get(dayKey) ?? [];
        const events = dayEvents.length;
        const conflicts = dayEvents.filter((e) =>
            conflictKeys.has(`${e.id}|${e.starts_at}`),
        ).length;
        // Hand-off = today's resolved state differs from tomorrow's. We
        // compare on the full `(profileId, bothPresent)` tuple so 'AB'
        // transitions count too (A→AB and AB→A both shift the household's
        // daily reality). Same `sameState` shape used by
        // useCurrentWeekCustody so the two surfaces agree.
        //
        // PREVIOUS BUG (#1 of custody-audit CRITICAL batch): this
        // compared the resolver's RETURN OBJECTS by reference
        // (`today !== tomorrow`). Two fresh function calls always return
        // distinct objects, so the inequality was always true whenever
        // both sides were non-null — handoffs read `1` every single day
        // for any household with an active schedule. We now also
        // skip the count when the schedule is soft-stopped (#376), since
        // a disabled pattern has no real hand-offs even though the row
        // is still present.
        let handoffs = 0;
        if (custodySchedule && !custodySchedule.disabled_at) {
            const today = resolveCustodianOnDate(
                custodySchedule,
                overrideMap,
                day,
            );
            const tomorrow = resolveCustodianOnDate(
                custodySchedule,
                overrideMap,
                addDays(day, 1),
            );
            const sameState =
                today.profileId === tomorrow.profileId &&
                today.bothPresent === tomorrow.bothPresent;
            if (!sameState) handoffs = 1;
        }
        let tasks = 0;
        for (const t of upcomingTasks ?? []) {
            if (!t.due_at) continue;
            if (isSameDay(new Date(t.due_at), day)) tasks += 1;
        }
        return { events, conflicts, handoffs, tasks };
    }, [
        viewMode,
        days,
        eventsByDay,
        conflictKeys,
        custodySchedule,
        overrideMap,
        upcomingTasks,
    ]);

    const gridScrollRef = useRef<ScrollView | null>(null);
    // Flips true the moment the user manually drags the grid. Once true,
    // the auto-scroll-to-now logic stops fighting their scroll position.
    // Reset on every focus so "tap Calendar tab again" still re-centers
    // on now, which is the user's mental model.
    //
    // Why we need this: the cold-mount sequence on /calendar fires
    // multiple layout passes —
    //   1. ScrollView mounts, content measured at 24*HOUR_HEIGHT, we
    //      scroll-to-now successfully.
    //   2. Events finish loading; the parent (re-)renders with the
    //      all-day strip + event blocks. Even though the gridRow's
    //      explicit height doesn't change, RN-Web's underlying
    //      scrollable div can reset scrollTop=0 when the ScrollView's
    //      OWN height shrinks (the all-day strip takes vertical space
    //      from the grid frame above the scroller).
    //   3. Without this ref + the onContentSizeChange handler below,
    //      that second pass leaves the user staring at midnight.
    //
    // Solution: scroll on EVERY content-size change until the user has
    // manually dragged. onScrollBeginDrag (RN-native) and onTouchStart /
    // mouse-wheel on web both flip the ref; programmatic scrolls don't
    // fire onScrollBeginDrag, so our own scrollTo() calls don't lock us
    // out.
    const hasUserScrolledRef = useRef(false);

    // Scroll to the current hour every time the Calendar tab comes into
    // focus, not just on first mount.
    //
    // Why useFocusEffect (not useEffect): Expo Router's bottom-tab nav
    // preserves screen state across tab switches — tapping Calendar from
    // another tab DOESN'T unmount the screen, so a plain useEffect keyed
    // on `viewMode` only fires once at first mount. Users tap Calendar
    // again expecting "show me now," but the scroll position would be
    // wherever they left it. useFocusEffect fires on every focus
    // transition (initial mount + every re-focus), which is the user's
    // mental model.
    //
    // Two timers: 0ms for the first paint, and 50ms as a safety net in
    // case the ScrollView ref isn't attached yet on initial mount (the
    // 0ms timer fires before refs settle in some RN-Web layout passes).
    useFocusEffect(
        useCallback(() => {
            if (viewMode === 'month') return;
            // Reset on every focus so re-entering the tab re-centers on
            // "now" (matches user mental model). The setTimeouts handle
            // the re-focus case where the ScrollView is already mounted
            // and measured; the onContentSizeChange handler below handles
            // the cold-mount case where the ScrollView is still settling.
            hasUserScrolledRef.current = false;
            const scroll = () => {
                if (hasUserScrolledRef.current) return;
                // Honor a one-shot deep-link scroll target if present
                // (e.g. "Open in calendar" from a conflict ribbon
                // landing on the event's time). Otherwise scroll to
                // "now" — the default user-expected landing.
                const target =
                    pendingScrollHourRef.current ?? currentScrollHour();
                gridScrollRef.current?.scrollTo({
                    y: target * HOUR_HEIGHT,
                    animated: false,
                });
            };
            const t1 = setTimeout(scroll, 0);
            const t2 = setTimeout(scroll, 50);
            // After the focus-effect settle window, drop the deep-link
            // override so subsequent re-focuses (returning to the tab,
            // toggling view) snap to "now" instead of replaying the
            // deep-link landing.
            const t3 = setTimeout(() => {
                pendingScrollHourRef.current = null;
            }, 120);
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        }, [viewMode]),
    );

    // ─── Calendar grid is view-only ────────────────────────────────────────────
    // The grid does NOT support tap- or drag-to-create. Two reasons it was
    // ripped out:
    //   1. Web drag-to-create created a ghost event on every mousedown, which
    //      meant scrolling the calendar with a click-and-drag also dropped a
    //      stray draft event each time — terrible scroll experience.
    //   2. The native press-and-hold equivalent had the same problem class
    //      (accidental fire from scroll-adjacent gestures) and forced us to
    //      ship a persistent discoverability tip nobody asked for.
    // The FAB is the sole create affordance now. Cleaner code, fewer footguns,
    // matches the redesign which doesn't show a tap-on-grid interaction either.
    // Tapping an EXISTING event still opens its detail; that's a per-block
    // Pressable and is unaffected.

    // Header label is view-specific. Year omitted everywhere — the WEEK number /
    // month name super-label above the title carries that context (year is
    // implied by context, not screaming at the user from the title row).
    //   - day:   "Tuesday, May 22"
    //   - week:  "May 24 – 30" (same month) | "Apr 28 – May 4" (cross-month)
    //   - month: "May"
    const headerLabel = useMemo(() => {
        if (viewMode === 'day') {
            return format(days[0], 'EEEE, MMM d');
        }
        if (viewMode === 'week') {
            const first = days[0];
            const last = days[days.length - 1];
            const startMonth = format(first, 'MMM');
            const endMonth = format(last, 'MMM');
            const startDay = format(first, 'd');
            const endDay = format(last, 'd');
            // Same month: collapse to "May 24 – 30". Cross-month: keep both
            // months "Apr 28 – May 4". Drops the redundant month + the year.
            return startMonth === endMonth
                ? `${startMonth} ${startDay} – ${endDay}`
                : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
        }
        return format(anchor, 'MMMM');
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
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.header}>
                    {/* Header pulls from the redesign: mono week-number label
                        above a 22px SemiBold range title, with a compact D/W/M
                        segmented control on the right and back/forward step
                        controls integrated. Today affordance becomes a small
                        "Today" pill — clearer than the old "Jump to today"
                        bottom-line link. */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerLeft}>
                            <ThemedText
                                style={[
                                    styles.headerSuper,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                {viewMode === 'week'
                                    ? `WEEK ${format(days[0], 'w')}`
                                    : viewMode === 'month'
                                      ? format(anchor, 'yyyy').toUpperCase()
                                      : // Day view: `WEEK 22 · 2026` matches
                                        // the v3 spec (screens-extra-5.jsx:230).
                                        // The mini-date strip below carries
                                        // the day-of-week orientation, so
                                        // repeating "TUESDAY" here would be
                                        // redundant chrome.
                                        `WEEK ${format(days[0], 'w')} · ${format(days[0], 'yyyy')}`}
                            </ThemedText>
                            <ThemedText
                                style={[
                                    Typography.titleSecondary,
                                    { color: colors.text, marginTop: 1 },
                                ]}
                                numberOfLines={1}>
                                {headerLabel}
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.segControl,
                                { backgroundColor: colors.backgroundInset },
                            ]}>
                            {VIEW_MODES.map((mode) => {
                                const selected = viewMode === mode;
                                return (
                                    <Pressable
                                        key={mode}
                                        onPress={() => setViewMode(mode)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${mode} view`}
                                        accessibilityState={{ selected }}
                                        style={({ pressed }) => [
                                            styles.segChip,
                                            {
                                                backgroundColor: selected
                                                    ? colors.backgroundElement
                                                    : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.segChipText,
                                                {
                                                    color: selected
                                                        ? colors.text
                                                        : colors.textSecondary,
                                                    fontFamily: FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            {mode === 'day'
                                                ? 'D'
                                                : mode === 'week'
                                                  ? 'W'
                                                  : 'M'}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Per-child filter pill row. Hidden for households with no kids — there's
                    nothing to filter by. "All" stays selected by default. Household-wide
                    events (no child tags) stay visible no matter which kid is selected.
                    Also hidden on Day view (Phase 8a / v3 spec): the design replaces the
                    filter row with the DaySummaryPill row below ("4 events / 1 conflict /
                    1 hand-off / 2 tasks"), since on a single-day surface the filter is
                    less useful and the summary pills carry more day-shape signal. */}
                {viewMode !== 'day' && children && children.length > 0 ? (
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
                            accessibilityState={{ selected: childFilter === null }}
                            style={({ pressed }) => [
                                styles.filterChip,
                                {
                                    borderColor:
                                        childFilter === null
                                            ? colors.accent
                                            : colors.hair,
                                    backgroundColor:
                                        childFilter === null
                                            ? colors.accent
                                            : colors.backgroundElement,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.filterChipText,
                                    {
                                        color: childFilter === null
                                            ? colors.onAccent
                                            : colors.text,
                                    },
                                ]}>
                                All
                            </ThemedText>
                        </Pressable>
                        {children.map((c) => {
                            const selected = childFilter === c.id;
                            return (
                                <Pressable
                                    key={c.id}
                                    onPress={() => setChildFilter(c.id)}
                                    accessibilityState={{ selected }}
                                    style={({ pressed }) => [
                                        styles.filterChip,
                                        {
                                            borderColor: selected
                                                ? c.color
                                                : colors.hair,
                                            backgroundColor: selected
                                                ? withAlpha(c.color, scheme === 'dark' ? 0.22 : 0.13)
                                                : colors.backgroundElement,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View
                                        style={[
                                            styles.filterChipDot,
                                            { backgroundColor: c.color },
                                        ]}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.filterChipText,
                                            { color: colors.text },
                                        ]}>
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

                {/* Empty-state banner above the grid when the visible range
                    has zero events. Copy adapts per view so "Nothing scheduled
                    this week" reads better than a bare "Nothing scheduled".
                    Parents see a "+ new event" shortcut link to the create
                    route; caregivers see only the acknowledgement (they can't
                    create events). The discoverability hint for grid-tap-to-
                    create was removed alongside the drag/long-press features
                    themselves — the FAB is the sole create affordance. */}
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
                            {isCaregiver ? null : (
                                <>
                                    {' '}
                                    Tap{' '}
                                    <ThemedText
                                        type="small"
                                        onPress={() => router.push('/event/new')}
                                        style={{
                                            color: colors.accent,
                                            fontFamily: FontFamily.sansSemiBold,
                                            fontWeight: '600',
                                        }}>
                                        + new event
                                    </ThemedText>
                                    .
                                </>
                            )}
                        </ThemedText>
                    </View>
                ) : null}

                {viewMode === 'month' ? (
                    // ─── Month grid ─────────────────────────────────────────────
                    // v3 spec (onenest-spec-v3/design_handoff_calendar_conflicts
                    // screens-extra-5.jsx::CalendarMonth ~6-192). Each in-month
                    // day renders as its own card (radius 8, hair border, 4px
                    // grid gap). Out-of-month positions render as EMPTY spacers
                    // — no day number, no border — keeping the 7×6 footprint
                    // stable across short months. Today gets a 22×22 accent-
                    // filled day-number circle. Selected gets a 1.5px accent
                    // border + ~10% accent background. Events become 5×5 color
                    // dots (max 3 visible + "+N" mono overflow caption); the
                    // pre-v3 pill rendering with title + time is gone — at
                    // ~45pt usable cell width the pill was always truncating
                    // anyway, and the dot version reads cleaner at a glance.
                    // Custody stripe also dropped; the v3 spec doesn't carry
                    // it in the month grid (custody context lives on the
                    // selected-day preview card below).
                    <>
                    <ScrollView
                        style={styles.monthScroll}
                        contentContainerStyle={styles.monthScrollContent}
                        showsVerticalScrollIndicator={false}>
                        {/* Day-letter row — single-letter mono caps above the
                            grid. S M T W T F S; the two ambiguous letters
                            (T/T, S/S) read fine in context with the layout
                            order. */}
                        <View style={styles.monthDowRow}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <View
                                    key={`${d}-${i}`}
                                    style={styles.monthDowCell}>
                                    <ThemedText
                                        style={[
                                            styles.monthDowText,
                                            {
                                                color: colors.textSecondary,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {d}
                                    </ThemedText>
                                </View>
                            ))}
                        </View>
                        {/* Card grid — flex-row wrap with 4px gap. Each cell
                            is ~14.28% (1/7) of the row width with the gap
                            taken off via flexBasis math. */}
                        <View style={styles.monthGridCards}>
                            {days.map((day) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const dayEvents =
                                    eventsByDay.get(dayKey) ?? [];
                                const inMonth = isSameMonth(day, anchor);
                                // Out-of-month positions render as a sized
                                // spacer so the 7-column rhythm stays steady
                                // across short months. No tap, no number, no
                                // border — pure layout placeholder per spec.
                                if (!inMonth) {
                                    return (
                                        <View
                                            key={dayKey}
                                            style={styles.monthCellSpacer}
                                        />
                                    );
                                }
                                const dayIsToday = isToday(day);
                                const isPast =
                                    rangeAnchorsPresentOrFuture &&
                                    isBefore(day, startOfDay(new Date()));
                                const visibleDots = dayEvents.slice(0, 3);
                                const overflow = Math.max(
                                    0,
                                    dayEvents.length - 3,
                                );
                                const isSelected = isSameDay(
                                    day,
                                    monthEffectiveSelectedDay,
                                );
                                return (
                                    <Pressable
                                        key={dayKey}
                                        onPress={() =>
                                            setMonthSelectedDay(day)
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={`${format(day, 'EEEE, MMMM d')}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}, select for preview`}
                                        style={({ pressed }) => [
                                            styles.monthCellCard,
                                            {
                                                backgroundColor: isSelected
                                                    ? withAlpha(
                                                          colors.accent,
                                                          scheme === 'dark'
                                                              ? 0.13
                                                              : 0.09,
                                                      )
                                                    : colors.backgroundElement,
                                                borderColor: isSelected
                                                    ? colors.accent
                                                    : colors.hair,
                                                borderWidth: isSelected
                                                    ? 1.5
                                                    : StyleSheet.hairlineWidth,
                                            },
                                            isPast &&
                                                !dayIsToday &&
                                                !isSelected && {
                                                    opacity: 0.65,
                                                },
                                            pressed && styles.pressed,
                                        ]}>
                                        {/* Day-number "pill" — a 22×22 circle
                                            when today (accent-filled, white
                                            number), else flat mono text.
                                            Centered horizontally within the
                                            cell's column-axis. */}
                                        <View
                                            style={[
                                                styles.monthCellDayNumCircle,
                                                dayIsToday && {
                                                    backgroundColor:
                                                        colors.accent,
                                                },
                                            ]}>
                                            <ThemedText
                                                style={[
                                                    styles.monthCellDayNumText,
                                                    {
                                                        color: dayIsToday
                                                            ? colors.onAccent
                                                            : colors.text,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                        fontWeight: dayIsToday
                                                            ? '600'
                                                            : '500',
                                                    },
                                                ]}>
                                                {format(day, 'd')}
                                            </ThemedText>
                                        </View>
                                        {/* Event dots — 5×5 per event, max 3
                                            visible in a row that wraps to a
                                            second row at maxWidth=36. Color
                                            tracks each event's resolved
                                            responsible parent. */}
                                        <View style={styles.monthCellDots}>
                                            {visibleDots.map((e) => {
                                                const responsible =
                                                    resolveResponsibleProfileId({
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
                                                    });
                                                const c = colorForResponsible(
                                                    responsible,
                                                    colorMap,
                                                );
                                                return (
                                                    <View
                                                        key={`${e.id}-${e.starts_at}`}
                                                        style={[
                                                            styles.monthCellDot,
                                                            { backgroundColor: c },
                                                        ]}
                                                    />
                                                );
                                            })}
                                        </View>
                                        {/* "+N" mono overflow caption when
                                            the day has more events than the
                                            3-dot row can show. Sits below
                                            the dot row with tight margin. */}
                                        {overflow > 0 ? (
                                            <ThemedText
                                                style={[
                                                    styles.monthCellOverflow,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                +{overflow}
                                            </ThemedText>
                                        ) : null}
                                        {/* Conflict dot — small warn pip in
                                            the cell's bottom-right corner
                                            when at least one event on this
                                            day is in conflict. Per v3 spec
                                            § The conflict-resolver access
                                            rule (open product question #3,
                                            implemented per the README's
                                            recommendation). Whole-cell tap
                                            still selects the day; the dot
                                            is just an at-a-glance signal —
                                            users drill in via Open day
                                            view to find the offending
                                            block + its bug badge. */}
                                        {dayEvents.some((e) =>
                                            conflictKeys.has(
                                                e.id + '|' + e.starts_at,
                                            ),
                                        ) ? (
                                            <View
                                                style={[
                                                    styles.monthCellConflictDot,
                                                    {
                                                        backgroundColor:
                                                            colors.warn,
                                                        borderColor:
                                                            colors.backgroundElement,
                                                    },
                                                ]}
                                            />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </ScrollView>
                    {/* Selected-day preview card — pinned to the bottom of
                        the Month view. v3 spec replaces the Month FAB
                        with this card; "+ NEW EVENT" + "OPEN DAY VIEW →"
                        live in its footer scoped to the selected day. */}
                    {(() => {
                        const sel = monthEffectiveSelectedDay;
                        const selKey = format(sel, 'yyyy-MM-dd');
                        const selEvents = eventsByDay.get(selKey) ?? [];
                        const selIsToday = isToday(sel);
                        const visibleEvents = selEvents.slice(0, 4);
                        const moreCount = Math.max(
                            0,
                            selEvents.length - visibleEvents.length,
                        );
                        return (
                            <View
                                style={[
                                    styles.monthPreviewCard,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {/* Header — date + TODAY pill + event count */}
                                <View style={styles.monthPreviewHeader}>
                                    <View style={styles.monthPreviewHeaderLeft}>
                                        <ThemedText
                                            style={[
                                                styles.monthPreviewDate,
                                                { color: colors.text },
                                            ]}>
                                            {format(sel, 'EEE · MMM d')}
                                        </ThemedText>
                                        {selIsToday ? (
                                            <ThemedText
                                                style={[
                                                    styles.monthPreviewTodayPill,
                                                    {
                                                        color: colors.accent,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                TODAY
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                    <ThemedText
                                        style={[
                                            styles.monthPreviewCount,
                                            {
                                                color: colors.textSecondary,
                                                // Bumped to monoSemiBold to match
                                                // spec lines 138-140 (the count
                                                // sits next to the bold day title
                                                // and was reading light against
                                                // it at monoRegular).
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {selEvents.length}{' '}
                                        {selEvents.length === 1
                                            ? 'event'
                                            : 'events'}
                                    </ThemedText>
                                </View>

                                {/* Tiny event rows. Empty state on no events. */}
                                {selEvents.length === 0 ? (
                                    <ThemedText
                                        themeColor="textSecondary"
                                        style={styles.monthPreviewEmpty}>
                                        Nothing scheduled.
                                    </ThemedText>
                                ) : (
                                    <View style={styles.monthPreviewEvents}>
                                        {visibleEvents.map((e) => {
                                            const responsible =
                                                resolveResponsibleProfileId({
                                                    event: e,
                                                    occurrenceDate: e.all_day
                                                        ? sel
                                                        : new Date(
                                                              e.starts_at,
                                                          ),
                                                    custodySchedule,
                                                    custodyOverrides:
                                                        overrideMap,
                                                    occurrenceOverrides:
                                                        occurrenceOverrideMap,
                                                });
                                            const c = colorForResponsible(
                                                responsible,
                                                colorMap,
                                            );
                                            const timeLabel = e.all_day
                                                ? 'all-day'
                                                : format(
                                                      new Date(e.starts_at),
                                                      'HH:mm',
                                                  );
                                            return (
                                                <View
                                                    key={`${e.id}-${e.starts_at}`}
                                                    style={styles.monthPreviewEventRow}>
                                                    <ThemedText
                                                        style={[
                                                            styles.monthPreviewEventTime,
                                                            {
                                                                color: colors.textSecondary,
                                                                fontFamily:
                                                                    FontFamily.monoRegular,
                                                            },
                                                        ]}>
                                                        {timeLabel}
                                                    </ThemedText>
                                                    <View
                                                        style={[
                                                            styles.monthPreviewEventDot,
                                                            { backgroundColor: c },
                                                        ]}
                                                    />
                                                    <ThemedText
                                                        style={[
                                                            styles.monthPreviewEventTitle,
                                                            { color: colors.text },
                                                        ]}
                                                        numberOfLines={1}>
                                                        {/* Privacy gate (#469): private events
                                                            owned by someone else show as "Busy"
                                                            instead of leaking the title. The
                                                            responsibles list is consulted on
                                                            every render so a freshly-toggled
                                                            private flag takes effect without
                                                            a re-fetch. */}
                                                        {shouldHideEventAsPrivate(
                                                            e,
                                                            user?.id,
                                                        )
                                                            ? PRIVATE_EVENT_BUSY_LABEL
                                                            : e.title}
                                                    </ThemedText>
                                                    {/* Per-row conflict triangle (Phase 8b,
                                                        spec CMTinyEvent lines 205-210). When
                                                        this occurrence is in the household-wide
                                                        conflict set, show a small warn-tinted
                                                        triangle on the right edge of the row.
                                                        The cell-corner warn dot up in the
                                                        grid already signals the day as
                                                        problematic; this row-level glyph
                                                        identifies WHICH event in the preview
                                                        is the one in conflict, so the user can
                                                        tap straight to it. */}
                                                    {conflictKeys.has(
                                                        `${e.id}|${e.starts_at}`,
                                                    ) ? (
                                                        <Feather
                                                            name="alert-triangle"
                                                            size={11}
                                                            color={colors.warn}
                                                        />
                                                    ) : null}
                                                </View>
                                            );
                                        })}
                                        {moreCount > 0 ? (
                                            <ThemedText
                                                style={[
                                                    styles.monthPreviewMore,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily:
                                                            FontFamily.monoRegular,
                                                    },
                                                ]}>
                                                +{moreCount} more
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                )}

                                {/* Footer — 2-up split with hairline divider.
                                    Left: "+ NEW EVENT" (accent, primary).
                                    Right: "OPEN DAY VIEW →" (inkSec). */}
                                <View
                                    style={[
                                        styles.monthPreviewFooter,
                                        { borderTopColor: colors.hair },
                                    ]}>
                                    {showCreateAffordances ? (
                                        <Pressable
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/event/new',
                                                    params: {
                                                        date: format(
                                                            sel,
                                                            'yyyy-MM-dd',
                                                        ),
                                                    },
                                                })
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={`New event on ${format(sel, 'EEEE MMMM d')}`}
                                            style={({ pressed }) => [
                                                styles.monthPreviewAction,
                                                pressed && styles.pressed,
                                            ]}>
                                            <Feather
                                                name="plus"
                                                size={11}
                                                color={colors.accent}
                                            />
                                            <ThemedText
                                                style={[
                                                    styles.monthPreviewActionLabel,
                                                    {
                                                        color: colors.accent,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                NEW EVENT
                                            </ThemedText>
                                        </Pressable>
                                    ) : (
                                        // Caregivers see the read-only label
                                        // (no tap target) so the layout still
                                        // reads as a 2-up split.
                                        <View
                                            style={styles.monthPreviewAction}
                                        />
                                    )}
                                    <View
                                        style={[
                                            styles.monthPreviewActionDivider,
                                            { backgroundColor: colors.hair },
                                        ]}
                                    />
                                    <Pressable
                                        onPress={() => {
                                            setAnchor(sel);
                                            setViewMode('day');
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open day view for ${format(sel, 'EEEE MMMM d')}`}
                                        style={({ pressed }) => [
                                            styles.monthPreviewAction,
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.monthPreviewActionLabel,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            OPEN DAY VIEW
                                        </ThemedText>
                                        <Feather
                                            name="chevron-right"
                                            size={10}
                                            color={colors.textSecondary}
                                        />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })()}
                    </>
                ) : (
                    <>
                {/* DAY VIEW — 5-day mini-date strip per the v3 spec
                    (onenest-spec-v3/design_handoff_calendar_conflicts
                    screens-extra-5.jsx::CalendarDay ~240-283). Centered
                    on the anchor day with two days before and two after,
                    flanked by prev/next chevrons. Tap a non-anchor pill
                    to change the active date; tap today's pill (or any
                    anchor pill, since it's already selected) to open
                    /custody/[date] for that day's schedule. */}
                {viewMode === 'day' ? (
                    <View style={styles.miniDateStripRow}>
                        <Pressable
                            onPress={() => setAnchor((a) => addDays(a, -1))}
                            accessibilityRole="button"
                            accessibilityLabel="Previous day"
                            style={({ pressed }) => [
                                styles.miniDateChevBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather
                                name="chevron-left"
                                size={12}
                                color={colors.text}
                            />
                        </Pressable>
                        {[-2, -1, 0, 1, 2].map((offset) => {
                            const stripDay = addDays(days[0], offset);
                            const isAnchor = offset === 0;
                            const dayKey = format(stripDay, 'yyyy-MM-dd');
                            return (
                                <Pressable
                                    key={dayKey}
                                    onPress={() => {
                                        if (isAnchor) {
                                            // Tap the active pill → open
                                            // custody schedule for that day.
                                            // Matches week view's per-cell
                                            // custody-edit affordance.
                                            router.push({
                                                pathname: '/custody/[date]',
                                                params: { date: dayKey },
                                            });
                                        } else {
                                            // Tap a sibling pill →
                                            // re-anchor day view to it.
                                            setAnchor(stripDay);
                                        }
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        isAnchor
                                            ? `Open custody schedule for ${format(stripDay, 'EEEE MMMM d')}`
                                            : `Switch to ${format(stripDay, 'EEEE MMMM d')}`
                                    }
                                    style={({ pressed }) => [
                                        styles.miniDatePill,
                                        {
                                            backgroundColor: isAnchor
                                                ? colors.accent
                                                : colors.backgroundElement,
                                            borderColor: isAnchor
                                                ? colors.accent
                                                : colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.miniDatePillDow,
                                            {
                                                color: isAnchor
                                                    ? colors.onAccent
                                                    : colors.textSecondary,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'][
                                            stripDay.getDay()
                                        ]}
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.miniDatePillNum,
                                            {
                                                color: isAnchor
                                                    ? colors.onAccent
                                                    : colors.text,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {format(stripDay, 'd')}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                        <Pressable
                            onPress={() => setAnchor((a) => addDays(a, 1))}
                            accessibilityRole="button"
                            accessibilityLabel="Next day"
                            style={({ pressed }) => [
                                styles.miniDateChevBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather
                                name="chevron-right"
                                size={12}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>
                ) : null}

                {/* Day summary chips (Phase 8a, v3 spec screens-extra-5.jsx:
                    287-292). Sits between the mini-date strip and the grid
                    to give the user the day's shape at a glance — total
                    events, conflict count, hand-off badge, and task count.
                    Each pill renders only when its count > 0 (the spec
                    shows non-zero pills; empty ones add visual noise). The
                    row collapses to nothing on a quiet day, which is the
                    right empty state. */}
                {viewMode === 'day' &&
                (daySummaryCounts.events +
                    daySummaryCounts.conflicts +
                    daySummaryCounts.handoffs +
                    daySummaryCounts.tasks) >
                    0 ? (
                    <View style={styles.daySummaryRow}>
                        {daySummaryCounts.events > 0 ? (
                            <DaySummaryPill
                                icon="events"
                                label={`${daySummaryCounts.events} event${daySummaryCounts.events === 1 ? '' : 's'}`}
                                colors={colors}
                            />
                        ) : null}
                        {daySummaryCounts.conflicts > 0 ? (
                            <DaySummaryPill
                                icon="conflict"
                                label={`${daySummaryCounts.conflicts} conflict${daySummaryCounts.conflicts === 1 ? '' : 's'}`}
                                colors={colors}
                            />
                        ) : null}
                        {daySummaryCounts.handoffs > 0 ? (
                            <DaySummaryPill
                                icon="handoff"
                                label="1 hand-off"
                                colors={colors}
                            />
                        ) : null}
                        {daySummaryCounts.tasks > 0 ? (
                            <DaySummaryPill
                                icon="tasks"
                                label={`${daySummaryCounts.tasks} task${daySummaryCounts.tasks === 1 ? '' : 's'}`}
                                colors={colors}
                            />
                        ) : null}
                    </View>
                ) : null}

                {/* Day header row per the redesign. Each column stacks:
                      • mono day-of-week letter (M / T / W / …)
                      • mono day number — gets a 22×22 forest-accent circle
                        when it's today
                      • 24×3px custody color bar showing the day's custodian
                        (single solid segment today; the design allows for
                        split bars on hand-off days but our resolver returns
                        one custodian per day — future enhancement)
                    The whole column is tappable to edit custody on that day,
                    replacing the previous separate full-width custody ribbon
                    band below. Override days get a ↻ override dot pinned to
                    the day-number cell since the 3px bar is too small to
                    carry the override visual on its own.
                    DAY VIEW: this row is hidden — the mini-date strip
                    above (5 pills + prev/next) carries the date orientation
                    + per-day custody-tap affordance instead. */}
                {viewMode === 'week' ? (
                <View style={styles.dayHeaderRow}>
                    <View style={{ width: TIME_COLUMN_WIDTH }} />
                    {days.map((day) => {
                        const dayIsToday = isToday(day);
                        // Past-day dim removed at user request — the today
                        // accent circle is sufficient orientation signal,
                        // and the new design specifies no dimming for
                        // earlier-in-the-week days.
                        // Disabled schedules (#376 soft-stop) collapse the
                        // custody band entirely — match strip/hero/viewer.
                        const activeSchedule =
                            custodySchedule && !custodySchedule.disabled_at
                                ? custodySchedule
                                : null;
                        const resolved = activeSchedule
                            ? resolveCustodianOnDate(activeSchedule, overrideMap, day)
                            : null;
                        // 'AB' both-present days render `accentSoft` per the
                        // cross-surface vocabulary (#379) — matches editor
                        // preview / strip / hub bar treatment.
                        const custodyColor = resolved
                            ? resolved.bothPresent
                                ? colors.shared
                                : colorForResponsible(resolved.profileId, colorMap)
                            : null;
                        // UX audit 2.3: when today's resolved state differs
                        // from tomorrow's, render a 2-segment bar. Hand-off
                        // detection now compares the full `(profileId,
                        // bothPresent)` tuple so A→AB and AB→A transitions
                        // count too (previously the null profileId on AB
                        // days produced a split bar where it shouldn't
                        // have, and the audit's CRITICAL #2 also flagged
                        // the visual color drift).
                        const tomorrowResolved = activeSchedule
                            ? resolveCustodianOnDate(
                                  activeSchedule,
                                  overrideMap,
                                  addDays(day, 1),
                              )
                            : null;
                        const isHandoffDay =
                            !!resolved &&
                            !!tomorrowResolved &&
                            (resolved.profileId !== tomorrowResolved.profileId ||
                                resolved.bothPresent !==
                                    tomorrowResolved.bothPresent);
                        const tomorrowCustodyColor = tomorrowResolved
                            ? tomorrowResolved.bothPresent
                                ? colors.shared
                                : colorForResponsible(
                                      tomorrowResolved.profileId,
                                      colorMap,
                                  )
                            : null;
                        const member = resolved
                            ? members?.find((m) => m.profile_id === resolved.profileId)
                            : null;
                        const firstName = member?.display_name?.split(' ')[0] ?? '—';
                        const dateParam = format(day, 'yyyy-MM-dd');
                        const isDayView = days.length === 1;
                        const tappable = !!custodySchedule;
                        const Wrapper = tappable ? Pressable : View;
                        return (
                            <Wrapper
                                key={day.toISOString()}
                                {...(tappable
                                    ? {
                                          onPress: () =>
                                              router.push({
                                                  pathname: '/custody/[date]',
                                                  params: { date: dateParam },
                                              }),
                                          accessibilityRole: 'button' as const,
                                          accessibilityLabel: `${firstName}${resolved?.isOverride ? ' (custody override)' : ''} on ${format(day, 'EEEE, MMMM d')}. Tap to edit custody.`,
                                      }
                                    : {})}
                                style={({ pressed }: { pressed?: boolean } = {}) => [
                                    styles.dayLabel,
                                    pressed && tappable && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.dayLabelDow,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {/* Day-of-week label. Week view uses a fixed
                                        one-letter array — `format(day, 'EEEEE')`
                                        is locale-dependent (en-US: "M T W T F S
                                        S", but other locales return narrow Unicode
                                        codepoints that may not match the design's
                                        capital letters). The fixed array also
                                        guarantees the M T W T F S S ordering even
                                        if the runtime locale changes day-naming
                                        conventions. Day-view single-day keeps the
                                        date-fns 'EEE' three-letter label.
                                        date-fns getDay() returns 0=Sun...6=Sat;
                                        we index that-aligned array directly. */}
                                    {isDayView
                                        ? format(day, 'EEE').toUpperCase()
                                        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()]}
                                </ThemedText>
                                <View
                                    style={[
                                        styles.dayLabelNum,
                                        dayIsToday && {
                                            backgroundColor: colors.accent,
                                        },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.dayLabelNumText,
                                            {
                                                color: dayIsToday
                                                    ? colors.onAccent
                                                    : colors.text,
                                                fontFamily: FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {format(day, 'd')}
                                    </ThemedText>
                                </View>
                                {/* 24×3 custody bar. Solid single segment on
                                    "stayed with one parent" days. On hand-off
                                    days (today's custodian differs from
                                    tomorrow's) the bar splits 12|12 — today's
                                    color on the left, tomorrow's on the right
                                    — so the visual signals "kids switch at
                                    end of day" without needing a separate
                                    icon. Matches the design's split-bar
                                    treatment (direction-c-pro.jsx:755-759).
                                    When no schedule, falls back to transparent
                                    so the geometry stays consistent. */}
                                {isHandoffDay ? (
                                    <View
                                        style={[
                                            styles.dayLabelCustodyBar,
                                            styles.dayLabelCustodyBarSplit,
                                        ]}>
                                        <View
                                            style={[
                                                styles.dayLabelCustodySegment,
                                                {
                                                    backgroundColor:
                                                        custodyColor ?? 'transparent',
                                                },
                                            ]}
                                        />
                                        <View
                                            style={[
                                                styles.dayLabelCustodySegment,
                                                {
                                                    backgroundColor:
                                                        tomorrowCustodyColor ?? 'transparent',
                                                },
                                            ]}
                                        />
                                    </View>
                                ) : (
                                    <View
                                        style={[
                                            styles.dayLabelCustodyBar,
                                            {
                                                backgroundColor:
                                                    custodyColor ?? 'transparent',
                                            },
                                        ]}
                                    />
                                )}
                                {/* Override marker — small accent dot pinned
                                    to the top-right of the day cell. Hidden
                                    when no override; replaces the previous ↻
                                    glyph that lived inside the ribbon's name
                                    text. */}
                                {resolved?.isOverride ? (
                                    <View
                                        style={[
                                            styles.dayLabelOverrideDot,
                                            { backgroundColor: colors.warn },
                                        ]}
                                    />
                                ) : null}
                            </Wrapper>
                        );
                    })}
                </View>
                ) : null}

                {/* All-day strip lives INSIDE the framed grid below, as the
                    top row of the card. Removed the separate outside-frame
                    block + the "ALL DAY" label cell — multi-day chips now
                    sit directly above hour rows, integrated into the
                    calendar surface rather than floating as a labeled
                    header band. */}

                {isLoading && !events ? (
                    <LoadingScreen />
                ) : (
                    /* Framed grid per the redesign — the scrolling time grid
                       sits inside a 10px rounded card with a hairline border,
                       inset 12px from the page edges. The day-header row
                       above keeps matching horizontal padding so day columns
                       line up with the grid columns inside the frame. */
                    <View style={styles.gridFrameWrap}>
                    <View
                        style={[
                            styles.gridFrame,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                    {/* All-day strip — top row of the framed card. Renders
                        only when there are multi-day or all-day events in
                        the visible range. Restored "ALL DAY" mono label
                        cell at the leading edge (TIME_COLUMN_WIDTH) per
                        design source direction-c-pro.jsx:767 — the label
                        is the row's anchor and signals "this row is
                        different from the hour grid" without users having
                        to infer from chip placement. Hairline divider
                        below separates it from the hourly scroll area. */}
                    {hasAllDay ? (
                        <View
                            style={[
                                styles.allDayRowInFrame,
                                { borderBottomColor: colors.hair },
                            ]}>
                            <View
                                style={[
                                    styles.allDayLabelCell,
                                    { width: TIME_COLUMN_WIDTH },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.allDayLabel,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ALL DAY
                                </ThemedText>
                            </View>
                            {days.map((day) => (
                                <View key={day.toISOString()} style={styles.allDayCell}>
                                    {allDayEventsForDay(allDayEvents, day).map((event) => {
                                        // QA-022: resolve responsible parent PER-CELL DAY
                                        // for multi-day events so alternation lands per day.
                                        const occurrenceDate = day;
                                        const resolvedResponsible = resolveResponsibleProfileId({
                                            event,
                                            occurrenceDate,
                                            custodySchedule,
                                            custodyOverrides: overrideMap,
                                            occurrenceOverrides: occurrenceOverrideMap,
                                        });
                                        const memberColor = colorForResponsible(
                                            resolvedResponsible,
                                            colorMap,
                                        );
                                        return (
                                            <Pressable
                                                key={`${event.id}-${event.starts_at}`}
                                                onPress={() =>
                                                    router.push({
                                                        pathname: '/event/[id]',
                                                        params: {
                                                            id: event.id,
                                                            date: format(occurrenceDate, 'yyyy-MM-dd'),
                                                        },
                                                    })
                                                }
                                                style={({ pressed }) => [
                                                    styles.allDayChip,
                                                    {
                                                        // Tinted bg + leading rail —
                                                        // same alpha vocabulary as
                                                        // timed event blocks.
                                                        backgroundColor: withAlpha(
                                                            memberColor,
                                                            scheme === 'dark' ? 0.36 : 0.13,
                                                        ),
                                                        borderLeftColor: memberColor,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}>
                                                {/* Text-only at a 15-min-event height (14px) — no
                                                    type-icon, no child badges. Real-estate is
                                                    tight; the title carries the meaning. Whose
                                                    event it is reads from the leading rail color.
                                                    HARD_CLIP_* — no "..." indicator, see helper.
                                                    Every pixel matters; "scho..." (4 chars + dots)
                                                    becomes "school" (or "schoo" if truncated). */}
                                                <ThemedText
                                                    style={[
                                                        styles.allDayChipText,
                                                        { color: colors.text },
                                                        HARD_CLIP_STYLE,
                                                    ]}
                                                    numberOfLines={HARD_CLIP_NUMBER_OF_LINES}
                                                    ellipsizeMode="clip">
                                                    {/* Privacy gate (#469) */}
                                                    {shouldHideEventAsPrivate(
                                                        event,
                                                        user?.id,
                                                    )
                                                        ? PRIVATE_EVENT_BUSY_LABEL
                                                        : event.title}
                                                </ThemedText>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    ) : null}
                    <ScrollView
                        ref={gridScrollRef}
                        style={styles.gridScroll}
                        showsVerticalScrollIndicator={false}
                        // First-paint race fix. On cold mount the
                        // ScrollView typically fires onContentSizeChange
                        // 2+ times: once when the grid measures to
                        // 24*HOUR_HEIGHT, and again when events finish
                        // loading (or when the all-day strip appears
                        // and shrinks the scroller's outer height,
                        // which on RN-Web can quietly reset scrollTop
                        // to 0). We need to re-scroll on EVERY size
                        // change until the user has manually dragged,
                        // otherwise the second pass leaves them at
                        // midnight even though the first pass landed
                        // them correctly.
                        //
                        // `hasUserScrolledRef` is reset on every focus
                        // and flipped true by onScrollBeginDrag (native
                        // touch) + the web touch/wheel listeners below.
                        // Programmatic scrolls don't trigger
                        // onScrollBeginDrag, so our own scrollTo() never
                        // locks us out of subsequent retries.
                        //
                        // viewMode is narrowed to 'week' | 'day' here —
                        // month uses its own ScrollView in an earlier
                        // branch, so we don't need a viewMode guard.
                        onContentSizeChange={() => {
                            if (hasUserScrolledRef.current) return;
                            // Honor a one-shot deep-link scroll target
                            // (event time from /calendar?time=HH:MM) so
                            // the cold-mount measurement passes don't
                            // snap back to "now" before the focus
                            // effect's settle window clears the target.
                            const target =
                                pendingScrollHourRef.current ??
                                currentScrollHour();
                            gridScrollRef.current?.scrollTo({
                                y: target * HOUR_HEIGHT,
                                animated: false,
                            });
                        }}
                        // Native drag-start: lock out auto-scroll. Web
                        // doesn't fire this for wheel / trackpad scrolls
                        // (only touch on mobile-web), so the underlying
                        // div also listens for touchstart + wheel below.
                        onScrollBeginDrag={() => {
                            hasUserScrolledRef.current = true;
                        }}
                        // Web-only: catch wheel and trackpad scroll
                        // intents. Pointer-down is the only event we can
                        // hook for trackpad two-finger scrolls before
                        // they fire onScroll (which we can't use as a
                        // signal because our programmatic scrollTo also
                        // triggers it). React Native Web passes through
                        // standard DOM event handlers via props.
                        // @ts-expect-error — onWheel + onTouchStartCapture
                        // are valid on RN-Web's underlying div but not in
                        // RN's ScrollView prop types.
                        onWheel={() => {
                            hasUserScrolledRef.current = true;
                        }}
                        // onTouchStartCapture is in RN's PressEvent
                        // surface (no suppression needed) — covers
                        // native swipe + mobile-web tap-and-drag.
                        onTouchStartCapture={() => {
                            hasUserScrolledRef.current = true;
                        }}>
                        <View style={[styles.gridRow, { height: GRID_HEIGHT }]}>
                            <View
                                style={[
                                    styles.timeColumn,
                                    {
                                        width: TIME_COLUMN_WIDTH,
                                        borderRightColor: colors.hairS,
                                    },
                                ]}>
                                {HOURS.map((h) => (
                                    <View
                                        key={h}
                                        style={{
                                            height: HOUR_HEIGHT,
                                            // Match design's `padding: '4px 0 0 8px'`
                                            // — left padding only, none right. The
                                            // mono label hugs the left edge of the
                                            // 36px column.
                                            paddingLeft: 6,
                                            paddingTop: 4,
                                        }}>
                                        <ThemedText
                                            // numberOfLines={1} is REQUIRED on RN-
                                            // Web. Without it, "08:00" at fontSize
                                            // 9.5 in the tight 36px column was
                                            // soft-wrapping the trailing `0` to a
                                            // second line. The label string never
                                            // genuinely needs more than one line.
                                            numberOfLines={1}
                                            style={{
                                                color: colors.inkFaint,
                                                fontFamily: FontFamily.monoRegular,
                                                fontSize: 9.5,
                                                letterSpacing: -0.2,
                                                // Tight lineHeight so the label
                                                // sits cleanly at the top of the
                                                // hour row.
                                                lineHeight: 11,
                                            }}>
                                            {formatHourLabel(h)}
                                        </ThemedText>
                                    </View>
                                ))}
                            </View>

                            {days.map((day, dayIdx) => {
                                const dayIsToday = isToday(day);
                                // Past-day overlay removed at user request — the
                                // new design relies on the today accent circle
                                // alone to orient; dimming earlier-in-week
                                // columns is no longer part of the vocabulary.
                                const dayTimed = eventsForDay(timedEvents, day);
                                // Day column is view-only — no drag-to-create on web, no
                                // press-and-hold on native. The FAB is the sole create
                                // affordance (see the "Calendar grid is view-only" comment
                                // above for rationale). Plain View on both platforms, no
                                // Pressable, no ref, no crosshair cursor.
                                return (
                                    <View
                                        key={day.toISOString()}
                                        style={[
                                            styles.dayColumn,
                                            { borderRightColor: colors.backgroundSelected },
                                            // No today-column tint per the redesign —
                                            // the accent circle on the day-number cell
                                            // and the NOW line are the sole orientation
                                            // cues. Painting the full column lifted it
                                            // visually off the rest of the grid in a
                                            // way the design's clean week-view doesn't.
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
                                            // v3 spec: positions are relative to START_HOUR
                                            // (6am), and events outside the visible
                                            // [START_HOUR, END_HOUR] window are clamped or
                                            // skipped. Same pattern below for own + other-
                                            // member busy blocks.
                                            const rawTop =
                                                (startMins / 60 - START_HOUR) * HOUR_HEIGHT;
                                            const rawHeight = Math.max(
                                                (durationMs / 3600000) * HOUR_HEIGHT,
                                                14,
                                            );
                                            const clamped = clampEventToVisibleRange(
                                                rawTop,
                                                rawHeight,
                                            );
                                            if (!clamped) return null;
                                            const { top, height } = clamped;
                                            return (
                                                <View
                                                    key={`busy-${ext.id}`}
                                                    style={[
                                                        styles.busyBlock,
                                                        {
                                                            top,
                                                            height,
                                                            // Theme-aware tint — was hardcoded
                                                            // 'rgba(110, 127, 165, 0.18)' (Bell Navy
                                                            // ink frozen to light mode). Now tracks
                                                            // colors.inkSec so dark mode actually
                                                            // reads.
                                                            backgroundColor: withAlpha(
                                                                colors.inkSec,
                                                                0.18,
                                                            ),
                                                            borderLeftColor: withAlpha(
                                                                colors.inkSec,
                                                                0.55,
                                                            ),
                                                        },
                                                    ]}>
                                                    <ThemedText
                                                        type="small"
                                                        style={[
                                                            styles.busyBlockText,
                                                            { color: colors.textSecondary },
                                                        ]}
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
                                            const rawTop =
                                                (startMins / 60 - START_HOUR) * HOUR_HEIGHT;
                                            const rawHeight = Math.max(
                                                (durationMs / 3600000) * HOUR_HEIGHT,
                                                14,
                                            );
                                            const clamped = clampEventToVisibleRange(
                                                rawTop,
                                                rawHeight,
                                            );
                                            if (!clamped) return null;
                                            const { top, height } = clamped;
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

                                        {(() => {
                                            // Lane layout — overlapping events split the
                                            // column width into N tracks instead of stacking
                                            // on top of each other. Compute once per day.
                                            const lanes = computeEventLanes(dayTimed);
                                            return dayTimed.map((event) => {
                                            const start = new Date(event.starts_at);
                                            const end = new Date(event.ends_at);
                                            const startMins =
                                                start.getHours() * 60 + start.getMinutes();
                                            const durationMs = end.getTime() - start.getTime();
                                            const durationMins = durationMs / 60000;
                                            const rawTop =
                                                (startMins / 60 - START_HOUR) * HOUR_HEIGHT;
                                            const rawHeight = Math.max(
                                                (durationMins / 60) * HOUR_HEIGHT,
                                                22,
                                            );
                                            const clamped = clampEventToVisibleRange(
                                                rawTop,
                                                rawHeight,
                                            );
                                            if (!clamped) return null;
                                            const { top, height } = clamped;
                                            // Per-event lane assignment. fraction range [0..1)
                                            // gives the block's leftPct + widthPct relative to
                                            // the column width (with the column's 2px L/R
                                            // padding still applied via the eventBlock style
                                            // — we only ADD lane offsets here).
                                            const laneInfo = lanes.get(
                                                event.id + '|' + event.starts_at,
                                            ) ?? { lane: 0, lanes: 1 };
                                            const laneWidthPct = 100 / laneInfo.lanes;
                                            const laneLeftPct = laneInfo.lane * laneWidthPct;
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
                                                        {
                                                            top,
                                                            height,
                                                            // Lane layout overrides the default
                                                            // `left: 2, right: 2` from eventBlock
                                                            // when this event shares its time slot
                                                            // with another. `lanes === 1` → keep
                                                            // the default full-column width.
                                                            // Otherwise carve the column into N
                                                            // tracks. The 1px gap between adjacent
                                                            // lanes prevents a visual seam — without
                                                            // it, two 50% blocks render touching
                                                            // and read as one wide ambiguous block.
                                                            ...(laneInfo.lanes > 1
                                                                ? {
                                                                      left: `${laneLeftPct}%` as const,
                                                                      right:
                                                                          'auto' as const,
                                                                      width: `${laneWidthPct}%` as const,
                                                                      marginLeft: laneInfo.lane === 0 ? 2 : 1,
                                                                      marginRight:
                                                                          laneInfo.lane ===
                                                                          laneInfo.lanes - 1
                                                                              ? 2
                                                                              : 1,
                                                                  }
                                                                : null),
                                                            // Tinted member-color bg per the
                                                            // redesign's alpha rule (13% light /
                                                            // 36% dark) — the bright fills used
                                                            // before fought the white card / dark
                                                            // navy surfaces. Tinted bg + 2px
                                                            // leading rail in the saturated color
                                                            // gives the same identity signal at
                                                            // a quieter visual weight.
                                                            backgroundColor: withAlpha(
                                                                bg,
                                                                scheme === 'dark' ? 0.36 : 0.13,
                                                            ),
                                                            borderLeftColor: bg,
                                                            borderLeftWidth: 2,
                                                        },
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    {/* v3 spec (screens-extra-5.jsx::DayBlock
                                                        ~413-457): event blocks render TITLE +
                                                        SUB only — no event-type icon, no child
                                                        avatars. The spec's "sub" is something
                                                        like "Tiny Sprouts · Riley" (location +
                                                        responsible parent first name). Week
                                                        keeps title-only (columns too narrow
                                                        for a sub line). Handoff/conflict
                                                        glyphs in the title row will land with
                                                        the Phase F follow-up (#458). */}
                                                    {(() => {
                                                        // Privacy gate (#469) — compute once
                                                        // for the block so the title AND the
                                                        // day-view sub line both honor it.
                                                        // When hidden, render "Busy" and
                                                        // suppress the sub entirely.
                                                        const hidePrivate =
                                                            shouldHideEventAsPrivate(
                                                                event,
                                                                user?.id,
                                                            );
                                                        return (
                                                            <>
                                                    <ThemedText
                                                        type="small"
                                                        style={[
                                                            styles.eventTitle,
                                                            { color: colors.text },
                                                            HARD_CLIP_STYLE,
                                                        ]}
                                                        numberOfLines={HARD_CLIP_NUMBER_OF_LINES}
                                                        ellipsizeMode="clip">
                                                        {hidePrivate
                                                            ? PRIVATE_EVENT_BUSY_LABEL
                                                            : event.title}
                                                    </ThemedText>
                                                    {viewMode === 'day' &&
                                                    height >= 40 &&
                                                    !hidePrivate ? (
                                                        (() => {
                                                            // Build "<location> · <responsible
                                                            // firstname>" sub-text. Either
                                                            // piece can be missing — fall
                                                            // through gracefully. When both
                                                            // are missing, skip the line
                                                            // entirely so we don't render an
                                                            // empty meta row.
                                                            const loc = event.location;
                                                            const respMember = resolvedResponsible
                                                                ? members?.find(
                                                                      (m) =>
                                                                          m.profile_id ===
                                                                          resolvedResponsible,
                                                                  )
                                                                : null;
                                                            const respFirst = respMember
                                                                ? respMember.display_name?.split(
                                                                      ' ',
                                                                  )[0] ?? null
                                                                : null;
                                                            const parts = [
                                                                loc,
                                                                respFirst,
                                                            ].filter(
                                                                (x): x is string => !!x,
                                                            );
                                                            if (parts.length === 0) return null;
                                                            return (
                                                                <ThemedText
                                                                    style={[
                                                                        styles.eventSub,
                                                                        {
                                                                            color: colors.textSecondary,
                                                                            fontFamily:
                                                                                FontFamily.monoRegular,
                                                                        },
                                                                    ]}
                                                                    numberOfLines={1}>
                                                                    {parts.join(' · ')}
                                                                </ThemedText>
                                                            );
                                                        })()
                                                    ) : null}
                                                            </>
                                                        );
                                                    })()}
                                                    {/* Time text dropped from the block — the block's
                                                        position on the grid IS the time. Showing
                                                        "08:30 – 09:00" inside a block already
                                                        pinned to 08:30 is redundant noise in the
                                                        scant pixels we have. */}
                                                    {untilLabel && height >= 56 ? (
                                                        <ThemedText
                                                            type="small"
                                                            style={[
                                                                styles.eventUntil,
                                                                { color: colors.textSecondary },
                                                            ]}
                                                            numberOfLines={1}>
                                                            ↻ {untilLabel}
                                                        </ThemedText>
                                                    ) : null}
                                                    {/* Notes indicator: day view only. In week view
                                                        the blocks are too narrow to spare a corner
                                                        for it; day view has full-width blocks where
                                                        the icon reads cleanly. */}
                                                    {hasNote && viewMode === 'day' ? (
                                                        <Feather
                                                            name="file-text"
                                                            size={10}
                                                            color={colors.textSecondary}
                                                            style={styles.noteIcon}
                                                        />
                                                    ) : null}
                                                    {/* Conflict "bug" badge — 14×14 warn pill in
                                                        the block's bottom-right corner when this
                                                        instance is in the household-wide
                                                        conflict set. Tap intercepts the block's
                                                        primary onPress (which opens Event detail)
                                                        and routes to /conflict/[id] instead.
                                                        Per v3 spec § The conflict-resolver
                                                        access rule. We use the same `id|starts_at`
                                                        key the lane assignment / conflict
                                                        summary use, so a recurring event's
                                                        Tuesday occurrence flags independent of
                                                        its other dates.

                                                        Week-view side-by-side blocks: when two
                                                        events share a time slot they render in
                                                        two lanes. The bug only renders on the
                                                        LEFT block (lane 0) of a multi-lane
                                                        cluster so the affordance reads as one
                                                        shared signal, not duplicated chrome.
                                                        The conflict resolver doesn't care which
                                                        block was tapped; either lane routes to
                                                        the same /conflict/[id]. In day view
                                                        `laneInfo.lanes` is always 1 (full-width
                                                        blocks), so the guard is a no-op there. */}
                                                    {conflictKeys.has(
                                                        event.id +
                                                            '|' +
                                                            event.starts_at,
                                                    ) &&
                                                    !(
                                                        laneInfo.lanes > 1 &&
                                                        laneInfo.lane > 0
                                                    ) ? (
                                                        <Pressable
                                                            onPress={(e) => {
                                                                // Stop the underlying block's
                                                                // press from also firing (which
                                                                // would route to /event/[id]).
                                                                // Bug = explicit conflict-only
                                                                // affordance.
                                                                e.stopPropagation?.();
                                                                router.push({
                                                                    pathname:
                                                                        '/conflict/[id]',
                                                                    params: { id: event.id },
                                                                });
                                                            }}
                                                            accessibilityRole="button"
                                                            accessibilityLabel="Open conflict resolver"
                                                            // 24×24 hit target around the
                                                            // 14×14 visual per spec —
                                                            // padded transparent margin
                                                            // expands the tap area without
                                                            // visually inflating the bug.
                                                            hitSlop={5}
                                                            style={({ pressed }) => [
                                                                styles.conflictBug,
                                                                {
                                                                    backgroundColor:
                                                                        colors.warn,
                                                                    borderColor:
                                                                        colors.backgroundElement,
                                                                },
                                                                pressed && styles.pressed,
                                                            ]}>
                                                            <ThemedText
                                                                style={
                                                                    styles.conflictBugGlyph
                                                                }>
                                                                !
                                                            </ThemedText>
                                                        </Pressable>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        });
                                        })()}

                                    </View>
                                );
                            })}
                            {/* NOW line. Renders only when today is in the
                                visible range (otherwise it's a confusing
                                accent line on someone else's week). Absolute
                                positioned inside gridRow at top = current
                                hour + minutes offset. The leading dot extends
                                3px above/left of the line so the marker reads
                                as a pin at the time column edge. The line
                                does NOT auto-update — it reflects the time at
                                last render. Good enough for now; a 60s tick
                                would be a small follow-up if needed. */}
                            {(() => {
                                const todayInRange = days.some((d) => isToday(d));
                                if (!todayInRange) return null;
                                const now = new Date();
                                // Offset by START_HOUR (6am) so the now-line sits
                                // in grid-relative coords. Outside the visible
                                // range (e.g. 2am) the line falls off the top of
                                // the grid; we don't render a marker for that —
                                // there's nothing useful to point at.
                                const nowHour =
                                    now.getHours() + now.getMinutes() / 60;
                                if (nowHour < START_HOUR || nowHour > END_HOUR + 1) {
                                    return null;
                                }
                                const nowTop = (nowHour - START_HOUR) * HOUR_HEIGHT;
                                return (
                                    <View
                                        style={[
                                            styles.nowLine,
                                            {
                                                top: nowTop,
                                                left: TIME_COLUMN_WIDTH,
                                                backgroundColor: colors.accent,
                                            },
                                            { pointerEvents: 'none' },
                                        ]}>
                                        <View
                                            style={[
                                                styles.nowDot,
                                                { backgroundColor: colors.accent },
                                            ]}
                                        />
                                    </View>
                                );
                            })()}
                        </View>
                    </ScrollView>
                    </View>
                    </View>
                )}
                    </>
                )}
            </SafeAreaView>

            {/* Month view drops the FAB entirely — per v3 spec, the
                permanent selected-day preview card carries the create
                action inside its footer. Day + Week keep the kind-
                committed FAB. */}
            {showCreateAffordances && viewMode !== 'month' ? (
                <Pressable
                    onPress={() => router.push('/event/new')}
                    accessibilityRole="button"
                    accessibilityLabel="New event"
                    style={({ pressed }) => [
                        styles.fab,
                        // Theme-aware accent — was hardcoded BrandColors.accent in
                        // the static style which pinned to the light-mode forest
                        // green (#2D8B6E) even in dark mode where accent is #3FC198.
                        { backgroundColor: colors.accent },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="plus" size={18} color={colors.onAccent} />
                    <ThemedText style={[styles.fabText, { color: colors.onAccent }]}>
                        New event
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 6,
        gap: 6,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    headerLeft: { flex: 1, minWidth: 0 },
    headerSuper: { fontSize: 10, letterSpacing: -0.2 },
    // D/W/M segmented control — 3-cell pill in an inset bg; the active cell
    // lifts to the card surface for a "you are here" pop without using accent
    // color (accent stays reserved for the FAB / today marker).
    segControl: {
        flexDirection: 'row',
        padding: 3,
        borderRadius: 8,
        gap: 4,
    },
    segChip: {
        width: 26,
        height: 22,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segChipText: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    // (navStrip / todayPill removed — the redesign has no visible nav chrome
    // for week navigation. Users move between weeks via swipe gesture on
    // native, and via the D/W/M segmented control / tapping the date title
    // on web. The handlers stepBack / stepForward / jumpToToday stay in the
    // component for future bindings.)
    // Empty-state banner above the framed grid. 12px horizontal to align
    // with the frame; no bottom border since the frame below carries the
    // boundary.
    dayEmptyBanner: {
        paddingHorizontal: 16,
        paddingVertical: Spacing.two,
    },
    // ─── Month view ────────────────────────────────────────────────────────────
    // Vertical scroll wraps the grid so phone heights with tall headers still see
    // the full 6 rows. On wider screens the contentContainerStyle below lets the
    // grid claim the full available height and the rows flex evenly.
    monthScroll: { flex: 1 },
    monthScrollContent: {
        // 12px horizontal padding matches the rest of the calendar
        // surfaces (week / day grids both inset by 12px). Bottom padding
        // gives the selected-day preview card a generous gutter under
        // the card grid.
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 16,
    },
    // Day-letter row — single letters S M T W T F S, mono caps, sits
    // directly above the cards. 4px bottom padding matches the spec.
    monthDowRow: {
        flexDirection: 'row',
        paddingBottom: 4,
    },
    monthDowCell: {
        flex: 1,
        alignItems: 'center',
    },
    monthDowText: {
        fontSize: 10,
        letterSpacing: 0.3,
    },
    // Card grid — flex-row wrap. With a 4px gap between columns and a
    // 4px gap between rows, each cell needs `flexBasis: calc((100% - 24px)/7)`
    // to size to a true 1/7 of the row. We approximate via percent: 7 cells
    // + 6 gaps of 4px ≈ 24px total gap; using ~14% flexBasis with flexGrow
    // 1 keeps the row balanced. We accept a tiny sub-pixel rounding error
    // rather than computing exact widths — RN's flex layout absorbs it.
    monthGridCards: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    // In-month cell card — radius 8, hair border, 64px tall, centered
    // column-axis content. The 4px gap on the parent draws the
    // separation between cards; no internal cell borders needed.
    monthCellCard: {
        // flexBasis: just under 1/7 so the gap fits — RN's flex math
        // handles the remainder. `flexGrow: 0` so cells don't expand
        // beyond their basis on wider viewports.
        flexBasis: '13.5%',
        flexGrow: 1,
        flexShrink: 0,
        height: 64,
        borderRadius: 8,
        paddingTop: 4,
        paddingBottom: 4,
        alignItems: 'center',
        gap: 4,
    },
    // Out-of-month positions — same footprint, no chrome. Pure spacer so
    // the 7×6 layout rhythm stays consistent through short months.
    monthCellSpacer: {
        flexBasis: '13.5%',
        flexGrow: 1,
        flexShrink: 0,
        height: 64,
    },
    // 22×22 day-number "pill" — flat text when not today, accent-filled
    // circle when today (background applied inline on render).
    monthCellDayNumCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthCellDayNumText: {
        fontSize: 13,
        letterSpacing: -0.3,
    },
    // 5×5 event dots in a wrapping row, capped to ~36px max-width so a
    // dense day's dots wrap to a second line under the day-number circle
    // rather than spilling outside the cell.
    monthCellDots: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'center',
        maxWidth: 36,
    },
    monthCellDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    // "+N" mono overflow caption — tight letter-spacing, sits one line
    // below the dot row when there are more than 3 events on the day.
    monthCellOverflow: {
        fontSize: 8.5,
        letterSpacing: -0.2,
        marginTop: -2,
    },
    // 5×5 warn pip in the bottom-right corner of cells with at least
    // one conflicting event. Absolute-positioned so it doesn't disturb
    // the dot row's centered layout. 1px border in the cell-fill color
    // makes the pip visible whether the cell itself is white (default),
    // accent-tinted (selected), or sits on a colored stripe.
    monthCellConflictDot: {
        position: 'absolute',
        right: 4,
        bottom: 4,
        width: 5,
        height: 5,
        borderRadius: 3,
        borderWidth: 1,
    },
    // ── Conflict bug badge (week + day event blocks) ──────────────────
    // 14×14 round warn-filled badge in the block's bottom-right corner.
    // 1.5px card-color outline so it reads as a pin pressed onto the
    // block rather than blending into the tinted block bg. Soft shadow
    // adds a slight elevation cue (matches the spec). Glyph is a white
    // exclamation centered inside.
    conflictBug: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
        zIndex: 2,
    },
    conflictBugGlyph: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
        lineHeight: 10,
    },
    // ── Day view's 5-day mini date strip (v3 spec, screens-extra-5.jsx
    //    CalendarDay ~240-283). Sits below the title header on Day view
    //    only; Week view continues to use dayHeaderRow below.
    miniDateStripRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        justifyContent: 'space-between',
    },
    // 26×26 square chevron buttons flanking the 5 pills. backgroundColor
    // + border applied inline so theme tokens resolve at render time.
    miniDateChevBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // 32×32 pill per date. Mono dow letter (top) + day number (bottom).
    // Active pill = accent-filled with onAccent text; the inline color
    // logic at render time handles that.
    miniDatePill: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniDatePillDow: {
        fontSize: 8.5,
        letterSpacing: 0.3,
        lineHeight: 10,
    },
    miniDatePillNum: {
        fontSize: 11.5,
        letterSpacing: -0.3,
        lineHeight: 14,
    },
    // ── Day-view summary pills row (Phase 8a, v3 spec
    //    screens-extra-5.jsx:287-292). Sits between the mini-date strip
    //    and the all-day strip. flexWrap so 4 pills fit on a narrow
    //    iPhone width without truncation, and so absent pills collapse
    //    cleanly without leaving holes.
    daySummaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    // Sub-text on Day-view event blocks — "<location> · <responsible
    // firstname>" mono caption beneath the title. Hidden on Week.
    eventSub: {
        fontSize: 9.5,
        letterSpacing: -0.2,
        lineHeight: 12,
        marginTop: 1,
    },
    dayHeaderRow: {
        flexDirection: 'row',
        // 12px horizontal padding to match the framed grid below, so the
        // day-label columns line up with the day columns inside the frame.
        paddingHorizontal: 12,
    },
    dayLabel: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        gap: 4,
        // Relative positioning so the override dot can absolute-anchor to the
        // day-number cell.
        position: 'relative',
    },
    dayLabelDow: {
        fontSize: 10,
        letterSpacing: -0.2,
    },
    // 22×22 cell wrapping the day number. Background fills to accent on
    // today (forest circle); transparent otherwise. The mono number sits
    // centered inside.
    dayLabelNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayLabelNumText: {
        fontSize: 13,
        letterSpacing: -0.3,
    },
    // 24×3 custody bar at the bottom of each day-label column. Replaces the
    // previous 28px-tall ribbon band below the headers — same data, tighter
    // vocabulary that lets the day cells own the full custody affordance.
    // On hand-off days the View is used as a flex-row container for two
    // 12×3 segments (see dayLabelCustodyBarSplit + dayLabelCustodySegment).
    dayLabelCustodyBar: {
        width: 24,
        height: 3,
        borderRadius: 2,
    },
    // Hand-off-day variant: container for two color segments. overflow:hidden
    // so the inner segments respect the outer 2px radius without bleeding.
    dayLabelCustodyBarSplit: {
        flexDirection: 'row',
        overflow: 'hidden',
        // 1px gap between segments via tiny padding-trick would soften the
        // hand-off signal; the design uses adjacent segments with no gap
        // (direction-c-pro.jsx:755-759 — `gap: 1` is in the design but at 24px
        // total that's a noticeable seam; matching the cleaner edge-to-edge
        // look reads better on real screens).
    },
    dayLabelCustodySegment: {
        flex: 1,
        height: 3,
    },
    // Override marker — 6px warn-color dot pinned to the top-right of the
    // day-label column. Replaces the inner-border override visual the old
    // ribbon used; the 3px custody bar is too thin to carry the override
    // signal on its own.
    dayLabelOverrideDot: {
        position: 'absolute',
        top: 6,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    // All-day strip — top row inside the framed grid card. No horizontal
    // page padding here (the frame already insets the card). Leading
    // "ALL DAY" label cell restored per direction-c-pro.jsx:767 — anchors
    // the row visually so users don't have to infer "this row is
    // different" from chip placement alone. Bottom hairline separates
    // from hourly scroll area.
    allDayRowInFrame: {
        flexDirection: 'row',
        minHeight: ALL_DAY_ROW_HEIGHT,
        paddingVertical: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    // Leading label cell — TIME_COLUMN_WIDTH wide so it aligns with the
    // hour-of-day labels in the grid below. Vertically center the mono
    // caps text against the chip rail.
    allDayLabelCell: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    allDayLabel: {
        fontSize: 9,
        letterSpacing: 0.4,
        // Mono caps reads as "anchor", not "title" — keeps the row's
        // identity contained while not competing with the chips for
        // attention.
    },
    allDayCell: {
        flex: 1,
        paddingHorizontal: 2,
        gap: 2,
    },
    // Tinted member-color chip — same alpha vocabulary as the hourly event
    // blocks, 2px leading rail in the saturated color. Fixed 14px height
    // matches a 15-minute time-grid block (HOUR_HEIGHT=56 → 14 per quarter),
    // so the all-day strip can't dominate the visible grid. Horizontal
    // padding only; the explicit lineHeight on the text centers it inside
    // the 14px box.
    allDayChip: {
        height: 14,
        paddingHorizontal: 6,
        paddingVertical: 0,
        borderRadius: 4,
        borderLeftWidth: 2,
        justifyContent: 'center',
    },
    // Design's all-day chip uses Geist Mono at default weight (no fontWeight
    // override in the source CSS). Mono at 9.5px is narrower than the sans
    // titles inside timed-event blocks, which leaves more room for the title
    // string in the same horizontal cell. fontFamily must be explicit — RN
    // <Text> doesn't inherit it from the container.
    allDayChipText: {
        fontFamily: FontFamily.monoRegular,
        fontSize: 9.5,
        letterSpacing: -0.2,
        lineHeight: 14,
    },
    // 12px horizontal padding matches the spec's `inset: '0 12px'` on
    // the grid scroll wrapper. paddingBottom: 12 lets the grid card
    // extend all the way down to the tab-bar edge with only a small
    // visual breathing gap; the FAB at bottom: 16 floats ABOVE the
    // card per the v3 spec (onenest-spec-v3/design_handoff_calendar_
    // conflicts §Calendar week grid extends to the tab bar — "calendar
    // container should extend all the way to the navigation bar with
    // FAB floating above"). Previously we reserved 68px for the FAB
    // *under* the card; removing that reservation gives ~56px of
    // additional vertical real estate to the time grid, which matters
    // most on Day view where every visible hour counts.
    gridFrameWrap: { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },
    // The frame itself — 10px rounded card with hairline border that holds
    // the scrolling hour grid. overflow:hidden so the rounded corners clip
    // the inner ScrollView's edges cleanly.
    gridFrame: {
        flex: 1,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    gridScroll: { flex: 1 },
    gridRow: { flexDirection: 'row', position: 'relative' },
    // NOW line — 1px accent horizontal line that spans all visible day
    // columns at the current time's y-offset. The leading dot extends 3px
    // above/left of the line so the marker reads as a pin at the time-
    // column edge. Renders only when today is in the visible range.
    nowLine: {
        position: 'absolute',
        right: 0,
        height: 1,
        zIndex: 3,
    },
    nowDot: {
        position: 'absolute',
        left: -3,
        top: -3,
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    timeColumn: { borderRightWidth: StyleSheet.hairlineWidth },
    dayColumn: {
        flex: 1,
        position: 'relative',
        borderRightWidth: StyleSheet.hairlineWidth,
    },
    // pastDayOverlay removed — past-day dim was dropped from the calendar
    // week/day view per the redesign. The today accent circle is the sole
    // orientation cue for "where am I in time."
    hourLine: { borderTopWidth: StyleSheet.hairlineWidth },
    eventBlock: {
        position: 'absolute',
        left: 2,
        right: 2,
        // 6px radius (was 4) — the design source specs 4 in raw CSS but on
        // small tinted blocks the perceived roundness is softer than the
        // rendered rect suggests; bumping to 6 matches the design's visual
        // weight of clearly-rounded corners. The 2px leading rail extends
        // the full block height so the LEFT corners read more squared due
        // to the rail border — the right corners carry the full radius.
        borderRadius: 6,
        // Padding matches the design's `padding: '2px 4px'` exactly. Earlier
        // we were running 3/3/6/4 — the extra 2px on the left was the main
        // reason "Oliver pediatric" fit in the design's column but our column
        // could only show ~4 letters. (The text's own fontFamily was the
        // other half: see `eventTitle` for that fix.)
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 4,
        paddingRight: 4,
        overflow: 'hidden',
        zIndex: 2,
    },
    // External-calendar busy blocks. backgroundColor + borderLeftColor are
    // injected per-render with theme tokens (see the busy block render block
    // above) so dark mode actually applies. Italic font was dropped per the
    // design system rule "no italics in chrome".
    busyBlock: {
        position: 'absolute',
        left: 1,
        right: 1,
        borderLeftWidth: 2,
        borderRadius: 2,
        paddingHorizontal: 3,
        paddingTop: 1,
        overflow: 'hidden',
        zIndex: 1,
    },
    // lineHeight pinned so the `type="small"` ThemedText default (20) doesn't
    // force the busy block taller than its visible row when blocks are short.
    busyBlockText: { fontSize: 10, lineHeight: 12 },
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
    // 9px / 600 / -0.15 / lineHeight 1.2 — exact spec from the design's
    // CCalBlock. Small on purpose: the calendar grid blocks are cramped and
    // a larger title fights the time/dur info below. color overridden
    // inline at render so theme-aware ink picks correct contrast against
    // the tinted bg.
    // 9px / 600 / -0.15 / lineHeight 11 — exact spec from the design's
    // CCalBlock (fontSize 9, lineHeight 1.2 → 10.8 ≈ 11). fontFamily MUST
    // be set explicitly: RN's <Text> doesn't inherit fontFamily from its
    // container the way CSS does, so without this it would render in the
    // platform's system sans-serif. System sans (esp. SF on iOS / Segoe on
    // Windows) is noticeably wider per glyph than Geist at small sizes —
    // skipping this single property is what kept us from fitting "Oliver
    // pediatric" in a column the design fits it in cleanly.
    eventTitle: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: -0.15,
        lineHeight: 11,
    },
    // Inline row that places ChildBadges next to the event title in time-grid blocks.
    // (No all-day equivalent — the all-day chip is text-only now, so it doesn't need a row.)
    eventTitleRow: {
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
        gap: 6,
        paddingHorizontal: 16,
        // Per design: paddingTop 8, paddingBottom 6 (asymmetric). The 6px
        // bottom + the day-header's 8px top below give the 14px gap the
        // design uses between filter strip and the M T W T F S S row.
        paddingTop: 8,
        paddingBottom: 6,
        alignItems: 'center',
    },
    // Compact filter pill matching the design's CChip. Padding 3/10 (was
    // 4/10) + explicit lineHeight 14 on the text — without those the
    // text's default RN line-height inflated chip height ~4px, making the
    // pills read squat/circular instead of the design's slim/elongated
    // shape.
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    filterChipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    filterChipText: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 11.5,
        letterSpacing: -0.1,
        // 14 (≈ 1.2× font) keeps the glyph cap+baseline tight without
        // adding RN-Web's default vertical leading slack.
        lineHeight: 14,
    },
    // "ends MMM d" line on recurring events with an UNTIL clause — rendered
    // only on blocks ≥56px tall (60-min events and up) where there's room.
    // No `eventTime` style any more: the time row was dropped from the block
    // (the block's y-position on the grid already encodes the time).
    eventUntil: { fontSize: 9.5, opacity: 0.8, marginTop: 1 },
    // Anchored to the bottom-right of the event block so it doesn't crowd the child-badge
    // row at the top-right. Small fontSize keeps it from overlapping the time label.
    noteIcon: { position: 'absolute', bottom: 3, right: 4 },
    // FAB pill — Calendar variant.
    //
    // Position: bottom: 16 — per the v3 FAB rule
    // (onenest-spec-v3/design_handoff_calendar_conflicts §FAB position
    // rule). All FABs sit at the canonical 16px from the screen-area
    // bottom edge. The 56px lift to bottom: 72 used by the prior design
    // was reserving space for a persistent drag-hint banner, which the
    // v3 spec moves into a transient drag-only state — fade the FAB
    // out during an active drag, fade the hint in at the same slot.
    // When that drag-hint state ships, it should occupy the same
    // bottom: 16 position the FAB just vacated; the two never coexist.
    //
    // Drag-to-reschedule ghost convention (deferred): when the user
    // drags an existing event to a new time, the preview block uses a
    // DASHED border in the same member color as the dragged event
    // (instead of the solid leading rail used by committed blocks).
    // Same convention for any future drag-to-preview surface — keep
    // ghosts dashed + member-tinted so users distinguish provisional
    // state from committed state at a glance.
    //
    // Label: "New event" (vs Home's generic "New"). Calendar's only
    // create action is an event, so the explicit label removes any
    // ambiguity. backgroundColor + label color are injected per-render
    // with theme tokens (colors.accent / colors.onAccent) so dark mode
    // brightens the accent and flips the label to dark — see the FAB
    // JSX. The static defaults here intentionally OMIT colors.
    fab: {
        position: 'absolute',
        right: 16,
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
    // ── Month selected-day preview card ─────────────────────────────────
    // Pinned to the bottom of Month view in place of the FAB. Per v3 spec
    // (onenest-spec-v3 §Calendar month) — primary CTA "+ NEW EVENT" plus
    // "OPEN DAY VIEW →" live in the footer; the body lists up to 4 tiny
    // event rows for the selected day. Horizontal margin matches the
    // existing gridFrameWrap (12px) so the card aligns visually with the
    // grid. bottom: 8 mirrors the FAB's bottom: 16 minus the card's own
    // 14px top padding — same optical position.
    monthPreviewCard: {
        marginHorizontal: 12,
        marginBottom: 8,
        marginTop: 8,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
    },
    monthPreviewHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    monthPreviewHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    monthPreviewDate: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    monthPreviewTodayPill: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    monthPreviewCount: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    monthPreviewEvents: {
        flexDirection: 'column',
        gap: 5,
    },
    monthPreviewEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    // 50px wide so 24h times ("23:59") never wrap; aligns the leading
    // edge of every title across rows.
    monthPreviewEventTime: {
        width: 50,
        fontSize: 10.5,
        letterSpacing: -0.2,
    },
    // 2×12 vertical rail per spec CMTinyEvent line 200 — `width: 2,
    // height: 12, borderRadius: 1`. Replaces the earlier circular dot,
    // which read differently from the design. The rail visually echoes
    // the leading color rail on Day/Week event blocks, so the per-event
    // color identity is consistent across surfaces.
    monthPreviewEventDot: {
        width: 2,
        height: 12,
        borderRadius: 1,
    },
    monthPreviewEventTitle: {
        flex: 1,
        fontSize: 12.5,
        letterSpacing: -0.2,
    },
    monthPreviewMore: {
        fontSize: 10.5,
        letterSpacing: -0.2,
        marginTop: 2,
    },
    monthPreviewEmpty: {
        fontSize: 12,
        paddingVertical: 8,
    },
    monthPreviewFooter: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
    },
    monthPreviewAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    monthPreviewActionLabel: {
        fontSize: 11,
        letterSpacing: 0.3,
    },
    monthPreviewActionDivider: {
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
    },
    pressed: { opacity: 0.7 },
});
