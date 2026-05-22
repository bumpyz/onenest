import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useUpcomingEvents } from '@/hooks/use-upcoming-events';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import type { CustodySchedule, Event, HouseholdMember } from '@/lib/db';
import { iconForType } from '@/lib/event-types';
import { useAppColorScheme } from '@/providers/theme-provider';

function eventsForDay(events: Event[], day: Date): Event[] {
    return events
        .filter((e) => isSameDay(new Date(e.starts_at), day))
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

    const { households } = useHouseholds();
    const household = households?.[0];
    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    const { schedule: custodySchedule, refetch: refetchCustody } = useCustodySchedule(
        household?.id,
    );
    const { events, isLoading, refetch: refetchEvents } = useUpcomingEvents(household?.id);
    const { summary, refetch: refetchSummary } = useWeekSummary(household?.id);

    const today = useMemo(() => startOfDay(new Date()), []);
    const tomorrow = useMemo(() => addDays(today, 1), [today]);

    const { overrides: custodyOverrides, refetch: refetchOverrides } = useCustodyOverrides(
        household?.id,
        today,
        tomorrow,
    );

    useFocusEffect(
        useCallback(() => {
            refetchEvents();
            refetchMembers();
            refetchCustody();
            refetchOverrides();
            refetchSummary();
        }, [refetchEvents, refetchMembers, refetchCustody, refetchOverrides, refetchSummary]),
    );

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

    const onPressEvent = (id: string) =>
        router.push({ pathname: '/event/[id]', params: { id } });

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
                                                        onPress={() => onPressEvent(c.event.id)}
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
                                                    ? 'unassigned event'
                                                    : 'unassigned events'}
                                            </ThemedText>
                                            {summary.unassignedEvents.map((e) => (
                                                <Pressable
                                                    key={`unassigned-${e.id}`}
                                                    onPress={() => onPressEvent(e.id)}
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
                                                        No one assigned yet — tap to claim it
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

                        <DaySection
                            day={today}
                            label="Today"
                            events={todayEvents}
                            colorMap={colorMap}
                            colors={colors}
                            members={members ?? []}
                            custodySchedule={custodySchedule}
                            overrideMap={overrideMap}
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
                            custodySchedule={custodySchedule}
                            overrideMap={overrideMap}
                            onPressEvent={onPressEvent}
                            onPressCustody={(d) =>
                                router.push({ pathname: '/custody/[date]', params: { date: d } })
                            }
                        />
                    </ScrollView>
                )}
            </SafeAreaView>

            <Pressable
                onPress={() => router.push('/event/new')}
                style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
                <ThemedText style={styles.fabText}>+</ThemedText>
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
    custodySchedule: CustodySchedule | null;
    overrideMap: Map<string, import('@/lib/db').CustodyOverride>;
    onPressEvent: (id: string) => void;
    onPressCustody: (dateYmd: string) => void;
};

function DaySection({
    day,
    label,
    events,
    colorMap,
    colors,
    members,
    custodySchedule,
    overrideMap,
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
                            { borderColor: custodianColor, backgroundColor: `${custodianColor}22` },
                            pressed && styles.pressed,
                        ]}>
                        <View style={[styles.custodyPillDot, { backgroundColor: custodianColor }]} />
                        <ThemedText type="small" themeColor="textSecondary">
                            {resolved?.isOverride ? '↻' : 'with'}
                        </ThemedText>
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
                    const dotColor = colorForResponsible(event.responsible_profile_id, colorMap);
                    return (
                        <Pressable
                            key={`${event.id}-${event.starts_at}`}
                            onPress={() => onPressEvent(event.id)}
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
                                    {event.description ? <ThemedText>📝</ThemedText> : null}
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
                        </Pressable>
                    );
                })
            )}
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
    },
    timeCol: { width: 70, alignItems: 'flex-end', gap: 2 },
    dotCol: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
    contentCol: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
    titleText: { flex: 1 },
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
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
    pressed: { opacity: 0.7 },
});
