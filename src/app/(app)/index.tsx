import { Feather } from '@expo/vector-icons';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CustodyStripSection } from '@/components/custody/custody-strip-section';
import { HairlineDivider, MemberStack, SectionHeader, TaskRow } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { QuickCreateSheet } from '@/components/quick-create-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
    BrandColors,
    Colors,
    FontFamily,
    Spacing,
    Typography,
} from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useEventOccurrenceOverrides } from '@/hooks/use-event-occurrence-overrides';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useLists } from '@/hooks/use-lists';
import { useMyRole } from '@/hooks/use-my-role';
import { useTasksForEvents } from '@/hooks/use-tasks-for-events';
import { useUpcomingTasks } from '@/hooks/use-upcoming-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useUpcomingEvents } from '@/hooks/use-upcoming-events';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { withAlpha, FAB_SHADOW } from '@/lib/platform-styles';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { firstNameOf } from '@/lib/names';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
import {
    setTaskCompleted,
    type Child,
    type Event,
    type EventOccurrenceOverride,
    type HouseholdMember,
    type List as TaskList,
    type Task,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import {
    shouldHideEventAsPrivate,
    PRIVATE_EVENT_BUSY_LABEL,
} from '@/lib/event-visibility';
import { useAppColorScheme } from '@/providers/theme-provider';

// ─── Home / Today ────────────────────────────────────────────────────────────
//
// Per the redesign handoff (P3 Mist Forest, ProHome reference). Layout:
//
//   • Header — household logo + name + people-count chip, bell, user avatar
//   • Greeting hero — mono date + "Good morning, {name}" + mono-numeral summary
//   • AI parse bar — Cmd-K visual placeholder (LLM integration deferred — see #303)
//   • Conflict ribbon — warn-tinted card with quick-resolve buttons (when any)
//   • Today timeline card — events with mono time + assignee rail + child dot
//   • Tomorrow preview card — count + hand-off note + first item
//   • [Later this week sliver] / [Anytime sliver] — task overflow buckets
//   • FAB pill bottom-right — "+ New" opens the quick-create chooser
//
// Data sources are unchanged from before — every existing hook (events,
// tasks, custody, members, etc.) feeds the same render. Only the visual
// layout is new. Caregivers still get a strictly read-only render (no FAB,
// no inline conflict actions); RLS in migration 0031 enforces the rule
// server-side as well.

function eventsForDay(events: Event[], day: Date): Event[] {
    // Timed events appear on their start day. Multi-day all-day events appear
    // on every day they cover (per QA-005, anchored at UTC midnight — we
    // identify their day range via the YYYY-MM-DD prefix of the ISO string).
    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return events
        .filter((e) => {
            if (e.all_day) {
                const startKey = e.starts_at.slice(0, 10);
                const endExclusive = new Date(e.ends_at);
                endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
                const endKey = endExclusive.toISOString().slice(0, 10);
                return dayKey >= startKey && dayKey <= endKey;
            }
            return isSameDay(new Date(e.starts_at), day);
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

// Widened to accept both light + dark palette literal types. Without this,
// `(typeof Colors)['light']` infers the exact hex strings of the light
// palette, which dark mode's values (e.g. text '#F0F0F2' vs '#161C18')
// don't match — TypeScript flags the cross-mode assignment as incompatible.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export default function HomeScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors: Palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // ── State ──────────────────────────────────────────────────────────────
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const closeAddMenu = useCallback(() => setAddMenuOpen(false), []);
    const openNew = useCallback(
        (path: '/event/new' | '/task/new' | '/contact/new') => {
            closeAddMenu();
            router.push(path);
        },
        [router, closeAddMenu],
    );

    const { households } = useHouseholds();
    const household = households?.[0];
    const { user } = useAuth();

    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const showCreateAffordances = !roleLoading && !isCaregiver;

    // UX-019: first-run welcome card. Persisted per-household via AsyncStorage.
    const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(null);
    const welcomeKey = household
        ? `onenest:home-welcome-dismissed:${household.id}`
        : null;
    useEffect(() => {
        // QA-021: reset to null on household change so a switch doesn't briefly
        // render the previous household's dismissal state.
        setWelcomeDismissed(null);
        if (!welcomeKey) return;
        AsyncStorage.getItem(welcomeKey)
            .then((v) => setWelcomeDismissed(v === 'true'))
            .catch(() => setWelcomeDismissed(false));
    }, [welcomeKey]);
    const dismissWelcome = useCallback(() => {
        setWelcomeDismissed(true);
        if (welcomeKey) {
            AsyncStorage.setItem(welcomeKey, 'true').catch(() => undefined);
        }
    }, [welcomeKey]);

    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    const { children, refetch: refetchChildren } = useChildren(household?.id);
    const { schedule: custodySchedule, refetch: refetchCustody } = useCustodySchedule(
        household?.id,
    );
    const { events, isLoading, refetch: refetchEvents } = useUpcomingEvents(household?.id);
    const { summary, refetch: refetchSummary } = useWeekSummary(household?.id);
    const { buckets: rawTaskBuckets, refetch: refetchTasks } = useUpcomingTasks(
        household?.id,
    );
    // All household lists — fed into the shared TaskRow so its meta strip
    // can render cross-list color-dot pills (e.g. "Errands · School") the
    // same way Lists does. Today doesn't surface list management (no
    // expand/add affordance), but it should still SURFACE what lists a
    // task lives in.
    const { lists: allLists } = useLists(household?.id);
    const colorMap = useMemo(() => memberColorMap(members), [members]);

    // Home digest = tasks the current user can plausibly act on (assigned to
    // me OR unassigned). Mirrors the sunday-summary edge function rule so
    // push counts and on-screen counts stay in sync.
    const taskBuckets = useMemo(() => {
        const mine = (t: Task) =>
            t.assignee_profile_ids.length === 0 ||
            (!!user && t.assignee_profile_ids.includes(user.id));
        return {
            today: rawTaskBuckets.today.filter(mine),
            thisWeek: rawTaskBuckets.thisWeek.filter(mine),
            undated: rawTaskBuckets.undated.filter(mine),
        };
    }, [rawTaskBuckets, user]);

    const today = useMemo(() => startOfDay(new Date()), []);
    const tomorrow = useMemo(() => addDays(today, 1), [today]);

    // Today's + tomorrow's events. Hoisted above useFocusEffect / the
    // task-toggle handler because useTasksForEvents (just below) needs
    // their ids, and the focus/toggle deps need refetchEventTasks.
    const todayEvents = useMemo(() => eventsForDay(events ?? [], today), [events, today]);
    const tomorrowEvents = useMemo(
        () => eventsForDay(events ?? [], tomorrow),
        [events, tomorrow],
    );

    // All tasks (open + completed) attached to today's or tomorrow's events.
    // The default upcoming-tasks bucket only returns INCOMPLETE tasks, which
    // works for the standalone "today's tasks" list but not for the per-event
    // counter: "2 of 5 done" needs the denominator (total tasks) AND the
    // numerator (done tasks). useTasksForEvents fetches both in one IN-query.
    // Refetched alongside the standard buckets on focus + on toggle.
    const eventIdsToFetchTasksFor = useMemo(
        () => [...todayEvents, ...tomorrowEvents].map((e) => e.id),
        [todayEvents, tomorrowEvents],
    );
    const {
        byEvent: eventTasksByEvent,
        refetch: refetchEventTasks,
    } = useTasksForEvents(eventIdsToFetchTasksFor);

    const { overrides: custodyOverrides, refetch: refetchOverrides } = useCustodyOverrides(
        household?.id,
        today,
        tomorrow,
    );
    const {
        overrideMap: occurrenceOverrideMap,
        refetch: refetchOccurrenceOverrides,
    } = useEventOccurrenceOverrides(household?.id, today, tomorrow);

    useFocusEffect(
        useCallback(() => {
            refetchEvents();
            refetchMembers();
            refetchChildren();
            refetchCustody();
            refetchOverrides();
            refetchOccurrenceOverrides();
            refetchSummary();
            refetchTasks();
            refetchEventTasks();
        }, [
            refetchEvents,
            refetchMembers,
            refetchChildren,
            refetchCustody,
            refetchOverrides,
            refetchOccurrenceOverrides,
            refetchSummary,
            refetchTasks,
            refetchEventTasks,
        ]),
    );

    const onToggleTaskComplete = async (task: Task) => {
        await setTaskCompleted(task.id, !task.completed_at);
        // Refetch both the standalone-tasks bucket (which only includes
        // open tasks) and the per-event tasks bucket (which includes done
        // tasks, so the inline expanded list updates the check mark and
        // the badge counter without a stale render).
        await Promise.all([refetchTasks(), refetchEventTasks()]);
    };

    const overrideMap = useMemo(
        () => buildOverrideMap(custodyOverrides),
        [custodyOverrides],
    );

    const isSameYmd = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    const todayTasks = useMemo(() => taskBuckets.today, [taskBuckets.today]);
    const tomorrowTasks = useMemo(
        () =>
            taskBuckets.thisWeek.filter(
                (t) => t.due_at && isSameYmd(new Date(t.due_at), tomorrow),
            ),
        [taskBuckets.thisWeek, tomorrow],
    );
    const laterThisWeekTasks = useMemo(
        () =>
            taskBuckets.thisWeek.filter(
                (t) => !t.due_at || !isSameYmd(new Date(t.due_at), tomorrow),
            ),
        [taskBuckets.thisWeek, tomorrow],
    );

    // ── Per-day badge counts ───────────────────────────────────────────────
    const conflictCountsByDay = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of summary?.conflicts ?? []) {
            const key = format(new Date(c.event.starts_at), 'yyyy-MM-dd');
            m.set(key, (m.get(key) ?? 0) + 1);
        }
        return m;
    }, [summary]);
    const unassignedCountsByDay = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of summary?.unassignedEvents ?? []) {
            const key = format(new Date(e.starts_at), 'yyyy-MM-dd');
            m.set(key, (m.get(key) ?? 0) + 1);
        }
        return m;
    }, [summary]);
    const todayKey = format(today, 'yyyy-MM-dd');
    const tomorrowKey = format(tomorrow, 'yyyy-MM-dd');
    const todayConflictCount = conflictCountsByDay.get(todayKey) ?? 0;
    const todayUnassignedCount = unassignedCountsByDay.get(todayKey) ?? 0;
    const tomorrowConflictCount = conflictCountsByDay.get(tomorrowKey) ?? 0;

    // Tomorrow hand-off detection: custodian changes between today and
    // tomorrow. Powers the new TomorrowPreviewCard's "Kids move to X" row
    // per the redesign (direction-c-pro.jsx:476-501). Null when the household
    // has no custody schedule (single_parent / couple) or when the same
    // custodian stays in place — in those cases the card just shows the event
    // count line.
    const tomorrowHandoffTo = useMemo(() => {
        if (!custodySchedule) return null;
        const todayRes = resolveCustodianOnDate(custodySchedule, overrideMap, today);
        const tomRes = resolveCustodianOnDate(custodySchedule, overrideMap, tomorrow);
        if (!todayRes || !tomRes) return null;
        if (todayRes.profileId === tomRes.profileId) return null;
        return members?.find((m) => m.profile_id === tomRes.profileId) ?? null;
    }, [custodySchedule, overrideMap, today, tomorrow, members]);

    // ── Conflict ribbon copy (top-of-Home highlight) ──────────────────────
    // Surfaces the FIRST conflict on Today's card so the user has a one-tap
    // path to resolve. The full conflict resolution flow lands in Phase 12;
    // here the action buttons route to that detail view (Phase 12 stub) or
    // open the involved event for now.
    const firstTodayConflict = useMemo(() => {
        return summary?.conflicts?.find(
            (c) => format(new Date(c.event.starts_at), 'yyyy-MM-dd') === todayKey,
        );
    }, [summary, todayKey]);

    // ── Tap handlers ───────────────────────────────────────────────────────
    const onPressEvent = (id: string, occurrenceDate: Date) =>
        router.push({
            pathname: '/event/[id]',
            params: { id, date: format(occurrenceDate, 'yyyy-MM-dd') },
        });
    // Always route a task tap to /task/[id] — matches the user's mental
    // model ("tap task → edit task") and the behaviour Lists already uses
    // (lists.tsx handleTapTask). The previous branch that detoured event-
    // linked taps to the event editor pre-dated TaskDetail v2 (#369); now
    // the task editor renders the linked-event chip + handles the context
    // inline, so the detour was confusing — row says a task title, tap
    // opened an event-shaped form.
    const onPressTask = (t: Task) => {
        router.push({
            pathname: '/task/[id]',
            params: { id: t.id },
        });
    };
    // (onPressCustodyDay removed — the per-day custody-owner pill in the
    // section header is gone in the redesign. Custody is surfaced per-event
    // via the member rail, and the custody editor is reachable from the
    // per-event detail screen instead.)

    // ── Greeting copy ──────────────────────────────────────────────────────
    const myName = useMemo(() => {
        if (!user) return '';
        const me = members?.find((m) => m.profile_id === user.id);
        return me?.display_name?.split(' ')[0] ?? '';
    }, [members, user]);

    const greetingTime = useMemo(() => {
        const h = new Date().getHours();
        if (h < 5) return 'Good night';
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Tokenized so the Greeting can render numerals in monoMedium per the
    // design (direction-c-pro.jsx:376-378). Was a flat string — entire line
    // rendered in Geist sans, losing the texture between counts and copy.
    const summaryTokens = useMemo<SummaryToken[]>(() => {
        const ev = todayEvents.length;
        const tk = todayTasks.length;
        if (ev === 0 && tk === 0) return [{ text: 'Nothing scheduled for today.' }];
        const out: SummaryToken[] = [];
        if (ev > 0) {
            out.push({ text: String(ev), mono: true });
            out.push({ text: ev === 1 ? ' event' : ' events' });
        }
        if (ev > 0 && tk > 0) out.push({ text: ', ' });
        if (tk > 0) {
            out.push({ text: String(tk), mono: true });
            out.push({ text: tk === 1 ? ' task' : ' tasks' });
        }
        out.push({ text: ' today.' });
        return out;
    }, [todayEvents.length, todayTasks.length]);

    const isEmpty =
        (events ?? []).length === 0 &&
        taskBuckets.today.length === 0 &&
        taskBuckets.thisWeek.length === 0 &&
        taskBuckets.undated.length === 0;
    const showWelcome =
        welcomeDismissed === false && isEmpty;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {isLoading && !events ? (
                    <LoadingScreen />
                ) : (
                    <ScrollView contentContainerStyle={styles.scroll}>
                        <HomeHeader
                            householdName={household?.name ?? '—'}
                            peopleCount={members?.length ?? 0}
                            // Unread count = conflicts + unassigned events as
                            // a "things to look at" stand-in until the
                            // notifications model lands in Phase 10. Hidden
                            // when 0 (badge doesn't render).
                            unreadCount={
                                (summary?.conflicts?.length ?? 0) +
                                (summary?.unassignedEvents?.length ?? 0)
                            }
                            currentUser={
                                members?.find((m) => m.profile_id === user?.id) ?? null
                            }
                            onBell={() => router.push('/notifications')}
                            onProfile={() => router.push('/settings/profile')}
                            colors={colors}
                        />

                        <Greeting
                            greeting={greetingTime}
                            name={myName}
                            summary={summaryTokens}
                            colors={colors}
                        />

                        {/* AI parse bar — visual placeholder per the deferred
                            decision (#303). Pressing is a no-op; when the LLM
                            integration lands it'll wire up to a parse endpoint
                            and the suggestion preview row below the bar. */}
                        <AIParseBar
                            colors={colors}
                            onPress={() => {
                                /* Phase: AI parse integration (#303) */
                            }}
                        />

                        {/* Custody status strip (custody-surfaces v2 +
                            strip-variants #397/#398) — sits between the
                            AI bar and the conflict card per design
                            source ProHomeV2. CustodyStripSection
                            resolves the viewer's role (co-parent /
                            caregiver / external co-parent) and stacks
                            multiple strips when the viewer has multiple
                            linked kids. Renders nothing when the viewer
                            has no role to render anywhere. */}
                        <CustodyStripSection householdId={household?.id} />

                        {firstTodayConflict ? (
                            <ConflictRibbon
                                title={`Conflict at ${format(
                                    new Date(firstTodayConflict.event.starts_at),
                                    'HH:mm',
                                )}`}
                                /* Privacy gate (#469): non-responsible viewers
                                   shouldn't see the title leak through the
                                   conflict ribbon. Fall back to a generic
                                   description when the event is private. */
                                body={
                                    shouldHideEventAsPrivate(
                                        firstTodayConflict.event,
                                        user?.id,
                                    )
                                        ? `A busy block overlaps with another commitment on the responsible parent's calendar.`
                                        : `${firstTodayConflict.event.title} overlaps with a busy block on the responsible parent's calendar.`
                                }
                                onPrimary={() =>
                                    onPressEvent(
                                        firstTodayConflict.event.id,
                                        new Date(firstTodayConflict.event.starts_at),
                                    )
                                }
                                primaryLabel="Open event"
                                // Dismiss is a soft client-side hide until the
                                // notifications model lands in Phase 10 — for
                                // now it just re-renders without the ribbon
                                // for the rest of the session. Reading the
                                // event resolves the conflict permanently
                                // (when summary refetches).
                                onDismiss={() => {
                                    /* Phase 10: persist dismissal. */
                                }}
                                colors={colors}
                            />
                        ) : null}

                        {showWelcome ? (
                            <WelcomeCard
                                householdName={household?.name ?? 'your household'}
                                showInvite={(members?.length ?? 0) <= 1}
                                showAddChild={(children?.length ?? 0) === 0}
                                showSetCustody={
                                    household?.household_type === 'separated' &&
                                    !custodySchedule
                                }
                                onDismiss={dismissWelcome}
                                onRouteToSettings={() => router.push('/settings')}
                                onRouteToChildNew={() => router.push('/child/new')}
                                onRouteToCustody={() => router.push('/settings')}
                                onRouteToEventNew={() => router.push('/event/new')}
                                colors={colors}
                            />
                        ) : null}

                        <TimelineCard
                            label="Today"
                            dateLabel={format(today, 'EEE d')}
                            day={today}
                            events={todayEvents}
                            tasks={todayTasks}
                            members={members ?? []}
                            children={children ?? []}
                            allLists={allLists ?? []}
                            colorMap={colorMap}
                            custodySchedule={custodySchedule}
                            custodyOverrideMap={overrideMap}
                            occurrenceOverrideMap={occurrenceOverrideMap}
                            conflictCount={todayConflictCount}
                            unassignedCount={todayUnassignedCount}
                            eventTasksByEvent={eventTasksByEvent}
                            onPressEvent={onPressEvent}
                            onPressTask={onPressTask}
                            onToggleTask={onToggleTaskComplete}
                            colors={colors}
                            viewerId={user?.id}
                        />

                        {/* Tomorrow is a compact preview, not a full TimelineCard.
                            UX audit 1.3 — design uses a small card with one
                            hand-off row + "+ N more events" mono footer
                            (direction-c-pro.jsx:476-501). Today carries the
                            dense list; tomorrow gives the page room to breathe. */}
                        <TomorrowPreviewCard
                            dateLabel={format(tomorrow, 'EEE d')}
                            events={tomorrowEvents}
                            handoffTo={tomorrowHandoffTo}
                            colors={colors}
                            viewerId={user?.id}
                        />

                        {laterThisWeekTasks.length > 0 ? (
                            <View style={styles.sliverWrap}>
                                <SectionHeader label="Later this week" count={laterThisWeekTasks.length} />
                                <View
                                    style={[
                                        styles.sliverCard,
                                        {
                                            backgroundColor: colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {laterThisWeekTasks.map((t, i) => (
                                        <View key={t.id}>
                                            {i > 0 ? (
                                                <HairlineDivider insetLeft={Spacing.three} />
                                            ) : null}
                                            <TaskRow
                                                task={t}
                                                members={members ?? []}
                                                colorMap={colorMap}
                                                allLists={allLists ?? []}
                                                onTap={() => onPressTask(t)}
                                                onToggle={() => onToggleTaskComplete(t)}
                                                isLast={i === laterThisWeekTasks.length - 1}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : null}

                        {taskBuckets.undated.length > 0 ? (
                            <View style={styles.sliverWrap}>
                                <SectionHeader label="Anytime" count={taskBuckets.undated.length} />
                                <View
                                    style={[
                                        styles.sliverCard,
                                        {
                                            backgroundColor: colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {taskBuckets.undated.map((t, i) => (
                                        <View key={t.id}>
                                            {i > 0 ? (
                                                <HairlineDivider insetLeft={Spacing.three} />
                                            ) : null}
                                            <TaskRow
                                                task={t}
                                                members={members ?? []}
                                                colorMap={colorMap}
                                                allLists={allLists ?? []}
                                                onTap={() => onPressTask(t)}
                                                onToggle={() => onToggleTaskComplete(t)}
                                                isLast={i === taskBuckets.undated.length - 1}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : null}

                        {/* FAB clearance now lives on the ScrollView's
                            contentContainerStyle.paddingBottom (styles.scroll)
                            so it applies regardless of which conditional
                            branch above renders. Audit #330 HIGH #4. */}
                    </ScrollView>
                )}
            </SafeAreaView>

            {/* Phase 12: QuickCreateSheet replaces the legacy FabMenuItem
                stack. Bottom-sheet modal with a 2×2 kind grid + slim-row
                section; full design per screens-extra-5.jsx::QuickCreateSheet.
                FAB stays — tapping it opens the sheet, closing it returns
                to Home. Caregivers still hidden (showCreateAffordances). */}
            {showCreateAffordances ? (
                <Pressable
                    onPress={() => setAddMenuOpen(true)}
                    accessibilityLabel="Open quick-create menu"
                    style={({ pressed }) => [
                        styles.fabPill,
                        { backgroundColor: colors.accent },
                        pressed && styles.pressed,
                    ]}>
                    <Feather
                        name="plus"
                        size={18}
                        color={colors.onAccent}
                    />
                    <ThemedText
                        style={[
                            styles.fabPillLabel,
                            { color: colors.onAccent },
                        ]}>
                        New
                    </ThemedText>
                </Pressable>
            ) : null}
            <QuickCreateSheet
                open={showCreateAffordances && addMenuOpen}
                onClose={() => setAddMenuOpen(false)}
            />
        </ThemedView>
    );
}

// ─── HomeHeader ──────────────────────────────────────────────────────────────
//
// Compact info-dense top strip. Left: forest-tinted logo square (house icon)
// + household name + people-count chip in mono. Right: bell with unread
// count badge + user avatar.
//
// Bell routes to the Notifications Inbox (Phase 10). Until that screen
// exists the onBell handler is a no-op — but the badge still surfaces
// summary.conflicts.length as a "things to look at" hint.
function HomeHeader({
    householdName,
    peopleCount,
    unreadCount,
    currentUser,
    onBell,
    onProfile,
    colors,
}: {
    householdName: string;
    peopleCount: number;
    /** Unread count for the bell badge. 0 hides the badge; > 0 renders a
     *  small accent pill with the number. Per the redesign + the user's
     *  decision: count badge, not dot. */
    unreadCount: number;
    currentUser: HouseholdMember | null;
    onBell: () => void;
    /** Tap the user-avatar to open the profile editor. Matches the
     *  Family Hub pattern (avatar → /settings/profile) so the
     *  "avatar = my profile" affordance is uniform across tabs that
     *  surface the avatar. */
    onProfile: () => void;
    colors: Palette;
}) {
    return (
        <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
                <View style={[styles.logoTile, { backgroundColor: colors.accent }]}>
                    <Feather name="home" size={11} color={colors.onAccent} />
                </View>
                <ThemedText style={styles.headerName} numberOfLines={1}>
                    {householdName}
                </ThemedText>
                <View
                    style={[
                        styles.peopleChip,
                        { backgroundColor: colors.backgroundInset },
                    ]}>
                    <ThemedText
                        style={[
                            styles.peopleChipText,
                            { color: colors.textSecondary },
                        ]}>
                        {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                    </ThemedText>
                </View>
            </View>
            <View style={styles.headerRight}>
                <Pressable
                    onPress={onBell}
                    accessibilityLabel={
                        unreadCount > 0
                            ? `Open notifications, ${unreadCount} unread`
                            : 'Open notifications'
                    }
                    style={({ pressed }) => [
                        styles.bellBtn,
                        { backgroundColor: colors.backgroundElement, borderColor: colors.hair },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="bell" size={14} color={colors.text} />
                    {unreadCount > 0 ? (
                        <View
                            style={[
                                styles.bellBadge,
                                {
                                    backgroundColor: colors.accent,
                                    // 1.5px card-color border per design so
                                    // the badge reads as "pinned to" the bell
                                    // button rather than blending into it.
                                    borderColor: colors.backgroundElement,
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.bellBadgeText,
                                    { color: colors.onAccent },
                                ]}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </ThemedText>
                        </View>
                    ) : null}
                </Pressable>
                {currentUser ? (
                    <Pressable
                        // "Avatar = my profile" affordance, matches Family
                        // Hub. Tap routes to /settings/profile so the user
                        // can edit their name / color / role from any tab
                        // that shows the avatar.
                        onPress={onProfile}
                        accessibilityRole="button"
                        accessibilityLabel="Profile"
                        style={({ pressed }) => [
                            styles.headerAvatar,
                            { backgroundColor: currentUser.color ?? colors.accent },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.headerAvatarText}>
                            {(currentUser.display_name?.[0] ?? '?').toUpperCase()}
                        </ThemedText>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

// ─── Greeting ────────────────────────────────────────────────────────────────
// `summary` is tokenized so numerals can render in monoMedium per the design
// (direction-c-pro.jsx:376-378). One <Text> wraps spans of <Text> children so
// the whole line stays a single wrapping/breaking unit — RN's <Text> respects
// nested <Text> for typography but treats the leaf glyphs as siblings of the
// surrounding flow, which is exactly what we want for "4 events, 2 tasks today."
function Greeting({
    greeting,
    name,
    summary,
    colors,
}: {
    greeting: string;
    name: string;
    summary: SummaryToken[];
    colors: Palette;
}) {
    const dateLabel = format(new Date(), 'EEE · MMM d · yyyy').toUpperCase();
    return (
        <View style={styles.greetingWrap}>
            <ThemedText
                style={[
                    styles.greetingDate,
                    { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                ]}>
                {dateLabel}
            </ThemedText>
            <ThemedText
                style={[Typography.titleHero, styles.greetingHero, { color: colors.text }]}
                // numberOfLines={2} so long greetings on narrow viewports
                // wrap gracefully instead of getting truncated; the 32 SemiBold
                // hero is the loudest element on Home and deserves room.
                numberOfLines={2}>
                {name ? `${greeting}, ${name}.` : `${greeting}.`}
            </ThemedText>
            <ThemedText
                style={[Typography.body, { color: colors.inkSec, marginTop: 8 }]}
                numberOfLines={2}>
                {summary.map((tok, i) => (
                    <ThemedText
                        key={i}
                        style={
                            tok.mono
                                ? { fontFamily: FontFamily.monoMedium, color: colors.text }
                                : undefined
                        }>
                        {tok.text}
                    </ThemedText>
                ))}
            </ThemedText>
        </View>
    );
}

type SummaryToken = { text: string; mono?: boolean };

// ─── AIParseBar (placeholder) ───────────────────────────────────────────────
//
// Visual placeholder for the Cmd-K AI parse bar from the design. Real LLM
// integration is deferred (#303). For now, tapping is a no-op and the
// placeholder mono text just sits in the bar. Visible so the design language
// matches the screenshots; functionally inert.
function AIParseBar({
    colors,
    onPress,
}: {
    colors: Palette;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityLabel="AI quick-add (coming soon)"
            style={({ pressed }) => [
                styles.aiBar,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                },
                pressed && styles.pressed,
            ]}>
            <Feather name="zap" size={14} color={colors.accent} />
            <ThemedText
                style={[
                    styles.aiBarPlaceholder,
                    { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                ]}
                numberOfLines={1}>
                Quick add — type to plan
            </ThemedText>
            <View
                style={[
                    styles.aiBarKbd,
                    { backgroundColor: colors.backgroundInset },
                ]}>
                <ThemedText
                    style={[
                        styles.aiBarKbdText,
                        { color: colors.textSecondary, fontFamily: FontFamily.monoRegular },
                    ]}>
                    ⌘K
                </ThemedText>
            </View>
        </Pressable>
    );
}

// ─── ConflictRibbon ──────────────────────────────────────────────────────────
//
// Warn-tinted left-rail card surfacing a single conflict. One quick-action
// button per design — the secondary "Dismiss" path lands when the
// notifications model is built out (Phase 10).
function ConflictRibbon({
    title,
    body,
    onPrimary,
    onDismiss,
    primaryLabel,
    colors,
}: {
    title: string;
    body: string;
    onPrimary: () => void;
    /** Dismiss handler — design pairs the primary CTA with a secondary
     *  "Dismiss" outline button so users have a one-tap way to remove
     *  the ribbon without taking action. Pass undefined to render only
     *  the primary. */
    onDismiss?: () => void;
    primaryLabel: string;
    colors: Palette;
}) {
    return (
        <View
            style={[
                styles.conflictCard,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                    borderLeftColor: colors.warn,
                },
            ]}>
            <View style={styles.conflictIconWrap}>
                <Feather name="alert-triangle" size={14} color={colors.warn} />
            </View>
            <View style={styles.conflictBody}>
                <ThemedText style={[styles.conflictTitle, { color: colors.text }]}>
                    {title}
                </ThemedText>
                <ThemedText
                    style={[
                        Typography.bodySm,
                        { color: colors.inkSec, marginTop: 2 },
                    ]}>
                    {body}
                </ThemedText>
                <View style={styles.conflictActions}>
                    <Pressable
                        onPress={onPrimary}
                        style={({ pressed }) => [
                            styles.conflictBtnPrimary,
                            { backgroundColor: colors.accent },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.conflictBtnText,
                                { color: colors.onAccent },
                            ]}>
                            {primaryLabel}
                        </ThemedText>
                    </Pressable>
                    {onDismiss ? (
                        <Pressable
                            onPress={onDismiss}
                            accessibilityLabel="Dismiss conflict notice"
                            style={({ pressed }) => [
                                styles.conflictBtnSecondary,
                                { borderColor: colors.hair },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.conflictBtnText,
                                    { color: colors.text },
                                ]}>
                                Dismiss
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

// ─── TomorrowPreviewCard ─────────────────────────────────────────────────────
//
// Compact preview for tomorrow, replacing the previous full TimelineCard
// (UX audit 1.3). Design renders ONE primary row + a mono "+ N more events"
// footer so today's card can breathe (direction-c-pro.jsx:476-501).
//
// The "primary row" is the most-actionable item for tomorrow:
//   • Hand-off day → the hand-off itself ("Kids move to Casey")
//   • No hand-off, events present → the first event (time + title)
//   • No hand-off, no events → "Quiet day." empty state
//
// The footer ("+ N more events") only renders when there ARE more events
// beyond the primary row — so on a no-handoff day with exactly 1 event the
// row + footer don't repeat each other (was the audit's PARTIAL finding).
//
// The hand-off row is intentionally simple — the design's "17:00 pickup"
// time isn't tracked in our schema (custody flips at midnight by default).
// Phase 11's dedicated hand-off detail screen can layer that in later.
function TomorrowPreviewCard({
    dateLabel,
    events,
    handoffTo,
    colors,
    viewerId,
}: {
    dateLabel: string;
    events: Event[];
    handoffTo: HouseholdMember | null;
    colors: Palette;
    /** Current user id — used by the privacy gate (#469) to swap a
     *  private event's title for "Busy" when the viewer isn't tagged on
     *  the event. Null when auth hasn't resolved; the gate defaults to
     *  hiding in that case. */
    viewerId: string | null | undefined;
}) {
    const eventCount = events.length;
    const firstEvent = events[0] ?? null;

    // "more events" count = events not represented by the primary row. When
    // hand-off is the primary row, ALL events are "more". When the first
    // event IS the primary row, only events[1..N] count.
    const moreCount = handoffTo ? eventCount : Math.max(0, eventCount - 1);

    const rightSlot = (
        <ThemedText
            style={[
                styles.timelineCountText,
                { color: colors.textSecondary, fontFamily: FontFamily.monoRegular },
            ]}>
            {eventCount} {eventCount === 1 ? 'event' : 'events'}
            {handoffTo ? ' · handoff' : ''}
        </ThemedText>
    );

    const isQuiet = !handoffTo && eventCount === 0;

    return (
        <View style={styles.timelineWrap}>
            <SectionHeader label={`Tomorrow · ${dateLabel}`} rightSlot={rightSlot} />
            <View
                style={[
                    styles.timelineCard,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {isQuiet ? (
                    <View style={styles.timelineEmpty}>
                        <ThemedText
                            style={[Typography.bodySm, { color: colors.textSecondary }]}>
                            Quiet day.
                        </ThemedText>
                    </View>
                ) : (
                    <View style={styles.tomorrowBody}>
                        {handoffTo ? (
                            <View style={styles.tomorrowHandoffRow}>
                                <Feather
                                    name="repeat"
                                    size={14}
                                    color={colors.textSecondary}
                                />
                                <ThemedText
                                    style={[
                                        Typography.bodySm,
                                        { color: colors.text, flex: 1 },
                                    ]}>
                                    Kids move to{' '}
                                    <ThemedText
                                        style={{ fontWeight: '600', color: colors.text }}>
                                        {handoffTo.display_name}
                                    </ThemedText>
                                </ThemedText>
                            </View>
                        ) : firstEvent ? (
                            <View style={styles.tomorrowHandoffRow}>
                                <ThemedText
                                    style={[
                                        Typography.bodySm,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoRegular,
                                            minWidth: 48,
                                        },
                                    ]}>
                                    {firstEvent.all_day
                                        ? 'all day'
                                        : format(new Date(firstEvent.starts_at), 'HH:mm')}
                                </ThemedText>
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        Typography.bodySm,
                                        { color: colors.text, flex: 1, fontWeight: '500' },
                                    ]}>
                                    {/* Privacy gate (#469) */}
                                    {shouldHideEventAsPrivate(
                                        firstEvent,
                                        viewerId,
                                    )
                                        ? PRIVATE_EVENT_BUSY_LABEL
                                        : firstEvent.title}
                                </ThemedText>
                            </View>
                        ) : null}
                        {(handoffTo || firstEvent) && moreCount > 0 ? (
                            <HairlineDivider />
                        ) : null}
                        {moreCount > 0 ? (
                            <ThemedText
                                style={[
                                    styles.tomorrowMoreLine,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoRegular,
                                    },
                                ]}>
                                + {moreCount} more{' '}
                                {moreCount === 1 ? 'event' : 'events'}
                            </ThemedText>
                        ) : null}
                    </View>
                )}
            </View>
        </View>
    );
}

// ─── TimelineCard ────────────────────────────────────────────────────────────
//
// Today / Tomorrow surface. SectionHeader label ("TODAY · TUE 26") above a
// white card containing event rows with mono time, color rail, title, child
// dot, location, conflict warning. Tasks render at the bottom of the same
// card (when they have a due_at on this day) — tap to navigate, checkbox
// to mark complete.
function TimelineCard({
    label,
    dateLabel,
    day,
    events,
    tasks,
    members,
    children,
    allLists,
    colorMap,
    custodySchedule,
    custodyOverrideMap,
    occurrenceOverrideMap,
    conflictCount,
    unassignedCount,
    eventTasksByEvent,
    onPressEvent,
    onPressTask,
    onToggleTask,
    colors,
    viewerId,
}: {
    label: string;
    dateLabel: string;
    day: Date;
    events: Event[];
    tasks: Task[];
    members: HouseholdMember[];
    children: Child[];
    /** Household lists threaded down so the shared TaskRow's meta strip
     *  can render cross-list color-dot pills. */
    allLists: TaskList[];
    /** profile_id → identity color, built once at the parent screen so
     *  every card shares the same map. */
    colorMap: Map<string, string>;
    custodySchedule: Parameters<typeof resolveCustodianOnDate>[0] | null;
    custodyOverrideMap: ReturnType<typeof buildOverrideMap>;
    occurrenceOverrideMap: Map<string, EventOccurrenceOverride>;
    conflictCount: number;
    unassignedCount: number;
    /** All tasks (open + completed) attached to events in this card, grouped
     *  by event_id. Drives both the per-row done/total counter and the
     *  inline expanded task list. */
    eventTasksByEvent: Map<string, Task[]>;
    onPressEvent: (id: string, occurrenceDate: Date) => void;
    onPressTask: (task: Task) => void;
    onToggleTask: (task: Task) => void;
    colors: Palette;
    /** Current user id — threaded into EventRow's privacy gate (#469).
     *  Optional null/undefined so the card stays renderable while auth
     *  is resolving; the gate defaults to "hide" for missing viewers,
     *  which is the safe default for private events. */
    viewerId: string | null | undefined;
}) {

    const isEmpty = events.length === 0 && tasks.length === 0;

    // Track which events are showing their inline task list. Tapping the
    // task-count badge toggles its event's id in this set. State lives on
    // the card (not the page) so collapsing one event when expanding another
    // could be added later by switching from Set→string; for now the user
    // can have multiple events expanded at once, which matches the design's
    // multi-row affordance.
    const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
        () => new Set(),
    );
    const toggleExpanded = useCallback((eventId: string) => {
        setExpandedEventIds((prev) => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    }, []);

    // Right-slot meta: replaces the previous custody-owner pill. The redesign
    // surfaces who's on duty via the per-event member rail / avatar instead;
    // the section header shows a quick density readout. Mono numerals so the
    // counts read as data, not body copy.
    const countSummary = `${events.length} ${events.length === 1 ? 'event' : 'events'} · ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;

    const rightSlot = (
        <View style={styles.timelineMeta}>
            <ThemedText
                style={[
                    styles.timelineCountText,
                    { color: colors.textSecondary, fontFamily: FontFamily.monoRegular },
                ]}>
                {countSummary}
            </ThemedText>
            {conflictCount > 0 ? (
                <View
                    style={[
                        styles.badge,
                        {
                            borderColor: colors.warn,
                            backgroundColor: withAlpha(colors.warn, 0.13),
                        },
                    ]}>
                    <Feather name="alert-triangle" size={10} color={colors.warn} />
                    <ThemedText
                        style={[
                            styles.badgeText,
                            { color: colors.warn, fontFamily: FontFamily.monoSemiBold },
                        ]}>
                        {conflictCount}
                    </ThemedText>
                </View>
            ) : null}
            {unassignedCount > 0 ? (
                <View
                    style={[
                        styles.badge,
                        {
                            borderColor: colors.accent,
                            backgroundColor: withAlpha(colors.accent, 0.13),
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.badgeText,
                            { color: colors.accent, fontFamily: FontFamily.monoSemiBold },
                        ]}>
                        {unassignedCount} open
                    </ThemedText>
                </View>
            ) : null}
        </View>
    );

    return (
        <View style={styles.timelineWrap}>
            <SectionHeader
                label={`${label} · ${dateLabel}`}
                rightSlot={rightSlot}
            />
            <View
                style={[
                    styles.timelineCard,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {isEmpty ? (
                    <View style={styles.timelineEmpty}>
                        <ThemedText
                            style={[
                                Typography.bodySm,
                                { color: colors.textSecondary },
                            ]}>
                            Quiet day.
                        </ThemedText>
                    </View>
                ) : null}
                {events.map((event, i) => {
                    const resolvedResponsible = resolveResponsibleProfileId({
                        event,
                        occurrenceDate: day,
                        custodySchedule,
                        custodyOverrides: custodyOverrideMap,
                        occurrenceOverrides: occurrenceOverrideMap,
                    });
                    const responsibleMember = members.find(
                        (m) => m.profile_id === resolvedResponsible,
                    );
                    const responsibleColor = colorForResponsible(
                        resolvedResponsible,
                        colorMap,
                    );
                    // Multi-responsible stack — when ≥2 adults are tagged on
                    // the event, EventRow renders a MemberStack of all of
                    // them instead of the single resolved-responsible avatar.
                    // Matches the design's CStack(members=who, size=20) usage
                    // in direction-c-pro.jsx for multi-responsible rows.
                    // Sort lead first so the LEAD avatar reads as the
                    // dominant identity in the cluster.
                    const responsibleStack = (event.responsibles ?? [])
                        .slice()
                        .sort((a, b) => {
                            if (a.is_lead && !b.is_lead) return -1;
                            if (!a.is_lead && b.is_lead) return 1;
                            return (a.created_at ?? '').localeCompare(
                                b.created_at ?? '',
                            );
                        })
                        .map((r) => {
                            const m = members.find(
                                (mm) => mm.profile_id === r.profile_id,
                            );
                            if (!m) return null;
                            return {
                                key: m.profile_id,
                                // First name across all chips per design convention.
                                name: firstNameOf(m.display_name),
                                color:
                                    m.color ??
                                    colorForResponsible(
                                        m.profile_id,
                                        colorMap,
                                    ),
                            };
                        })
                        .filter((x): x is NonNullable<typeof x> => x !== null);
                    const childChips = (event.child_ids ?? [])
                        .map((id) => children.find((c) => c.id === id))
                        .filter((c): c is Child => !!c);
                    const eventTasks = eventTasksByEvent.get(event.id) ?? [];
                    const isExpanded = expandedEventIds.has(event.id);
                    return (
                        <View key={`${event.id}-${event.starts_at}`}>
                            {i > 0 ? <HairlineDivider insetLeft={Spacing.three} /> : null}
                            <EventRow
                                event={event}
                                responsibleMember={responsibleMember ?? null}
                                responsibleColor={responsibleColor}
                                responsibleStack={responsibleStack}
                                children={childChips}
                                eventTasks={eventTasks}
                                isExpanded={isExpanded}
                                members={members}
                                onToggleExpanded={() => toggleExpanded(event.id)}
                                onToggleTask={onToggleTask}
                                onPress={() => onPressEvent(event.id, day)}
                                colors={colors}
                                viewerId={viewerId}
                            />
                        </View>
                    );
                })}
                {tasks.length > 0 && events.length > 0 ? (
                    <HairlineDivider insetLeft={Spacing.three} />
                ) : null}
                {tasks.map((t, i) => (
                    <View key={t.id}>
                        {i > 0 ? <HairlineDivider insetLeft={Spacing.three} /> : null}
                        <TaskRow
                            task={t}
                            members={members}
                            colorMap={colorMap}
                            allLists={allLists}
                            onTap={() => onPressTask(t)}
                            onToggle={() => onToggleTask(t)}
                            isLast={i === tasks.length - 1}
                        />
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── EventRow ────────────────────────────────────────────────────────────────
//
// Single event in a TimelineCard. Layout left→right:
//   • Mono time column (start + duration, 50px wide)
//   • 2px color rail (assignee color, full-bleed top to bottom)
//   • Title + meta (child dot + location)
//   • Assignee avatar stack (right-aligned)
//
// Tap → /event/[id]. Conflict events get a warn-toned rail + a small warn
// chip in the meta row.
function EventRow({
    event,
    responsibleMember,
    responsibleColor,
    responsibleStack,
    children,
    eventTasks,
    isExpanded,
    members,
    onToggleExpanded,
    onToggleTask,
    onPress,
    colors,
    viewerId,
}: {
    event: Event;
    responsibleMember: HouseholdMember | null;
    responsibleColor: string;
    /** Multi-responsible stack — every adult tagged on this event, lead
     *  first. When `length >= 2` the EventRow renders all of them via
     *  MemberStack; for single-responsible events the stack mirrors
     *  [responsibleMember] so callers can rely on a uniform shape. */
    responsibleStack: { key: string; name: string; color: string }[];
    children: Child[];
    /** All tasks (open + completed) attached to this event. Drives the
     *  done/total counter and the inline expanded list. Empty → no badge. */
    eventTasks: Task[];
    /** Is the inline task list visible right now? Tapping the badge toggles. */
    isExpanded: boolean;
    /** Household members — used by ExpandedTaskRow to resolve each task's
     *  first assignee into an initial-circle avatar. */
    members: HouseholdMember[];
    /** Toggle the inline task list open/closed. */
    onToggleExpanded: () => void;
    /** Flip a task between done and open. Called from the inline checkbox. */
    onToggleTask: (task: Task) => void;
    onPress: () => void;
    colors: Palette;
    /** Current user id — privacy gate (#469). When the event is private
     *  and the viewer isn't a responsible, the row renders as "Busy"
     *  and the meta row (children + location) is suppressed. */
    viewerId: string | null | undefined;
}) {
    // Privacy gate (#469). Hoisted to the top of the render so the
    // title, a11y label, and meta-row branches all read the same value.
    // When `hidePrivate` is true the row shows "Busy" and we suppress
    // the meta row (children + location) which would otherwise leak
    // event details by side channel.
    const hidePrivate = shouldHideEventAsPrivate(event, viewerId);
    const displayTitle = hidePrivate ? PRIVATE_EVENT_BUSY_LABEL : event.title;
    const startDate = new Date(event.starts_at);
    const endDate = new Date(event.ends_at);
    const allDay = event.all_day;
    const startStr = allDay ? 'All day' : format(startDate, 'HH:mm');
    const durMs = endDate.getTime() - startDate.getTime();
    const durMin = Math.round(durMs / 60000);
    const durStr = (() => {
        if (allDay) return '';
        if (durMin < 60) return `${durMin}m`;
        const h = Math.floor(durMin / 60);
        const m = durMin % 60;
        return m === 0 ? `${h}h` : `${h}h${m}m`;
    })();
    // Past = the event has already ended. The whole row dims to 0.55 opacity
    // so future events read first; this matches the design's `past` prop
    // (`opacity: 0.55` on the row, not strike-through). All-day past events
    // also dim — once the day rolls over they're behind us regardless.
    const isPast = endDate.getTime() < Date.now();
    // accessibilityRole intentionally OMITTED here (vs the typical `"button"`)
    // because the row contains a nested tappable — the task-count badge,
    // which IS a Pressable with `accessibilityRole="button"`. On web both
    // would render as `<button>` and HTML forbids nesting them
    // ("<button> cannot contain a nested <button>"). Dropping the role on
    // the OUTER pressable makes RN-Web render it as a `<div>` with a click
    // handler, which can legally contain a child <button>. The badge keeps
    // explicit button semantics (it's the secondary action that benefits
    // most from screen-reader clarity); the row still announces its
    // `accessibilityLabel` and remains keyboard-focusable + tappable on
    // both platforms. Native is unaffected — Pressable doesn't use the
    // HTML element distinction there.
    const rowContent = (
        <Pressable
            onPress={onPress}
            accessibilityLabel={`Event: ${displayTitle}`}
            style={({ pressed }) => [
                styles.eventRow,
                isPast && styles.eventRowPast,
                pressed && styles.pressed,
            ]}>
            <View style={styles.eventTimeCol}>
                <ThemedText
                    style={[
                        styles.eventTimeStart,
                        // Mono Medium (500) per the design's CEventRow
                        // (`fontWeight: 500` in direction-c-pro.jsx). SemiBold
                        // was too heavy against the muted-mono duration line
                        // below — the design intends a balanced two-line
                        // mono block, not a bold/regular contrast.
                        { color: colors.text, fontFamily: FontFamily.monoMedium },
                    ]}>
                    {startStr}
                </ThemedText>
                {durStr ? (
                    <ThemedText
                        style={[
                            styles.eventTimeDur,
                            { color: colors.textSecondary, fontFamily: FontFamily.monoRegular },
                        ]}>
                        {durStr}
                    </ThemedText>
                ) : null}
            </View>
            <View
                style={[
                    styles.eventRail,
                    { backgroundColor: responsibleColor },
                ]}
            />
            <View style={styles.eventBody}>
                {/* Event-type icon removed. The plan is to drop event-type from
                    the create flow entirely (icon was a derived ornament tied
                    to that field); ripping its visual now keeps both surfaces
                    consistent. Title carries the meaning; type lives in the
                    detail screen if we keep the field at all. */}
                <ThemedText
                    style={[
                        Typography.body,
                        { color: colors.text, lineHeight: 18 },
                    ]}
                    numberOfLines={1}>
                    {displayTitle}
                </ThemedText>
                {/* Meta row (children + location) is suppressed when the
                    event is private — leaking even the tagged kids would
                    defeat the gate. */}
                {!hidePrivate && (children.length > 0 || event.location) ? (
                    <View style={styles.eventMetaRow}>
                        {children.map((c) => (
                            <View key={c.id} style={styles.eventChildChip}>
                                <View
                                    style={[
                                        styles.eventChildDot,
                                        { backgroundColor: c.color ?? colors.inkFaint },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.eventChildText,
                                        { color: colors.textSecondary },
                                    ]}
                                    numberOfLines={1}>
                                    {c.display_name}
                                </ThemedText>
                            </View>
                        ))}
                        {event.location ? (
                            <ThemedText
                                style={[
                                    styles.eventLocText,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}
                                numberOfLines={1}>
                                · {event.location}
                            </ThemedText>
                        ) : null}
                    </View>
                ) : null}
            </View>
            {/* Task-count badge — `done/total` numeral with a checkbox glyph.
                Tappable: toggles the inline expanded task list below. The
                badge state mirrors the design's two variants:
                  • collapsed → outlined, ink-secondary text
                  • expanded  → accent-tinted background, accent text
                Stops event propagation so tapping the badge doesn't ALSO
                fire the row's onPress (which navigates to event detail).
                Render only when the event has ANY tasks (open or done) so
                a fully-cleaned event still gets the satisfaction of seeing
                its full done/total stay visible. */}
            {eventTasks.length > 0 ? (
                <Pressable
                    onPress={(e) => {
                        // Web: stop the synthetic click from bubbling to the
                        // outer row Pressable. Native: stopPropagation isn't
                        // a no-op but the inner Pressable absorbs the touch
                        // before the outer does anyway.
                        if (typeof (e as { stopPropagation?: () => void })?.stopPropagation === 'function') {
                            (e as { stopPropagation: () => void }).stopPropagation();
                        }
                        onToggleExpanded();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                        isExpanded ? 'Hide tasks' : 'Show tasks'
                    }
                    accessibilityState={{ expanded: isExpanded }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={({ pressed }) => [
                        styles.taskBadgePill,
                        isExpanded
                            ? {
                                  borderColor: withAlpha(colors.accent, 0.33),
                                  backgroundColor: withAlpha(colors.accent, 0.13),
                              }
                            : {
                                  borderColor: colors.hair,
                                  backgroundColor: colors.backgroundElement,
                              },
                        pressed && styles.pressed,
                    ]}>
                    <Feather
                        name="check-square"
                        size={10}
                        color={isExpanded ? colors.accent : colors.textSecondary}
                    />
                    <ThemedText
                        style={[
                            styles.taskBadgeText,
                            {
                                color: isExpanded
                                    ? colors.accent
                                    : colors.textSecondary,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        {eventTasks.filter((t) => !!t.completed_at).length}/
                        {eventTasks.length}
                    </ThemedText>
                </Pressable>
            ) : null}
            {responsibleStack.length > 1 ? (
                // Multi-responsible — stack of up to 3 avatars with +N
                // overflow chip per the design's CStack pattern
                // (direction-c-pro.jsx multi-responsible rows). Lead first.
                <MemberStack
                    members={responsibleStack}
                    size="sm"
                    max={3}
                />
            ) : responsibleMember ? (
                <MemberStack
                    members={[
                        {
                            name: firstNameOf(responsibleMember.display_name),
                            color: responsibleColor,
                            key: responsibleMember.profile_id,
                        },
                    ]}
                    size="sm"
                />
            ) : null}
        </Pressable>
    );
    return (
        <>
            {rowContent}
            {/* Inline expanded task list. Renders below the row inside the
                same card so it visually "belongs" to the event above. The
                leading rail in the responsible-color picks up the same
                identity signal the row's compact rail carries — when the
                list is open, the rail extends down through the tasks
                anchoring them to the parent event. */}
            {isExpanded ? (
                <View
                    style={[
                        styles.eventTasksExpand,
                        {
                            backgroundColor: withAlpha(colors.accent, 0.04),
                            borderTopColor: colors.hair,
                        },
                    ]}>
                    <View
                        style={[
                            styles.eventTasksRail,
                            { backgroundColor: responsibleColor, opacity: 0.5 },
                        ]}
                    />
                    {eventTasks.map((t, idx) => {
                        const isDone = !!t.completed_at;
                        return (
                            <ExpandedTaskRow
                                key={t.id}
                                task={t}
                                isDone={isDone}
                                showDivider={idx > 0}
                                members={members}
                                onToggle={() => onToggleTask(t)}
                                colors={colors}
                            />
                        );
                    })}
                </View>
            ) : null}
        </>
    );
}

// One inline task row rendered under an expanded event. Layout L→R per
// the design:
//   • 14px checkbox (filled accent + check when done)
//   • title (strike-through + ink-faint when done)
//   • optional due-date mono text
//   • 16px initial-circle avatar in the first assignee's color (if any)
// Kept compact (~28-30px tall) so a fully-expanded event with 5 tasks
// doesn't dominate the timeline card.
function ExpandedTaskRow({
    task,
    isDone,
    showDivider,
    members,
    onToggle,
    colors,
}: {
    task: Task;
    isDone: boolean;
    showDivider: boolean;
    /** Household members — used to resolve the first assignee's display
     *  name (for the initial) and color (for the avatar background). */
    members: HouseholdMember[];
    onToggle: () => void;
    colors: Palette;
}) {
    const dueLabel = task.due_at
        ? format(new Date(task.due_at), 'HH:mm')
        : null;
    // Match the design: ONE avatar per task (CAvatar size 16). If the task
    // has multiple assignees we still show only the first — the task detail
    // is where the full list lives. Falls back to no avatar when the task
    // is unassigned (e.g. "anyone" in the household can take it).
    const firstAssigneeId = task.assignee_profile_ids[0];
    const firstAssignee = firstAssigneeId
        ? members.find((m) => m.profile_id === firstAssigneeId) ?? null
        : null;
    const avatarInitial = firstAssignee
        ? (firstAssignee.display_name?.charAt(0) ?? '·').toUpperCase()
        : null;
    return (
        <View
            style={[
                styles.expandedTaskRow,
                showDivider && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.hair,
                },
            ]}>
            <Pressable
                onPress={onToggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={
                    isDone ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [
                    styles.expandedTaskCheckbox,
                    isDone
                        ? {
                              backgroundColor: colors.accent,
                              borderColor: colors.accent,
                          }
                        : { borderColor: colors.inkFaint },
                    pressed && styles.pressed,
                ]}>
                {isDone ? (
                    <Feather name="check" size={9} color={colors.onAccent} />
                ) : null}
            </Pressable>
            <ThemedText
                style={[
                    styles.expandedTaskTitle,
                    {
                        color: isDone ? colors.inkFaint : colors.text,
                        textDecorationLine: isDone ? 'line-through' : 'none',
                    },
                ]}
                numberOfLines={1}>
                {task.title}
            </ThemedText>
            {dueLabel ? (
                <ThemedText
                    style={[
                        styles.expandedTaskDue,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoRegular,
                        },
                    ]}>
                    {dueLabel}
                </ThemedText>
            ) : null}
            {firstAssignee ? (
                <View
                    style={[
                        styles.expandedTaskAvatar,
                        {
                            backgroundColor:
                                firstAssignee.color ?? colors.inkFaint,
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.expandedTaskAvatarText,
                            { color: colors.onAccent },
                        ]}>
                        {avatarInitial}
                    </ThemedText>
                </View>
            ) : null}
        </View>
    );
}


// ─── FabMenuItem ─────────────────────────────────────────────────────────────
function FabMenuItem({
    icon,
    label,
    onPress,
    colors,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityLabel={label}
            style={({ pressed }) => [
                styles.fabMenuItem,
                pressed && styles.pressed,
            ]}>
            <Feather name={icon} size={16} color={colors.text} />
            <ThemedText
                style={[Typography.rowLabel, { color: colors.text }]}>
                {label}
            </ThemedText>
        </Pressable>
    );
}

// ─── WelcomeCard (first-run guide) ──────────────────────────────────────────
// UX-019 carried over. Phase 14 (#301) replaces this with the full
// FirstRunHome design; the version below is the minimal port using the
// new palette + Typography so empty-state users see something coherent
// until that ships.
function WelcomeCard({
    householdName,
    showInvite,
    showAddChild,
    showSetCustody,
    onDismiss,
    onRouteToSettings,
    onRouteToChildNew,
    onRouteToCustody,
    onRouteToEventNew,
    colors,
}: {
    householdName: string;
    showInvite: boolean;
    showAddChild: boolean;
    showSetCustody: boolean;
    onDismiss: () => void;
    onRouteToSettings: () => void;
    onRouteToChildNew: () => void;
    onRouteToCustody: () => void;
    onRouteToEventNew: () => void;
    colors: Palette;
}) {
    type Action = { label: string; onPress: () => void };
    const actions: Action[] = [];
    if (showInvite) actions.push({ label: '+ Invite partner', onPress: onRouteToSettings });
    if (showAddChild) actions.push({ label: '+ Add a child', onPress: onRouteToChildNew });
    if (showSetCustody) actions.push({ label: '+ Set up custody', onPress: onRouteToCustody });
    actions.push({ label: '+ New event', onPress: onRouteToEventNew });
    return (
        <View
            style={[
                styles.welcomeCard,
                { backgroundColor: colors.backgroundElement, borderColor: colors.hair },
            ]}>
            <View style={styles.welcomeHeaderRow}>
                <ThemedText
                    style={[Typography.rowLabel, { color: colors.text, flex: 1 }]}>
                    Welcome to {householdName}
                </ThemedText>
                <Pressable
                    onPress={onDismiss}
                    accessibilityLabel="Dismiss welcome card"
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <Feather name="x" size={16} color={colors.textSecondary} />
                </Pressable>
            </View>
            <ThemedText
                style={[Typography.bodySm, { color: colors.inkSec, marginTop: 6 }]}>
                A few setup steps to get going.
            </ThemedText>
            <View style={styles.welcomeActions}>
                {actions.map((a) => (
                    <Pressable
                        key={a.label}
                        onPress={a.onPress}
                        style={({ pressed }) => [
                            styles.welcomeChip,
                            { borderColor: colors.hair },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.welcomeChipText,
                                { color: colors.text },
                            ]}>
                            {a.label}
                        </ThemedText>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    // paddingBottom reserves clearance for the floating FAB pill (44px
    // height + 16px bottom gap + 20px breathing room). Lifted out of the
    // inline spacer below the task-list branches so empty + welcome
    // states share the same scroll-end safety (audit #330 HIGH #4).
    scroll: { paddingBottom: 80 },

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 6,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 1,
    },
    logoTile: {
        width: 20,
        height: 20,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerName: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 14,
        letterSpacing: -0.3,
    },
    peopleChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    peopleChipText: {
        fontFamily: FontFamily.monoRegular,
        fontSize: 10,
        letterSpacing: -0.2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bellBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        // position:relative so the unread badge can absolute-anchor to the
        // top-right of the button.
        position: 'relative',
    },
    // Unread count badge — small forest-accent pill pinned to the top-right
    // of the bell button. Wide enough for "9+" via minWidth; uses mono so
    // the numeral aligns crisply.
    bellBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellBadgeText: {
        fontFamily: FontFamily.monoSemiBold,
        fontSize: 9,
        lineHeight: 10,
        letterSpacing: -0.2,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
    },

    // Greeting
    greetingWrap: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
    },
    greetingDate: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    greetingHero: {
        marginTop: 2,
        // 32px font at lineHeight 1.1 → 35.2px (rounded to 36). Matches the
        // design exactly. Earlier 34px was too tight and clipped tall glyphs.
        lineHeight: 36,
    },

    // AI bar
    aiBar: {
        marginHorizontal: 16,
        marginBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 13,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    aiBarPlaceholder: {
        flex: 1,
        fontSize: 12.5,
        letterSpacing: -0.2,
    },
    aiBarKbd: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 3,
    },
    aiBarKbdText: {
        fontSize: 9.5,
    },

    // Conflict ribbon
    conflictCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
    },
    conflictIconWrap: {
        paddingTop: 2,
    },
    conflictBody: {
        flex: 1,
    },
    conflictTitle: {
        ...Typography.body,
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
    },
    conflictActions: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
    },
    conflictBtnPrimary: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    // Secondary "Dismiss" — same geometry as primary but outline-only so
    // primary action stays loudest. Matches design's CButton(non-primary)
    // pattern: 0.5px hair border, no fill, ink text.
    conflictBtnSecondary: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    conflictBtnText: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 11,
        letterSpacing: -0.1,
    },

    // Timeline card
    timelineWrap: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    timelineMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    // Mono numerals readout in the section header — "4 events · 2 tasks".
    // Replaces the per-day custody-owner pill (which was dropped in the
    // redesign — custody is surfaced per-event via the member rail / avatar
    // instead of being summarized at the section level).
    timelineCountText: {
        fontSize: 10.5,
        letterSpacing: -0.2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
    },
    badgeText: {
        fontSize: 10,
        letterSpacing: -0.2,
    },
    timelineCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    timelineEmpty: {
        padding: 14,
        alignItems: 'flex-start',
    },

    // TomorrowPreviewCard — slimmer paddings than the full TimelineCard.
    // Design (direction-c-pro.jsx:484-499) uses 10px vertical / 14px horizontal
    // with a centered single-row layout. Two children (hand-off + count line)
    // separated by a hairline.
    tomorrowBody: {
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    tomorrowHandoffRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    tomorrowMoreLine: {
        fontSize: 12,
        paddingVertical: 8,
    },

    // Event row
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    // Past events dim to 0.55 opacity per the redesign — keeps them in place
    // for chronological context (you can still tap them, recurrence makes
    // them meaningful as history) but pushes them visually behind future
    // events. The whole row dims, including the time column, child chips,
    // task badge, and assignee avatar — uniform dim reads cleaner than per-
    // element opacity tuning.
    eventRowPast: {
        opacity: 0.55,
    },
    // Task-count badge — outlined pill with a check-square glyph + mono
    // count. Sits between eventBody and the assignee avatar, so the
    // hierarchy reads: time → title/meta → tasks → who. Matches the design's
    // collapsed task-badge state (outlined, not filled).
    taskBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        flexShrink: 0,
    },
    taskBadgeText: {
        fontSize: 10,
        letterSpacing: -0.2,
    },

    // Inline expanded task list under an event row. Sits inside the same
    // bordered card as the event so it reads as a child of that event.
    // The accent-tinted bg is very light (4% alpha) — enough to set it apart
    // from the white card but not enough to compete with the event row
    // above. The leading rail is absolutely positioned and inherits the
    // parent event's responsible color (set inline).
    //
    // Padding matches the design exactly: paddingLeft 74 (so the checkbox
    // starts at x=74) with the rail at x=62-64 leaves a 10px gap between
    // the rail's right edge and the checkbox. The rail sits at the time-
    // column's right edge (50 + 14 padding + ~-2 nudge = 62), NOT under
    // the row's rail at x=76 — design choice that visually anchors the
    // task block to the time data rather than the title rail.
    eventTasksExpand: {
        position: 'relative',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 4,
        paddingBottom: 10,
        paddingLeft: 74,
        paddingRight: 14,
    },
    eventTasksRail: {
        position: 'absolute',
        left: 62,
        top: 0,
        bottom: 0,
        width: 2,
        borderRadius: 1,
    },
    expandedTaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 6,
    },
    // Small square checkbox — smaller than the TaskRow checkbox (18px)
    // because the inline rows are denser. 14px keeps the touch target
    // reasonable when combined with hitSlop.
    expandedTaskCheckbox: {
        width: 14,
        height: 14,
        borderRadius: 3,
        borderWidth: 1.2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    expandedTaskTitle: {
        flex: 1,
        fontSize: 12,
        letterSpacing: -0.15,
        lineHeight: 16,
    },
    expandedTaskDue: {
        fontSize: 9.5,
        letterSpacing: -0.2,
        flexShrink: 0,
    },
    // 16px initial-circle avatar for the task's first assignee. Background
    // is the assignee's member color, with their first initial in onAccent
    // (white) text. Matches the design's `<CAvatar size={16}>`.
    expandedTaskAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    expandedTaskAvatarText: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    eventTimeCol: {
        width: 50,
        flexShrink: 0,
    },
    eventTimeStart: {
        fontSize: 12,
        letterSpacing: -0.3,
    },
    eventTimeDur: {
        fontSize: 9.5,
        letterSpacing: -0.2,
        marginTop: 1,
    },
    eventRail: {
        width: 2,
        alignSelf: 'stretch',
        borderRadius: 1,
    },
    eventBody: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    eventMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    eventChildChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    eventChildDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    eventChildText: {
        ...Typography.bodySm,
        fontSize: 11,
    },
    eventLocText: {
        fontSize: 10.5,
        letterSpacing: -0.2,
    },

    // Task row
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    taskCheckbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskBody: {
        flex: 1,
        gap: 2,
    },
    taskMeta: {
        fontSize: 11,
        letterSpacing: -0.2,
    },

    // Sliver cards (later this week / anytime)
    sliverWrap: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    sliverCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // Welcome card (UX-019, kept for empty-state)
    welcomeCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    welcomeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    welcomeActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    welcomeChip: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    welcomeChipText: {
        ...Typography.rowLabel,
        fontSize: 12.5,
    },

    // FAB pill + quick-create chooser.
    //
    // bottom: 16 — measured ABOVE the tab bar (the ThemedView the FAB
    // anchors against ends where the tab bar begins). Tab bar at 402×874
    // renders ~97px native (28px bottom-pad + home-indicator inset) /
    // ~63px web. The 16px gap is consistent across both — audit #330
    // LOW #1 corrected the prior 80-nominal comment.
    fabPill: {
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
    fabPillLabel: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
        letterSpacing: -0.2,
    },
    fabBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Slight dim — the design uses a dim layer when the quick-create sheet
        // is open. Full sheet treatment lands in Phase 12.
        backgroundColor: withAlpha(BrandColors.accent, 0.001), // transparent capture
    },
    fabMenu: {
        // Sits above the FAB (bottom 16, height 44 → FAB top edge at 60),
        // with a 10px gap. The menu opens upward from the FAB on tap.
        position: 'absolute',
        right: 16,
        bottom: 70,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        minWidth: 180,
        ...FAB_SHADOW,
    },
    fabMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },

    pressed: { opacity: 0.7 },
});
