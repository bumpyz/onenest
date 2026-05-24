import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayCard } from '@/components/day-card';
import { HandOffCard } from '@/components/hand-off-card';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing } from '@/constants/theme';
import { FAB_SHADOW, PILL_SHADOW, withAlpha } from '@/lib/platform-styles';
import { useChildren } from '@/hooks/use-children';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useEventOccurrenceOverrides } from '@/hooks/use-event-occurrence-overrides';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useMyRole } from '@/hooks/use-my-role';
import { useUpcomingTasks } from '@/hooks/use-upcoming-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useUpcomingEvents } from '@/hooks/use-upcoming-events';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { buildOverrideMap } from '@/lib/custody';
import { setTaskCompleted, type Event, type Task } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

function eventsForDay(events: Event[], day: Date): Event[] {
    // Timed events appear on their start day (compared in local time — they
    // represent a real point in time). Multi-day all-day events appear on every
    // day they cover. Per QA-005, all-day events are anchored at UTC midnight,
    // so we identify their day range via the YYYY-MM-DD prefix of the ISO
    // string (every viewer reads the same calendar date back).
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

type Palette = {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
};

export default function HomeScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors: Palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // FAB chooser state. Tapping the FAB toggles a small overlay with "New event"
    // and "New task" options. Lives in this screen because the FAB is anchored
    // here — we don't try to share a global app-wide quick-create chooser across
    // tabs since each tab has its own creation affordances (Lists tab has a
    // quick-add input, Calendar has drag-to-create, Settings doesn't create
    // anything).
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const closeAddMenu = useCallback(() => setAddMenuOpen(false), []);
    const openNew = useCallback(
        (path: '/event/new' | '/task/new') => {
            closeAddMenu();
            router.push(path);
        },
        [router, closeAddMenu],
    );

    const { households } = useHouseholds();
    const household = households?.[0];

    // Caregivers see a strictly read-only Home — no FAB, no quick-create
    // chooser, no welcome-card "Add your first event" chip. The whole creation
    // surface is hidden client-side as defense in depth; RLS in migration 0031
    // also blocks event/task INSERTs server-side.
    //
    // `roleLoading` matters at cold-start: defaulting to !isCaregiver while we
    // wait would briefly flash the FAB for caregivers. Treat unknown role as
    // "no FAB yet" — parents see it ~one frame later than before, caregivers
    // never see it.
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const showCreateAffordances = !roleLoading && !isCaregiver;

    // UX-019: first-run welcome card. Persisted per-household via AsyncStorage
    // so dismissal sticks across reloads. Initial state is `null` until we've
    // confirmed AsyncStorage's value — that avoids flashing the welcome card
    // for returning users on cold start. The render gate (`=== false`) treats
    // both null (unhydrated) and true (dismissed) as "don't show yet."
    const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(null);
    const welcomeKey = household
        ? `onenest:home-welcome-dismissed:${household.id}`
        : null;
    useEffect(() => {
        // QA-021: reset to null before reading AsyncStorage when the household
        // changes. Without this, switching households (latent today — no
        // user-facing selector — but coming) would briefly render the new
        // household with the previous one's dismissal state, flashing the
        // welcome card on or off incorrectly until the async read settles.
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
    const { user } = useAuth();
    const { events, isLoading, refetch: refetchEvents } = useUpcomingEvents(household?.id);
    const { summary, refetch: refetchSummary } = useWeekSummary(household?.id);
    const { buckets: rawTaskBuckets, refetch: refetchTasks } = useUpcomingTasks(
        household?.id,
    );
    // The Home digest should only surface tasks the current user can plausibly act on:
    //   • Assigned to me, OR
    //   • Unassigned ("Anyone" bucket — anyone in the household could pick it up)
    // Same rule the Sunday-summary edge function applies, so push counts and on-screen
    // counts stay in sync. We filter here (client-side) rather than in getUpcomingTasks
    // so the Lists tab can still pull the full household view when we wire it up.
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

    const { overrides: custodyOverrides, refetch: refetchOverrides } = useCustodyOverrides(
        household?.id,
        today,
        tomorrow,
    );
    // Pull occurrence overrides for the same two-day window — they affect the responsible
    // dot color in the day list.
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
        }, [
            refetchEvents,
            refetchMembers,
            refetchChildren,
            refetchCustody,
            refetchOverrides,
            refetchOccurrenceOverrides,
            refetchSummary,
            refetchTasks,
        ]),
    );

    /** Marks a task complete (or undoes) and refetches so the row falls off the list. */
    const onToggleTaskComplete = async (task: Task) => {
        await setTaskCompleted(task.id, !task.completed_at);
        await refetchTasks();
    };

    // colorMap used to be computed here for the old DaySection rendering;
    // DayCard now derives it internally from members. We keep the override
    // map because DayCard takes it as a prop.
    const overrideMap = useMemo(
        () => buildOverrideMap(custodyOverrides),
        [custodyOverrides],
    );

    const todayEvents = useMemo(() => eventsForDay(events ?? [], today), [events, today]);
    const tomorrowEvents = useMemo(
        () => eventsForDay(events ?? [], tomorrow),
        [events, tomorrow],
    );

    // ─── Per-day task partitioning ─────────────────────────────────────────
    // The old layout had separate "Today's tasks" / "This week" sections at
    // the top of Home; the Day Card design folds tasks INTO the day they're
    // due on. Split the existing buckets here once so each card gets a clean
    //, day-keyed task list — and surface the leftover later-in-week + undated
    // tasks below in smaller sliver sections.
    const isSameYmd = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    const todayTasks = useMemo(
        () => taskBuckets.today,
        [taskBuckets.today],
    );
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

    // ─── Per-day badge counts (conflicts + unassigned) ─────────────────────
    // The summary used to render at the top of Home as a "Next 7 days"
    // section. In the Day Card layout the counts move to badges at the top
    // of the day they belong to — relevant to where the user is looking.
    // We bucket by event start-date (local calendar day).
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

    const onPressEvent = (id: string, occurrenceDate: Date) =>
        router.push({
            pathname: '/event/[id]',
            params: { id, date: format(occurrenceDate, 'yyyy-MM-dd') },
        });

    // ─── Task tap handler ──────────────────────────────────────────────────
    // Tasks land on /event/[id] when linked to an event (parents); /task/[id]
    // when unlinked OR the user is a caregiver (whose event may be hidden by
    // RLS — see migration 0031 notes). Same routing rule used previously on
    // TaskRow, lifted up so DayCard can call it.
    const onPressTask = (t: Task) => {
        if (t.event_id && !isCaregiver) {
            router.push({
                pathname: '/event/[id]',
                params: {
                    id: t.event_id,
                    date: t.due_at
                        ? format(new Date(t.due_at), 'yyyy-MM-dd')
                        : format(today, 'yyyy-MM-dd'),
                },
            });
        } else {
            router.push({
                pathname: '/task/[id]',
                params: { id: t.id },
            });
        }
    };
    const onPressCustodyDay = (d: string) =>
        router.push({ pathname: '/custody/[date]', params: { date: d } });

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                {/* No screen-level title — the active tab tint at the bottom
                    already signals "you are here", and the day-card stack
                    below carries the meaning ("TODAY" / "TOMORROW" labels).
                    Reclaim the vertical real estate for content. */}

                {isLoading && !events ? (
                    <LoadingScreen />
                ) : (
                    <ScrollView contentContainerStyle={styles.scroll}>
                        {/* UX-019: first-run welcome card. Replaces the
                            misleading "✓ All clear" message that fired for
                            brand-new households who hadn't actually done
                            anything yet. Surfaces up to four next-step
                            actions, hides ones that no longer apply (e.g.
                            partner already invited), and respects a
                            per-household AsyncStorage dismissal so returning
                            users don't keep seeing it. Only renders when the
                            household has zero events AND zero tasks and the
                            user hasn't dismissed it yet. */}
                        {welcomeDismissed === false &&
                        (events ?? []).length === 0 &&
                        taskBuckets.today.length === 0 &&
                        taskBuckets.thisWeek.length === 0 &&
                        taskBuckets.undated.length === 0 ? (
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
                                onRouteToCustody={() =>
                                    router.push('/settings')
                                }
                                onRouteToEventNew={() => router.push('/event/new')}
                                colors={colors}
                            />
                        ) : null}
                        {/* Day Cards. Per-day hero surfaces for today + tomorrow.
                            Tasks fold INTO the day they're due on (no more
                            separate "Today's tasks" / "This week" sections at
                            the top). Conflict + unassigned badges land on the
                            relevant day card. "Later this week" + "Anytime"
                            sliver sections below pick up tasks that don't fit
                            into today/tomorrow. */}
                        <DayCard
                            day={today}
                            label="Today"
                            events={todayEvents}
                            tasks={todayTasks}
                            members={members ?? []}
                            children={children ?? []}
                            custodySchedule={custodySchedule}
                            custodyOverrideMap={overrideMap}
                            occurrenceOverrideMap={occurrenceOverrideMap}
                            conflictCount={conflictCountsByDay.get(todayKey) ?? 0}
                            unassignedCount={unassignedCountsByDay.get(todayKey) ?? 0}
                            onPressEvent={onPressEvent}
                            onPressTask={onPressTask}
                            onToggleTask={onToggleTaskComplete}
                            onPressCustody={onPressCustodyDay}
                        />
                        <DayCard
                            day={tomorrow}
                            label="Tomorrow"
                            events={tomorrowEvents}
                            tasks={tomorrowTasks}
                            members={members ?? []}
                            children={children ?? []}
                            custodySchedule={custodySchedule}
                            custodyOverrideMap={overrideMap}
                            occurrenceOverrideMap={occurrenceOverrideMap}
                            conflictCount={conflictCountsByDay.get(tomorrowKey) ?? 0}
                            unassignedCount={unassignedCountsByDay.get(tomorrowKey) ?? 0}
                            onPressEvent={onPressEvent}
                            onPressTask={onPressTask}
                            onToggleTask={onToggleTaskComplete}
                            onPressCustody={onPressCustodyDay}
                        />

                        {/* Sliver: later-this-week tasks that don't belong to
                            today/tomorrow's cards. Standalone HandOffCards
                            since they're not nested in a day card. */}
                        {laterThisWeekTasks.length > 0 ? (
                            <View style={styles.section}>
                                <ThemedText
                                    type="smallBold"
                                    style={styles.sliverHeader}>
                                    Later this week
                                </ThemedText>
                                {laterThisWeekTasks.map((t) => (
                                    <HandOffCard
                                        key={t.id}
                                        task={t}
                                        members={members ?? []}
                                        variant="standalone"
                                        showDay
                                        onToggle={() => onToggleTaskComplete(t)}
                                        onOpen={() => onPressTask(t)}
                                    />
                                ))}
                            </View>
                        ) : null}

                        {/* Sliver: undated tasks. Whenever-you-get-to-it bucket. */}
                        {taskBuckets.undated.length > 0 ? (
                            <View style={styles.section}>
                                <ThemedText
                                    type="smallBold"
                                    style={styles.sliverHeader}>
                                    Anytime
                                </ThemedText>
                                {taskBuckets.undated.map((t) => (
                                    <HandOffCard
                                        key={t.id}
                                        task={t}
                                        members={members ?? []}
                                        variant="standalone"
                                        onToggle={() => onToggleTaskComplete(t)}
                                        onOpen={() => onPressTask(t)}
                                    />
                                ))}
                            </View>
                        ) : null}
                    </ScrollView>
                )}
            </SafeAreaView>

            {/* Quick-create chooser. The FAB itself toggles the menu (+/Ã—); the
                two pill buttons sit above the FAB. When open, a full-screen
                transparent backdrop captures taps outside the menu and closes
                it — the standard popover dismiss pattern.

                Caregivers can't create events or tasks (RLS blocks it server-
                side; UI hides it client-side), so the whole FAB + chooser is
                gated on !isCaregiver. */}
            {showCreateAffordances && addMenuOpen ? (
                <>
                    <Pressable
                        onPress={closeAddMenu}
                        style={styles.fabBackdrop}
                        accessibilityLabel="Close quick-create menu"
                    />
                    <View style={styles.fabMenu}>
                        {/* UX-014: pull bg + text from the theme so the chooser
                            doesn't look like leftover light-mode UI in dark theme.
                            Static styles only carry the geometry + shadow. */}
                        <Pressable
                            onPress={() => openNew('/event/new')}
                            style={({ pressed }) => [
                                styles.fabMenuItem,
                                { backgroundColor: colors.backgroundElement },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.fabMenuItemText,
                                    { color: colors.text },
                                ]}>
                                ðŸ“…  New event
                            </ThemedText>
                        </Pressable>
                        <Pressable
                            onPress={() => openNew('/task/new')}
                            style={({ pressed }) => [
                                styles.fabMenuItem,
                                { backgroundColor: colors.backgroundElement },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.fabMenuItemText,
                                    { color: colors.text },
                                ]}>
                                ✓  New task
                            </ThemedText>
                        </Pressable>
                    </View>
                </>
            ) : null}
            {showCreateAffordances ? (
                <Pressable
                    onPress={() => setAddMenuOpen((v) => !v)}
                    accessibilityLabel={
                        addMenuOpen ? 'Close quick-create menu' : 'Open quick-create menu'
                    }
                    style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
                    <ThemedText style={styles.fabText}>
                        {addMenuOpen ? 'Ã—' : '+'}
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

/**
 * UX-019: first-run welcome card. Visible on Home for a brand-new household
 * (no events, no tasks, possibly missing partner/child/custody setup) until
 * the user dismisses it. Persistence + visibility are owned by the parent;
 * this component is just the layout.
 *
 * Action chips are individually conditional — `showInvite` etc. — so a user
 * who already invited a partner won't see that chip even on day one. The
 * fourth chip ("Add your first event") is always present because it's the
 * baseline next step regardless of household type.
 */
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
    if (showInvite) {
        actions.push({ label: '+ Invite partner', onPress: onRouteToSettings });
    }
    if (showAddChild) {
        actions.push({ label: '+ Add a child', onPress: onRouteToChildNew });
    }
    if (showSetCustody) {
        actions.push({ label: '+ Set up custody', onPress: onRouteToCustody });
    }
    actions.push({ label: '+ New event', onPress: onRouteToEventNew });
    return (
        <View
            style={[
                styles.welcomeCard,
                { backgroundColor: colors.backgroundElement },
            ]}>
            <View style={styles.welcomeHeaderRow}>
                <ThemedText type="smallBold">
                    Welcome to {householdName}
                </ThemedText>
                <Pressable
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss welcome card"
                    // UX-027: visible Ã— stays small but hitSlop extends the touch
                    // target to ~44pt on all sides per Apple HIG. Without this
                    // the user had to land their finger on an ~28pt glyph.
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    style={({ pressed }) => [
                        styles.welcomeDismiss,
                        pressed && styles.pressed,
                    ]}>
                    <ThemedText
                        themeColor="textSecondary"
                        style={styles.welcomeDismissText}>
                        Ã—
                    </ThemedText>
                </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
                A couple of quick next steps to get going:
            </ThemedText>
            <View style={styles.welcomeChipRow}>
                {actions.map((a) => (
                    <Pressable
                        key={a.label}
                        onPress={a.onPress}
                        style={({ pressed }) => [
                            styles.welcomeChip,
                            {
                                // UX-026: slate-blue border for the "actionable"
                                // signal, slate-blue tint for the chip background
                                // so the chip has its own surface (more visible
                                // than a hairline border) AND text uses
                                // colors.text which contrasts ~7:1 on both
                                // themes. Previous design (#6F7FA5 text on
                                // colors.backgroundElement) measured ~3.06:1
                                // on dark, failing WCAG AA.
                                borderColor: '#6F7FA5',
                                // Safe alpha via helper rather than hex concat.
                                backgroundColor: withAlpha('#6F7FA5', 0.13),
                            },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            type="small"
                            style={{ color: colors.text, fontWeight: '600' }}>
                            {a.label}
                        </ThemedText>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

// DaySection + TaskRow used to live here. Both replaced by the new <DayCard>
// + <HandOffCard> components — DayCard wraps a day's events + tasks in one
// hero card with a custodian color rail; HandOffCard renders each task with
// a leading assignee-color band. Removed in the day-card / hand-off-card
// rework so we don't keep two layout vocabularies side by side.
//
// Old TaskRow logic for routing (event-linked → /event/[id] vs caregiver →
// /task/[id]) is preserved as `onPressTask` in the main HomeScreen and
// passed into DayCard / HandOffCard via the `onOpen` prop.
const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { padding: Spacing.four, gap: Spacing.five, paddingBottom: 100 },
    // Section wrapper for the "Later this week" / "Anytime" slivers below the
    // day-cards. Provides consistent vertical rhythm between the header and
    // its HandOffCard stack.
    section: { gap: Spacing.two },
    // Tertiary header for the Later/Anytime slivers — caps + letterSpacing,
    // matches the Day Card header label vocabulary at a smaller size so the
    // hierarchy reads top-down: Day Card label (12px) > sliver header (11px).
    sliverHeader: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        paddingHorizontal: Spacing.one,
    },
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
    // Full-screen transparent layer that captures taps outside the chooser to
    // dismiss it. Sits below the menu items (zIndex 1) and above everything else
    // (zIndex of fab/fabMenu is higher). Pure interaction surface — no visual.
    fabBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
    },
    // Stack of choice pills above the FAB. Bottom of the stack aligns just above
    // the FAB (fab.bottom + fab.height + small gap). Pills are content-width with
    // a subtle shadow so they pop off the screen.
    fabMenu: {
        position: 'absolute',
        right: Spacing.four,
        // FAB sits at bottom: Spacing.six, height 56; place menu above with a gap.
        bottom: Spacing.six + 56 + Spacing.two,
        gap: Spacing.two,
        alignItems: 'flex-end',
        zIndex: 10,
    },
    fabMenuItem: {
        // UX-014: background + text color come from theme at render time so
        // dark mode doesn't surface a bright white pill. See the render site.
        borderRadius: 999,
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        ...PILL_SHADOW,
    },
    fabMenuItemText: { fontSize: 15, fontWeight: '600' },
    pressed: { opacity: 0.7 },
    // UX-019: first-run welcome card. Same elevated-pill geometry as
    // summaryCard so it reads as part of the same surface family.
    welcomeCard: {
        borderRadius: Spacing.three,
        padding: Spacing.four,
        gap: Spacing.three,
    },
    welcomeHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    welcomeDismiss: { padding: Spacing.one },
    welcomeDismissText: { fontSize: 20, lineHeight: 20 },
    welcomeChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.two,
    },
    welcomeChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
    },
});
