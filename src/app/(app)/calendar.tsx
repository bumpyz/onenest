import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek, subWeeks } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useEvents } from '@/hooks/use-events';
import { useHouseholdBusyBlocks } from '@/hooks/use-household-busy-blocks';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyExternalEvents } from '@/hooks/use-my-external-events';
import { memberColorMap, colorForResponsible } from '@/lib/colors';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import type { Event, ExternalEvent, HouseholdBusyBlock } from '@/lib/db';
import { iconForType } from '@/lib/event-types';
import { useAppColorScheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';

const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_COLUMN_WIDTH = 56;
const DEFAULT_SCROLL_HOUR = 7;
const ALL_DAY_ROW_HEIGHT = 28;

function formatHourLabel(h: number): string {
    if (h === 0) return '';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
}

function eventsForDay(events: Event[], day: Date): Event[] {
    return events.filter((e) => isSameDay(new Date(e.starts_at), day));
}

export default function CalendarScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { user } = useAuth();
    const { households } = useHouseholds();
    const household = households?.[0];
    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    const { schedule: custodySchedule, refetch: refetchCustody } = useCustodySchedule(
        household?.id,
    );

    const [weekStart, setWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 0 }),
    );
    const weekEndInclusive = useMemo(() => addDays(weekStart, 6), [weekStart]);
    const { overrides: custodyOverrides, refetch: refetchOverrides } = useCustodyOverrides(
        household?.id,
        weekStart,
        weekEndInclusive,
    );
    const { events, isLoading, refetch: refetchEvents } = useEvents(household?.id, weekStart);
    const { events: externalEvents, refetch: refetchExternalEvents } = useMyExternalEvents(weekStart);
    const { blocks: householdBusyBlocks, refetch: refetchBusyBlocks } = useHouseholdBusyBlocks(
        household?.id,
        weekStart,
    );

    useFocusEffect(
        useCallback(() => {
            refetchEvents();
            refetchMembers();
            refetchCustody();
            refetchOverrides();
            refetchExternalEvents();
            refetchBusyBlocks();
        }, [
            refetchEvents,
            refetchMembers,
            refetchCustody,
            refetchOverrides,
            refetchExternalEvents,
            refetchBusyBlocks,
        ]),
    );

    const overrideMap = useMemo(
        () => buildOverrideMap(custodyOverrides),
        [custodyOverrides],
    );

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    const days = useMemo(() => {
        const out: Date[] = [];
        for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i));
        return out;
    }, [weekStart]);

    const allDayEvents = useMemo(
        () => (events ?? []).filter((e) => e.all_day),
        [events],
    );
    const timedEvents = useMemo(
        () => (events ?? []).filter((e) => !e.all_day),
        [events],
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
        const t = setTimeout(() => {
            gridScrollRef.current?.scrollTo({
                y: DEFAULT_SCROLL_HOUR * HOUR_HEIGHT,
                animated: false,
            });
        }, 0);
        return () => clearTimeout(t);
    }, []);

    const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;
    const hasAllDay = allDayEvents.length > 0;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <Pressable
                            onPress={() => setWeekStart(subWeeks(weekStart, 1))}
                            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
                            <ThemedText themeColor="textSecondary" type="subtitle">
                                ‹
                            </ThemedText>
                        </Pressable>
                        <View style={styles.headerTitle}>
                            <ThemedText type="smallBold">{weekLabel}</ThemedText>
                            {household ? (
                                <ThemedText themeColor="textSecondary" type="small">
                                    {household.name}
                                </ThemedText>
                            ) : null}
                        </View>
                        <Pressable
                            onPress={() => setWeekStart(addWeeks(weekStart, 1))}
                            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
                            <ThemedText themeColor="textSecondary" type="subtitle">
                                ›
                            </ThemedText>
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                        style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary" type="small">
                            Jump to today
                        </ThemedText>
                    </Pressable>
                </View>

                <View
                    style={[
                        styles.dayHeaderRow,
                        { borderBottomColor: colors.backgroundSelected },
                    ]}>
                    <View style={{ width: TIME_COLUMN_WIDTH }} />
                    {days.map((day) => {
                        const dayIsToday = isToday(day);
                        return (
                            <View
                                key={day.toISOString()}
                                style={[
                                    styles.dayLabel,
                                    dayIsToday && { backgroundColor: colors.backgroundElement },
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
                    <View
                        style={[
                            styles.custodyBand,
                            { borderBottomColor: colors.backgroundSelected },
                        ]}>
                        <View style={[styles.custodyLabelCell, { width: TIME_COLUMN_WIDTH }]}>
                            <ThemedText type="small" themeColor="textSecondary">
                                custody
                            </ThemedText>
                        </View>
                        {days.map((day) => {
                            const resolved = resolveCustodianOnDate(custodySchedule, overrideMap, day);
                            const member = members?.find((m) => m.profile_id === resolved.profileId);
                            const c = colorForResponsible(resolved.profileId, colorMap);
                            const firstName = member?.display_name?.split(' ')[0] ?? '—';
                            const dateParam = format(day, 'yyyy-MM-dd');
                            return (
                                <Pressable
                                    key={`custody-${day.toISOString()}`}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/custody/[date]',
                                            params: { date: dateParam },
                                        })
                                    }
                                    style={({ pressed }) => [
                                        styles.custodyCell,
                                        { backgroundColor: c },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={styles.custodyCellText}
                                        numberOfLines={1}>
                                        {resolved.isOverride ? '↻ ' : '👶 '}
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
                                {eventsForDay(allDayEvents, day).map((event) => (
                                    <Pressable
                                        key={`${event.id}-${event.starts_at}`}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/event/[id]',
                                                params: { id: event.id },
                                            })
                                        }
                                        style={({ pressed }) => [
                                            styles.allDayChip,
                                            {
                                                backgroundColor: colorForResponsible(
                                                    event.responsible_profile_id,
                                                    colorMap,
                                                ),
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={styles.allDayChipText}
                                            numberOfLines={1}>
                                            {iconForType(event.event_type)}
                                            {iconForType(event.event_type) ? ' ' : ''}
                                            {event.title}
                                            {event.description ? ' 📝' : ''}
                                        </ThemedText>
                                    </Pressable>
                                ))}
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

                            {days.map((day) => {
                                const dayIsToday = isToday(day);
                                const dayTimed = eventsForDay(timedEvents, day);
                                return (
                                    <View
                                        key={day.toISOString()}
                                        style={[
                                            styles.dayColumn,
                                            { borderRightColor: colors.backgroundSelected },
                                            dayIsToday && {
                                                backgroundColor: colors.backgroundElement,
                                            },
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
                                                    style={[
                                                        styles.otherBusyBlock,
                                                        {
                                                            top,
                                                            height,
                                                            backgroundColor: `${memberColor}26`,
                                                            borderLeftColor: `${memberColor}99`,
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
                                            const bg = colorForResponsible(
                                                event.responsible_profile_id,
                                                colorMap,
                                            );
                                            const hasNote = !!event.description;
                                            return (
                                                <Pressable
                                                    key={`${event.id}-${event.starts_at}`}
                                                    onPress={() =>
                                                        router.push({
                                                            pathname: '/event/[id]',
                                                            params: { id: event.id },
                                                        })
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.eventBlock,
                                                        { top, height, backgroundColor: bg },
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <ThemedText
                                                        type="small"
                                                        style={styles.eventTitle}
                                                        numberOfLines={1}>
                                                        {iconForType(event.event_type)}
                                                        {iconForType(event.event_type) ? ' ' : ''}
                                                        {event.title}
                                                    </ThemedText>
                                                    {height >= 36 ? (
                                                        <ThemedText
                                                            type="small"
                                                            style={styles.eventTime}
                                                            numberOfLines={1}>
                                                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                                                        </ThemedText>
                                                    ) : null}
                                                    {hasNote ? (
                                                        <ThemedText style={styles.noteIcon}>📝</ThemedText>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>
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
    custodyBand: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    custodyLabelCell: {
        justifyContent: 'center',
        paddingLeft: Spacing.one,
    },
    custodyCell: {
        flex: 1,
        paddingVertical: 3,
        paddingHorizontal: 4,
        marginHorizontal: 1,
        marginVertical: 2,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    custodyCellText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
    eventTime: { color: '#fff', fontSize: 11, opacity: 0.9 },
    noteIcon: { position: 'absolute', top: 2, right: 4, fontSize: 10 },
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
