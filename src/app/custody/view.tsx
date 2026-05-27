// /custody/view — Read-only custody schedule for caregiver + external
// co-parent viewers (#397/#398).
//
// Mirrors /custody/schedule's 4-week visualization but strips:
//   • Pattern button (top bar)
//   • "+ New override" FAB
//   • Pending swap-request section (caregivers can't act; external
//     co-parents aren't part of the household's swap loop)
//   • Long-press → /custody/[date] override editor (read-only viewers
//     can't write overrides — RLS would reject anyway, but cleanest to
//     not surface the affordance)
//
// External viewers (`?childId=...`) further scope the view to a single
// kid: only that kid's resolved schedule renders (the household's
// other kids stay private). The legend and 4-week strip use the same
// CustodyStripToday color-resolution rules — in-household parent on
// the household side, external viewer's identity color on theirs.
//
// Caregivers see the household-wide 4-week strip exactly as a co-parent
// would, just without the editor affordances and with a VIEWING badge
// in the top bar.

import { Feather } from '@expo/vector-icons';
import { addDays, format, startOfWeek } from 'date-fns';
import {
    Redirect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustodyWeekBar } from '@/components/custody/custody-week-bar';
import { RoleBadge } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useCurrentWeekCustody } from '@/hooks/use-current-week-custody';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import {
    buildOverrideMap,
    findPattern,
    resolveCustodianOnDate,
} from '@/lib/custody';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { getMyExternalCoparentLinks } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

const WEEKS_TO_SHOW = 4;

const HANDOFF_DAY_NAMES = [
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
    'SUN',
] as const;

export default function CustodyViewScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const { childId } = useLocalSearchParams<{ childId?: string }>();

    // External viewer resolution: if a childId is in the URL, look it
    // up to find the household + viewer's external color. External
    // viewers might not be a `useHouseholds` member of the household
    // their linked kid lives in.
    const [externalContext, setExternalContext] = useState<{
        household_id: string;
        color: string | null;
    } | null>(null);
    useEffect(() => {
        if (!childId) {
            setExternalContext(null);
            return;
        }
        let cancelled = false;
        getMyExternalCoparentLinks().then((rows) => {
            if (cancelled) return;
            const link = rows.find((r) => r.child_id === childId);
            setExternalContext(
                link
                    ? {
                          household_id: link.household_id,
                          color: link.color,
                      }
                    : null,
            );
        });
        return () => {
            cancelled = true;
        };
    }, [childId]);

    // Household resolution: external viewers use the link's household;
    // caregivers + co-parents use their first household (existing
    // model). When the external link hasn't resolved yet, render the
    // loading screen until it does.
    const isExternal = !!childId;
    const resolvedHouseholdId =
        externalContext?.household_id ?? households?.[0]?.id;
    const household = isExternal
        ? null
        : households?.[0] ?? null;

    const { schedule, isLoading: scheduleLoading } = useCustodySchedule(
        resolvedHouseholdId,
    );
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        resolvedHouseholdId,
    );
    const { children: childrenList } = useChildren(resolvedHouseholdId);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(
        resolvedHouseholdId,
    );

    const currentWeek = useCurrentWeekCustody(resolvedHouseholdId);
    const nextHandoff = currentWeek?.nextHandoff ?? null;

    // 4-week window starting from this week's Monday.
    const weekStart = useMemo(
        () => startOfWeek(new Date(), { weekStartsOn: 1 }),
        [],
    );
    const rangeEnd = useMemo(
        () => addDays(weekStart, WEEKS_TO_SHOW * 7 - 1),
        [weekStart],
    );
    const { overrides } = useCustodyOverrides(
        resolvedHouseholdId,
        weekStart,
        rangeEnd,
    );

    const weeks = useMemo(() => {
        if (!schedule) return [];
        const overrideMap = buildOverrideMap(overrides ?? []);
        return Array.from({ length: WEEKS_TO_SHOW }, (_, w) => {
            const wkStart = addDays(weekStart, w * 7);
            const days = Array.from({ length: 7 }, (_, d) =>
                resolveCustodianOnDate(
                    schedule,
                    overrideMap,
                    addDays(wkStart, d),
                ),
            );
            return { start: wkStart, days };
        });
    }, [schedule, overrides, weekStart]);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        scheduleLoading ||
        roleLoading ||
        (isExternal && externalContext === null && childId)
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    // External viewer needs a linked kid; if the lookup returns null,
    // either the link doesn't exist or RLS hid it. Either way, bounce.
    if (isExternal && !externalContext) {
        return <Redirect href="/" />;
    }
    if (!resolvedHouseholdId) {
        return <Redirect href="/" />;
    }
    if (!isExternal && !household) {
        return <Redirect href="/create-household" />;
    }

    const colorMap = memberColorMap(members ?? []);
    const pattern = findPattern(schedule?.pattern_id ?? null);
    const patternLabel = pattern?.label ?? 'No pattern';
    const handoffDayLabel = schedule
        ? HANDOFF_DAY_NAMES[schedule.handoff_day_index] ?? 'SUN'
        : 'SUN';
    const handoffTimeLabel = schedule
        ? schedule.handoff_time.slice(0, 5)
        : '18:00';

    // External viewer's identity color resolution — patch the color
    // map so the viewer's day shows their own color rather than the
    // UNASSIGNED fallback (same trick CustodyStripToday uses).
    const externalFallbackColor = colors.accent;
    const externalColor =
        externalContext?.color || externalFallbackColor;
    const resolveDayColor = (profileId: string | null): string => {
        if (isExternal && profileId === user?.id) return externalColor;
        return colorForResponsible(profileId, colorMap);
    };

    const stripChild = isExternal && childId
        ? (childrenList ?? []).find((c) => c.id === childId) ?? null
        : null;

    // Subtitle — for caregivers: "Alex is on duty this week. Hand-off
    // Sunday at 18:00." For external viewers: "<Kid>'s schedule.
    // Hand-off Sunday at 18:00."
    const currentMember = (members ?? []).find(
        (m) => m.profile_id === currentWeek?.weekCustody.currentParentId,
    );
    const subtitleSentence1 = isExternal
        ? stripChild
            ? `${stripChild.display_name}'s schedule.`
            : 'Schedule.'
        : currentWeek?.weekCustody.bothPresent
          ? 'Together this week.'
          : currentMember
            ? `${currentMember.display_name} is on duty this week.`
            : 'Schedule.';
    const subtitleSentence2 = nextHandoff
        ? `Hand-off ${format(nextHandoff.at, 'EEEE')} at ${format(nextHandoff.at, 'HH:mm')}.`
        : '';

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar — back chevron + CUSTODY pretitle + VIEWING
                    badge anchored right (no Pattern button). */}
                <View
                    style={[
                        styles.topBar,
                        { borderBottomColor: colors.hair },
                    ]}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.backBtn,
                            pressed && styles.pressed,
                        ]}>
                        <Feather
                            name="chevron-left"
                            size={20}
                            color={colors.text}
                        />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.topPretitle,
                            {
                                color: colors.inkSec,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        CUSTODY
                    </ThemedText>
                    <View style={{ flex: 1 }} />
                    <RoleBadge kind="viewing" />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Pattern summary line — caregivers see the
                        household's pattern; external co-parents see it
                        too (they need to know what schedule applies to
                        their kid). */}
                    <ThemedText
                        style={[
                            styles.patternLine,
                            {
                                color: colors.inkSec,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        PATTERN · {patternLabel.toUpperCase()} · HANDOFF{' '}
                        {handoffDayLabel} {handoffTimeLabel}
                    </ThemedText>

                    {/* Title + subtitle — same hierarchy as the editor
                        view; just the read-only framing. */}
                    <ThemedText
                        style={[styles.title, { color: colors.text }]}>
                        Schedule
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.subtitle,
                            { color: colors.inkSec },
                        ]}>
                        {subtitleSentence1}{' '}
                        <ThemedText
                            style={{
                                fontFamily: FontFamily.monoMedium,
                                color: colors.inkSec,
                            }}>
                            {subtitleSentence2}
                        </ThemedText>
                    </ThemedText>

                    {/* Legend — parents + external co-parent (when
                        viewer is external). The external viewer needs
                        to see THEIR identity color in the legend so the
                        4-week strip's color tracks back to "you". */}
                    <View style={styles.legend}>
                        {(members ?? [])
                            .filter((m) => m.role === 'parent')
                            .map((m) => {
                                const c = colorForResponsible(
                                    m.profile_id,
                                    colorMap,
                                );
                                return (
                                    <View
                                        key={m.profile_id}
                                        style={styles.legendRow}>
                                        <View
                                            style={[
                                                styles.legendDot,
                                                { backgroundColor: c },
                                            ]}
                                        />
                                        <ThemedText
                                            style={[
                                                styles.legendLabel,
                                                { color: colors.text },
                                            ]}>
                                            {m.display_name}
                                        </ThemedText>
                                    </View>
                                );
                            })}
                        {isExternal && user ? (
                            <View style={styles.legendRow}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        {
                                            backgroundColor:
                                                externalColor,
                                        },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.legendLabel,
                                        { color: colors.text },
                                    ]}>
                                    You
                                </ThemedText>
                            </View>
                        ) : null}
                    </View>

                    {/* 4-week visualization — same CustodyWeekBar
                        primitive as the editor's view, just static
                        (no onPress / no long-press editor). */}
                    <View
                        style={[
                            styles.weeksCard,
                            {
                                backgroundColor:
                                    colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {weeks.map((wk, wIdx) => (
                            <View key={wIdx} style={styles.weekRow}>
                                <ThemedText
                                    style={[
                                        styles.weekLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {format(wk.start, 'MMM d')}
                                </ThemedText>
                                <View style={{ flex: 1 }}>
                                    <CustodyWeekBar
                                        days={wk.days.map((r) => ({
                                            color: r.bothPresent
                                                ? colors.shared
                                                : resolveDayColor(
                                                      r.profileId,
                                                  ),
                                        }))}
                                        size="sm"
                                    />
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Footer hint — the editor's hint reads "Tap
                        Pattern to change · Long-press a day for one-off
                        swap." Both affordances are gone here, so the
                        hint reads differently for read-only viewers. */}
                    <ThemedText
                        style={[
                            styles.footerHint,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        {isCaregiver
                            ? 'READ-ONLY · CHANGES MADE BY PARENTS'
                            : isExternal
                              ? 'READ-ONLY · HOUSEHOLD MANAGES THE SCHEDULE'
                              : 'READ-ONLY'}
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topPretitle: {
        fontSize: 11,
        letterSpacing: 0.4,
    },
    pressed: { opacity: 0.7 },

    scroll: {
        padding: 16,
        paddingBottom: 32,
    },

    patternLine: {
        fontSize: 11,
        letterSpacing: 0.3,
        marginBottom: 14,
    },
    title: {
        fontSize: 26,
        fontWeight: '600',
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 13.5,
        marginTop: 6,
        marginBottom: 16,
        lineHeight: 20,
    },

    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 14,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontSize: 12.5,
        fontWeight: '500',
    },

    weeksCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 12,
    },
    weekRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    weekLabel: {
        width: 56,
        fontSize: 11,
        letterSpacing: 0.2,
    },

    footerHint: {
        fontSize: 10,
        letterSpacing: 0.3,
        marginTop: 18,
        textAlign: 'center',
    },
});
