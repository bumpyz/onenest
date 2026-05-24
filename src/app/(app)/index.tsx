import { Feather } from '@expo/vector-icons';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventChildBadges } from '@/components/event-child-badges';
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
import { useUpcomingTasks } from '@/hooks/use-upcoming-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useUpcomingEvents } from '@/hooks/use-upcoming-events';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import {
    setTaskCompleted,
    type CustodyOverride,
    type CustodySchedule,
    type Event,
    type EventOccurrenceOverride,
    type HouseholdMember,
    type Task,
} from '@/lib/db';
import { iconForType } from '@/lib/event-types';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
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

    const colorMap = useMemo(() => memberColorMap(members), [members]);
    const overrideMap = useMemo(
        () => buildOverrideMap(custodyOverrides),
        [custodyOverrides],
    );

    const todayEvents = useMemo(() => eventsForDay(events ?? [], today), [events, today]);
    const tomorrowEvents = useMemo(
        () => eventsForDay(events ?? [], tomorrow),
        [events, tomorrow],
    );

    const onPressEvent = (id: string, occurrenceDate: Date) =>
        router.push({
            pathname: '/event/[id]',
            params: { id, date: format(occurrenceDate, 'yyyy-MM-dd') },
        });

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <ThemedText type="title">Home</ThemedText>
                    {household ? (
                        <ThemedText themeColor="textSecondary" type="small">
                            {household.name}
                        </ThemedText>
                    ) : null}
                </View>

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
                        {summary ? (
                            summary.conflicts.length > 0 || summary.unassignedEvents.length > 0 ? (
                                <View
                                    style={[
                                        styles.summaryCard,
                                        { backgroundColor: colors.backgroundElement },
                                    ]}>
                                    <ThemedText type="smallBold">Next 7 days</ThemedText>

                                    {summary.conflicts.length > 0 ? (
                                        <View style={styles.summarySection}>
                                            <ThemedText type="small" themeColor="textSecondary">
                                                ⚠ {summary.conflicts.length}{' '}
                                                {summary.conflicts.length === 1 ? 'conflict' : 'conflicts'}
                                            </ThemedText>
                                            {summary.conflicts.map((c, idx) => {
                                                const member = members?.find(
                                                    (m) => m.profile_id === c.profileId,
                                                );
                                                const memberName = member?.display_name ?? 'Someone';
                                                const blockStart = format(
                                                    new Date(c.blockStartsAt),
                                                    'h:mm a',
                                                );
                                                const blockEnd = format(
                                                    new Date(c.blockEndsAt),
                                                    'h:mm a',
                                                );
                                                return (
                                                    <Pressable
                                                        key={`conflict-${c.event.id}-${idx}`}
                                                        onPress={() =>
                                                            onPressEvent(
                                                                c.event.id,
                                                                new Date(c.event.starts_at),
                                                            )
                                                        }
                                                        style={({ pressed }) => [
                                                            styles.summaryRow,
                                                            pressed && styles.pressed,
                                                        ]}>
                                                        <ThemedText type="small" themeColor="textSecondary">
                                                            {format(
                                                                new Date(c.event.starts_at),
                                                                'EEE, MMM d · h:mm a',
                                                            )}
                                                        </ThemedText>
                                                        <ThemedText type="smallBold">
                                                            {c.event.title}
                                                        </ThemedText>
                                                        <ThemedText
                                                            type="small"
                                                            themeColor="textSecondary">
                                                            {memberName} is busy {blockStart} – {blockEnd}
                                                        </ThemedText>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    ) : null}

                                    {summary.unassignedEvents.length > 0 ? (
                                        <View style={styles.summarySection}>
                                            <ThemedText type="small" themeColor="textSecondary">
                                                📌 {summary.unassignedEvents.length}{' '}
                                                {summary.unassignedEvents.length === 1
                                                    ? 'event for Anyone'
                                                    : 'events for Anyone'}
                                            </ThemedText>
                                            {summary.unassignedEvents.map((e) => (
                                                <Pressable
                                                    // Recurring expansion shares e.id across
                                                    // occurrences, so include starts_at to
                                                    // keep React keys unique within the loop.
                                                    key={`unassigned-${e.id}-${e.starts_at}`}
                                                    onPress={() =>
                                                        onPressEvent(
                                                            e.id,
                                                            new Date(e.starts_at),
                                                        )
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.summaryRow,
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <ThemedText type="small" themeColor="textSecondary">
                                                        {format(
                                                            new Date(e.starts_at),
                                                            'EEE, MMM d · h:mm a',
                                                        )}
                                                    </ThemedText>
                                                    <ThemedText type="smallBold">{e.title}</ThemedText>
                                                    <ThemedText
                                                        type="small"
                                                        themeColor="textSecondary">
                                                        For Anyone — tap to open and assign
                                                    </ThemedText>
                                                </Pressable>
                                            ))}
                                        </View>
                                    ) : null}
                                </View>
                            ) : (
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small"
                                    style={styles.summaryAllClear}>
                                    ✓ All clear for the next 7 days
                                </ThemedText>
                            )
                        ) : null}

                        {/* Task sections — hidden entirely when both buckets are empty so
                            we don't show dead UI. Tapping a row's body navigates to the
                            linked event (when set); tapping the checkbox marks complete. */}
                        {taskBuckets.today.length > 0 ? (
                            <View style={styles.section}>
                                <ThemedText type="subtitle">Today&apos;s tasks</ThemedText>
                                {taskBuckets.today.map((t) => (
                                    <TaskRow
                                        key={t.id}
                                        task={t}
                                        members={members ?? []}
                                        colors={colors}
                                        onToggle={() => onToggleTaskComplete(t)}
                                        onOpenEvent={
                                            t.event_id
                                                ? () =>
                                                      router.push({
                                                          pathname: '/event/[id]',
                                                          params: {
                                                              id: t.event_id!,
                                                              date: t.due_at
                                                                  ? format(
                                                                        new Date(t.due_at),
                                                                        'yyyy-MM-dd',
                                                                    )
                                                                  : format(
                                                                        today,
                                                                        'yyyy-MM-dd',
                                                                    ),
                                                          },
                                                      })
                                                : undefined
                                        }
                                    />
                                ))}
                            </View>
                        ) : null}

                        {taskBuckets.thisWeek.length > 0 ? (
                            <View style={styles.section}>
                                <ThemedText type="subtitle">This week</ThemedText>
                                {taskBuckets.thisWeek.map((t) => (
                                    <TaskRow
                                        key={t.id}
                                        task={t}
                                        members={members ?? []}
                                        colors={colors}
                                        showDay
                                        onToggle={() => onToggleTaskComplete(t)}
                                        onOpenEvent={
                                            t.event_id
                                                ? () =>
                                                      router.push({
                                                          pathname: '/event/[id]',
                                                          params: {
                                                              id: t.event_id!,
                                                              date: t.due_at
                                                                  ? format(
                                                                        new Date(t.due_at),
                                                                        'yyyy-MM-dd',
                                                                    )
                                                                  : format(
                                                                        today,
                                                                        'yyyy-MM-dd',
                                                                    ),
                                                          },
                                                      })
                                                : undefined
                                        }
                                    />
                                ))}
                            </View>
                        ) : null}

                        <DaySection
                            day={today}
                            label="Today"
                            events={todayEvents}
                            colorMap={colorMap}
                            colors={colors}
                            members={members ?? []}
                            children={children ?? []}
                            custodySchedule={custodySchedule}
                            overrideMap={overrideMap}
                            occurrenceOverrideMap={occurrenceOverrideMap}
                            onPressEvent={onPressEvent}
                            onPressCustody={(d) =>
                                router.push({ pathname: '/custody/[date]', params: { date: d } })
                            }
                        />
                        <DaySection
                            day={tomorrow}
                            label="Tomorrow"
                            events={tomorrowEvents}
                            colorMap={colorMap}
                            colors={colors}
                            members={members ?? []}
                            children={children ?? []}
                            custodySchedule={custodySchedule}
                            overrideMap={overrideMap}
                            occurrenceOverrideMap={occurrenceOverrideMap}
                            onPressEvent={onPressEvent}
                            onPressCustody={(d) =>
                                router.push({ pathname: '/custody/[date]', params: { date: d } })
                            }
                        />
                    </ScrollView>
                )}
            </SafeAreaView>

            {/* Quick-create chooser. The FAB itself toggles the menu (+/×); the
                two pill buttons sit above the FAB. When open, a full-screen
                transparent backdrop captures taps outside the menu and closes
                it — the standard popover dismiss pattern. */}
            {addMenuOpen ? (
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
                                📅  New event
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
            <Pressable
                onPress={() => setAddMenuOpen((v) => !v)}
                accessibilityLabel={
                    addMenuOpen ? 'Close quick-create menu' : 'Open quick-create menu'
                }
                style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
                <ThemedText style={styles.fabText}>
                    {addMenuOpen ? '×' : '+'}
                </ThemedText>
            </Pressable>
        </ThemedView>
    );
}

type DaySectionProps = {
    day: Date;
    label: string;
    events: Event[];
    colorMap: Map<string, string>;
    colors: Palette;
    members: HouseholdMember[];
    /** Household children, passed in for the EventChildBadges lookup inside event rows. */
    children: import('@/lib/db').Child[];
    custodySchedule: CustodySchedule | null;
    overrideMap: Map<string, CustodyOverride>;
    /** Keyed by "eventId|YYYY-MM-DD" — surfaces per-occurrence responsible overrides. */
    occurrenceOverrideMap: Map<string, EventOccurrenceOverride>;
    onPressEvent: (id: string, occurrenceDate: Date) => void;
    onPressCustody: (dateYmd: string) => void;
};

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
                    // UX-027: visible × stays small but hitSlop extends the touch
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
                        ×
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

function DaySection({
    day,
    label,
    events,
    colorMap,
    colors,
    members,
    children,
    custodySchedule,
    overrideMap,
    occurrenceOverrideMap,
    onPressEvent,
    onPressCustody,
}: DaySectionProps) {
    const resolved = useMemo(() => {
        if (!custodySchedule) return null;
        return resolveCustodianOnDate(custodySchedule, overrideMap, day);
    }, [custodySchedule, overrideMap, day]);
    const custodianMember = resolved
        ? members.find((m) => m.profile_id === resolved.profileId) ?? null
        : null;
    const custodianColor = custodianMember
        ? colorForResponsible(custodianMember.profile_id, colorMap)
        : null;

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <ThemedText type="subtitle">{label}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                    {format(day, 'EEEE, MMM d')}
                </ThemedText>
                {custodianMember && custodianColor ? (
                    <Pressable
                        onPress={() => onPressCustody(format(day, 'yyyy-MM-dd'))}
                        style={({ pressed }) => [
                            styles.custodyPill,
                            {
                                borderColor: custodianColor,
                                // QA-023: safe alpha. Was `${custodianColor}22`,
                                // brittle if a member color is ever non-7-char hex.
                                backgroundColor: withAlpha(custodianColor, 0.13),
                            },
                            pressed && styles.pressed,
                        ]}>
                        <View style={[styles.custodyPillDot, { backgroundColor: custodianColor }]} />
                        {/* Unified custody glyph across Home + Calendar (UX-006):
                            Feather user icon for the default "this parent has the
                            kid today" case, "↻" for overrides. Replaces the
                            previous "with" text on Home + 👶 emoji on Calendar. */}
                        {resolved?.isOverride ? (
                            <ThemedText type="small" themeColor="textSecondary">
                                ↻
                            </ThemedText>
                        ) : (
                            <Feather name="user" size={12} color={colors.textSecondary} />
                        )}
                        <ThemedText type="smallBold">{custodianMember.display_name}</ThemedText>
                    </Pressable>
                ) : null}
            </View>
            {events.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    Nothing scheduled.
                </ThemedText>
            ) : (
                events.map((event) => {
                    // Resolver handles alternation lookup + occurrence override for the
                    // specific date this instance falls on (which is `day` since the list
                    // is filtered to today / tomorrow).
                    const resolvedResponsible = resolveResponsibleProfileId({
                        event,
                        occurrenceDate: day,
                        custodySchedule,
                        custodyOverrides: overrideMap,
                        occurrenceOverrides: occurrenceOverrideMap,
                    });
                    const dotColor = colorForResponsible(resolvedResponsible, colorMap);
                    return (
                        <Pressable
                            key={`${event.id}-${event.starts_at}`}
                            onPress={() => onPressEvent(event.id, day)}
                            style={({ pressed }) => [
                                styles.eventRow,
                                { backgroundColor: colors.backgroundElement },
                                pressed && styles.pressed,
                            ]}>
                            <View style={styles.timeCol}>
                                {event.all_day ? (
                                    <ThemedText type="small" themeColor="textSecondary">
                                        All day
                                    </ThemedText>
                                ) : (
                                    <>
                                        <ThemedText type="smallBold">
                                            {format(new Date(event.starts_at), 'h:mm a')}
                                        </ThemedText>
                                        <ThemedText type="small" themeColor="textSecondary">
                                            {format(new Date(event.ends_at), 'h:mm a')}
                                        </ThemedText>
                                    </>
                                )}
                            </View>
                            <View style={[styles.dotCol, { backgroundColor: dotColor }]} />
                            <View style={styles.contentCol}>
                                <View style={styles.titleRow}>
                                    <ThemedText
                                        type="smallBold"
                                        numberOfLines={1}
                                        style={styles.titleText}>
                                        {iconForType(event.event_type)}
                                        {iconForType(event.event_type) ? ' ' : ''}
                                        {event.title}
                                    </ThemedText>
                                    <EventChildBadges
                                        allChildren={children ?? []}
                                        childIds={event.child_ids}
                                        size="sm"
                                        maxVisible={3}
                                    />
                                </View>
                                {event.location ? (
                                    <ThemedText
                                        themeColor="textSecondary"
                                        type="small"
                                        numberOfLines={1}>
                                        📍 {event.location}
                                    </ThemedText>
                                ) : null}
                            </View>
                            {/* Note indicator pinned to the bottom-right corner of
                                the row — matches the Calendar event-block layout so
                                the visual language is consistent across screens. */}
                            {event.description ? (
                                <ThemedText style={styles.noteIcon}>📝</ThemedText>
                            ) : null}
                        </Pressable>
                    );
                })
            )}
        </View>
    );
}

/**
 * Single task row used in the Home Today / This-week sections. Renders:
 *   - Tap-target checkbox on the left (flips completed_at)
 *   - Title (strikethrough when completed)
 *   - Subtitle: assignee names + due time, when due_at is set
 *   - Whole row body tappable → opens the linked event when one exists
 */
function TaskRow({
    task,
    members,
    colors,
    onToggle,
    onOpenEvent,
    showDay = false,
}: {
    task: Task;
    members: HouseholdMember[];
    colors: Palette;
    onToggle: () => void;
    onOpenEvent?: () => void;
    /**
     * Include the day-of-week + date in the due-time label. The Today section
     * omits it (the section header is already "today"); the This-week section
     * passes true to match the "Next 7 days" event summary's `EEE, MMM d · h:mm a`
     * format and avoid the "what day is that?" ambiguity.
     */
    showDay?: boolean;
}) {
    const done = !!task.completed_at;
    const assigneeLabel =
        task.assignee_profile_ids.length === 0
            ? 'Anyone'
            : task.assignee_profile_ids
                  .map((id) => members.find((m) => m.profile_id === id)?.display_name)
                  .filter((n): n is string => !!n)
                  .join(', ');
    const dueLabel = task.due_at
        ? format(
              new Date(task.due_at),
              showDay ? 'EEE, MMM d · h:mm a' : 'h:mm a',
          )
        : null;
    return (
        <View style={styles.taskRow}>
            <Pressable
                onPress={onToggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={done ? 'Mark task incomplete' : 'Mark task complete'}
                style={({ pressed }) => [
                    styles.taskCheckbox,
                    {
                        backgroundColor: done ? '#6F7FA5' : 'transparent',
                        borderColor: done ? '#6F7FA5' : colors.backgroundSelected,
                    },
                    pressed && styles.pressed,
                ]}>
                {done ? <ThemedText style={styles.taskCheck}>✓</ThemedText> : null}
            </Pressable>
            <Pressable
                onPress={onOpenEvent}
                disabled={!onOpenEvent}
                style={({ pressed }) => [
                    styles.taskBody,
                    pressed && onOpenEvent && styles.pressed,
                ]}>
                <ThemedText
                    type="smallBold"
                    style={
                        done
                            ? {
                                  textDecorationLine: 'line-through',
                                  color: colors.textSecondary,
                              }
                            : undefined
                    }>
                    {task.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                    {assigneeLabel}
                    {dueLabel ? ` · ${dueLabel}` : ''}
                </ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.two,
        gap: Spacing.one,
    },
    scroll: { padding: Spacing.four, gap: Spacing.five, paddingBottom: 100 },
    summaryCard: {
        padding: Spacing.three,
        borderRadius: Spacing.two,
        gap: Spacing.three,
    },
    summarySection: { gap: Spacing.one },
    summaryRow: { paddingVertical: Spacing.one, gap: 2 },
    summaryAllClear: { fontStyle: 'italic', paddingHorizontal: Spacing.two },
    // TaskRow styles for the Home Today / This-week sections.
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        paddingVertical: Spacing.two,
    },
    taskCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskCheck: { color: '#fff', fontSize: 14, fontWeight: '700' },
    taskBody: { flex: 1, gap: 2 },
    section: { gap: Spacing.three },
    sectionHeader: { gap: Spacing.half },
    emptyText: { fontStyle: 'italic', paddingHorizontal: Spacing.two },
    custodyPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.two,
        paddingVertical: 2,
        marginTop: Spacing.one,
    },
    custodyPillDot: { width: 8, height: 8, borderRadius: 4 },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.three,
        borderRadius: Spacing.two,
        gap: Spacing.three,
        // position: relative so the absolutely-positioned noteIcon child anchors
        // to this row's bounding box rather than the parent column.
        position: 'relative',
    },
    timeCol: { width: 70, alignItems: 'flex-end', gap: 2 },
    dotCol: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
    contentCol: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
    titleText: { flex: 1 },
    // Mirrors Calendar's noteIcon style so the indicator sits in the same visual
    // position on both screens.
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
