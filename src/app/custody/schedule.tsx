// CustodyScheduleV2 — full-screen schedule viewer per design source
// (screens-custody.jsx CustodyScheduleV2 ~17-162) + README "Change 3".
//
// Layout, top to bottom:
//   1. Top bar — back chevron · "CUSTODY" mono pretitle · "Pattern" text
//      button with gear glyph (routes to /custody/pattern)
//   2. Pattern summary line: PATTERN · <NAME> · HANDOFF <DAY> <TIME>
//   3. "Schedule" 26/600 title + body subtitle (current parent + next hand-off)
//   4. Legend — dot + label per parent (external co-parents marked subtle)
//   5. 4-week visualization card — each week's 7-day strip with NOW marker
//   6. Footer hint: "Tap Pattern to change · Long-press a day for one-off swap"
//   7. Sticky "+ New override" FAB
//
// /settings/custody redirects here (Stage 6). Per-day long-press still
// opens the existing /custody/[date] override editor.

import { Feather } from '@expo/vector-icons';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustodyWeekBar } from '@/components/custody/custody-week-bar';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily } from '@/constants/theme';
import { useCurrentWeekCustody } from '@/hooks/use-current-week-custody';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { useSwapRequests } from '@/hooks/use-swap-requests';
import {
    buildOverrideMap,
    custodyScopeWord,
    findPattern,
    handoffsWithinWeek,
    resolveCustodianOnDate,
} from '@/lib/custody';
import {
    colorForResponsible,
    memberColorMap,
} from '@/lib/colors';
import { decideSwapRequest } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { withAlpha } from '@/lib/platform-styles';
import { HEAVY_FAB_SHADOW } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

const WEEKS_TO_SHOW = 4;

export default function CustodyScheduleScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const householdType = household?.household_type ?? 'separated';
    const { schedule, isLoading: scheduleLoading } = useCustodySchedule(
        household?.id,
    );
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // Next hand-off info for the subtitle's second sentence. README +
    // design source render two sentences: current-week parent, then
    // "Hand-off Sunday May 31 at 18:00." The hook already computes the
    // next transition so we can read it directly rather than walking
    // the resolver again.
    const currentWeek = useCurrentWeekCustody(household?.id);
    const nextHandoff = currentWeek?.nextHandoff ?? null;

    // Pending swap requests (#372). Read-only Pending section at the
    // top of the schedule; full accept/decline review screen is #399.
    // Exclude the viewer's own requests — the "Co-parent requested a
    // swap" framing is wrong when the viewer IS the requester (audit
    // HIGH-2). #399 will own the awaiting-decision affordance.
    //
    // Caregivers see no Pending section (post-fix audit MEDIUM): they
    // can read swap_requests via RLS but can't act, and the banner copy
    // doesn't fit them. Mirrors the Pattern-button gate on this surface
    // and the Family Hub banner gate. Pass undefined to short-circuit
    // the hook's fetch entirely.
    const {
        requests: pendingSwapsRaw,
        refetch: refetchSwaps,
    } = useSwapRequests(
        isCaregiver ? undefined : household?.id,
        'pending',
    );
    const pendingSwaps = useMemo(
        () =>
            (pendingSwapsRaw ?? []).filter(
                (s) => s.requested_by_profile_id !== user?.id,
            ),
        [pendingSwapsRaw, user?.id],
    );

    // Deep-link from Family Hub's swap banner: `?focus=pending` scrolls
    // the Pending section into view. We snapshot the param once on
    // mount + scroll the ScrollView ref to the section's measured y
    // after first paint (a single setTimeout to give the layout pass
    // time to settle).
    const { focus } = useLocalSearchParams<{ focus?: string }>();
    const scrollRef = useRef<ScrollView | null>(null);
    const pendingSectionYRef = useRef(0);
    // MEDIUM #22 fix: re-run when `pendingSwaps` changes so a slow fetch
    // doesn't miss the scroll. Previously a single 200ms timeout would
    // fire before the section had rendered + measured its y on networks
    // slower than that, leaving the deep link a no-op. Now we wait until
    // there's actually a pending row to scroll to, then a short delay
    // for the onLayout to capture the y, then scroll.
    useEffect(() => {
        if (focus !== 'pending') return;
        if (pendingSwaps.length === 0) return;
        const t = setTimeout(() => {
            scrollRef.current?.scrollTo({
                y: pendingSectionYRef.current,
                animated: true,
            });
        }, 200);
        return () => clearTimeout(t);
    }, [focus, pendingSwaps.length]);

    // Per-row decision state (#399). Tracks the request id currently
    // being acted on so the inline Accept / Decline buttons render a
    // disabled state while the RPC is in-flight. Once it settles we
    // refetch via the hook's refetch — the resolved row drops out of
    // the pending query (status flips to accepted/declined) and the
    // section count goes down.
    const [decidingId, setDecidingId] = useState<string | null>(null);
    const onDecideSwap = async (
        swapId: string,
        decision: 'accepted' | 'declined',
    ) => {
        setDecidingId(swapId);
        try {
            await decideSwapRequest(swapId, decision);
            await refetchSwaps();
        } catch (err) {
            Alert.alert(
                "Couldn't update swap request",
                errorMessage(err),
            );
        } finally {
            setDecidingId(null);
        }
    };
    const onConfirmAccept = (swapId: string, requesterName: string) => {
        Alert.alert(
            'Accept swap?',
            `${requesterName} requested this swap. Accepting marks the request approved; you'll still need to add the matching override in /custody to update the schedule itself (#399 follow-up will auto-apply).`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: () => onDecideSwap(swapId, 'accepted'),
                },
            ],
        );
    };
    const onConfirmDecline = (swapId: string, requesterName: string) => {
        Alert.alert(
            'Decline swap?',
            `${requesterName} will be notified that you didn't accept this swap.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: () => onDecideSwap(swapId, 'declined'),
                },
            ],
        );
    };

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
        household?.id,
        weekStart,
        rangeEnd,
    );

    const weeks = useMemo(() => {
        if (!schedule) return [];
        const overrideMap = buildOverrideMap(overrides ?? []);
        // Resolve weeks + a 1-day lookahead so the right-edge hand-off
        // on the last week's Sunday isn't missed. The lookahead lives
        // outside the rendered window — it just feeds handoffsWithinWeek
        // for the final week.
        const buildWeek = (offset: number) =>
            Array.from({ length: 7 }, (_, d) =>
                resolveCustodianOnDate(
                    schedule,
                    overrideMap,
                    addDays(weekStart, offset * 7 + d),
                ),
            );
        const lookahead = resolveCustodianOnDate(
            schedule,
            overrideMap,
            addDays(weekStart, WEEKS_TO_SHOW * 7),
        );
        const built = Array.from({ length: WEEKS_TO_SHOW }, (_, w) => ({
            start: addDays(weekStart, w * 7),
            days: buildWeek(w),
        }));
        return built.map((wk, i) => {
            const nextDay =
                i + 1 < built.length ? built[i + 1].days[0] : lookahead;
            return {
                ...wk,
                handoffIndices: handoffsWithinWeek(wk.days, nextDay),
            };
        });
    }, [schedule, overrides, weekStart]);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        scheduleLoading ||
        roleLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Custody UI is only meaningful for separated households (the same
    // household_type gate the legacy /settings/custody used).
    if (householdType !== 'separated') {
        return <Redirect href="/family" />;
    }

    const colorMap = memberColorMap(members ?? []);
    const pattern = findPattern(schedule?.pattern_id ?? null);
    const patternLabel = pattern?.label ?? 'No pattern';

    // Hand-off summary string for the pattern line. Reads the real
    // schedule fields (Phase 2 columns from migration 0048, default
    // normalized to Sunday by 0049); previously hardcoded "SUN 18:00"
    // which silently lied to households that had picked a different day
    // or time in the editor.
    //
    // Day-index convention is Monday-first (0049): cell 0 = M, cell 6 = S.
    // The viewer's display order mirrors the editor + design source.
    const HANDOFF_DAY_NAMES = [
        'MON',
        'TUE',
        'WED',
        'THU',
        'FRI',
        'SAT',
        'SUN',
    ] as const;
    const handoffDayLabel = schedule
        ? HANDOFF_DAY_NAMES[schedule.handoff_day_index] ?? 'SUN'
        : 'SUN';
    const handoffTimeLabel = schedule
        ? schedule.handoff_time.slice(0, 5)
        : '18:00';

    // Now-week current parent + next hand-off summary for the subtitle.
    const today = new Date();
    const overrideMap = buildOverrideMap(overrides ?? []);
    const currentParent = schedule
        ? resolveCustodianOnDate(schedule, overrideMap, today).profileId
        : null;
    const currentMember = (members ?? []).find(
        (m) => m.profile_id === currentParent,
    );

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar */}
                <View style={styles.topBar}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.iconBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather
                            name="chevron-left"
                            size={14}
                            color={colors.text}
                        />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.pretitle,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        CUSTODY
                    </ThemedText>
                    {!isCaregiver ? (
                        <Pressable
                            onPress={() => router.push('/custody/pattern')}
                            accessibilityRole="button"
                            accessibilityLabel="Edit custody pattern"
                            style={({ pressed }) => [
                                styles.patternBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            {/* Gear glyph at 40% opacity per design — the
                                word "Pattern" carries the affordance. */}
                            <View style={{ opacity: 0.4 }}>
                                <Feather
                                    name="settings"
                                    size={11}
                                    color={colors.text}
                                />
                            </View>
                            <ThemedText
                                style={[
                                    styles.patternBtnText,
                                    {
                                        color: colors.text,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                PATTERN
                            </ThemedText>
                        </Pressable>
                    ) : (
                        // Caregivers see no Pattern affordance (RLS blocks
                        // schedule writes); 32px spacer keeps the centered
                        // pretitle on-center.
                        <View style={styles.iconBtn} />
                    )}
                </View>

                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.scroll}>
                    {/* Pending swap requests (#372). Read-only summary at
                        the top of the schedule — full accept/decline lives
                        in #399. Layout-onLayout captures the section's y
                        so the Family Hub banner can deep-link straight to
                        it via /custody/schedule?focus=pending. */}
                    {(pendingSwaps ?? []).length > 0 ? (
                        <View
                            onLayout={(e) => {
                                pendingSectionYRef.current =
                                    e.nativeEvent.layout.y;
                            }}
                            style={[
                                styles.pendingSection,
                                {
                                    backgroundColor: withAlpha(
                                        colors.warn,
                                        0.07,
                                    ),
                                    borderColor: withAlpha(
                                        colors.warn,
                                        0.27,
                                    ),
                                },
                            ]}>
                            <View style={styles.pendingHeader}>
                                <Feather
                                    name="repeat"
                                    size={13}
                                    color={colors.warn}
                                />
                                <ThemedText
                                    style={[
                                        styles.pendingLabel,
                                        {
                                            color: colors.warn,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    PENDING SWAPS · {(pendingSwaps ?? []).length}
                                </ThemedText>
                            </View>
                            {(pendingSwaps ?? []).map((s) => {
                                const requester = (members ?? []).find(
                                    (m) =>
                                        m.profile_id ===
                                        s.requested_by_profile_id,
                                );
                                const sameDay = s.from_date === s.to_date;
                                // parseISO treats YYYY-MM-DD as local
                                // midnight (CRITICAL #4) so the rendered
                                // date doesn't roll back a day in
                                // timezones west of UTC.
                                const range = sameDay
                                    ? format(parseISO(s.from_date), 'EEE MMM d')
                                    : `${format(parseISO(s.from_date), 'EEE MMM d')}–${format(parseISO(s.to_date), 'EEE MMM d')}`;
                                const requesterName =
                                    requester?.display_name ?? 'Co-parent';
                                const isDeciding = decidingId === s.id;
                                return (
                                    <View
                                        key={s.id}
                                        style={styles.pendingRow}>
                                        <ThemedText
                                            numberOfLines={2}
                                            style={[
                                                styles.pendingRowText,
                                                { color: colors.text },
                                            ]}>
                                            <ThemedText
                                                style={{
                                                    fontWeight: '600',
                                                }}>
                                                {requesterName}
                                            </ThemedText>{' '}
                                            requested a swap ·{' '}
                                            <ThemedText
                                                style={{
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                    color: colors.inkSec,
                                                }}>
                                                {range}
                                            </ThemedText>
                                        </ThemedText>
                                        {s.note ? (
                                            <ThemedText
                                                numberOfLines={2}
                                                style={[
                                                    styles.pendingRowNote,
                                                    {
                                                        color: colors.inkFaint,
                                                    },
                                                ]}>
                                                "{s.note}"
                                            </ThemedText>
                                        ) : null}
                                        {/* Decide buttons (#399). Two
                                            pressables: outlined Decline
                                            on the left, accent-tinted
                                            Accept on the right. Both
                                            disabled mid-flight. */}
                                        <View
                                            style={styles.pendingActionsRow}>
                                            <Pressable
                                                onPress={() =>
                                                    onConfirmDecline(
                                                        s.id,
                                                        requesterName,
                                                    )
                                                }
                                                disabled={isDeciding}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Decline ${requesterName}'s swap request`}
                                                style={({ pressed }) => [
                                                    styles.declineBtn,
                                                    {
                                                        backgroundColor:
                                                            colors.backgroundElement,
                                                        borderColor:
                                                            colors.hair,
                                                    },
                                                    isDeciding && {
                                                        opacity: 0.4,
                                                    },
                                                    pressed &&
                                                        !isDeciding &&
                                                        styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    style={[
                                                        styles.declineBtnText,
                                                        {
                                                            color: colors.text,
                                                        },
                                                    ]}>
                                                    Decline
                                                </ThemedText>
                                            </Pressable>
                                            <Pressable
                                                onPress={() =>
                                                    onConfirmAccept(
                                                        s.id,
                                                        requesterName,
                                                    )
                                                }
                                                disabled={isDeciding}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Accept ${requesterName}'s swap request`}
                                                style={({ pressed }) => [
                                                    styles.acceptBtn,
                                                    {
                                                        backgroundColor:
                                                            colors.accent,
                                                    },
                                                    isDeciding && {
                                                        opacity: 0.4,
                                                    },
                                                    pressed &&
                                                        !isDeciding &&
                                                        styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    style={[
                                                        styles.acceptBtnText,
                                                        {
                                                            color: colors.onAccent,
                                                        },
                                                    ]}>
                                                    {isDeciding
                                                        ? 'Saving…'
                                                        : 'Accept'}
                                                </ThemedText>
                                            </Pressable>
                                        </View>
                                    </View>
                                );
                            })}
                            {/* Footer hint — sets expectations for the
                                accept-side flow. Accepting flips the
                                request status; the override still has
                                to be added manually until the
                                auto-apply follow-up ships. */}
                            <ThemedText
                                style={[
                                    styles.pendingHint,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                ACCEPT MARKS APPROVED · OVERRIDE STILL
                                MANUAL
                            </ThemedText>
                        </View>
                    ) : null}

                    {/* Pattern summary */}
                    <View style={styles.summary}>
                        <ThemedText
                            style={[
                                styles.summaryLabel,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            PATTERN · {patternLabel.toUpperCase()} · HANDOFF{' '}
                            {handoffDayLabel} {handoffTimeLabel}
                        </ThemedText>
                        <ThemedText
                            style={[styles.title, { color: colors.text }]}>
                            Schedule
                        </ThemedText>
                        <ThemedText
                            style={[
                                styles.subtitle,
                                { color: colors.inkSec },
                            ]}>
                            {(() => {
                                // #491 follow-up: pattern-aware scope word.
                                // 7-7 = "this week" (one parent owns the
                                // whole week). Every other pattern uses
                                // "today" because the kids switch within
                                // the week — "Alex's week this week" lies
                                // about half the days on 2-2-3 etc.
                                const scope = custodyScopeWord(
                                    schedule?.pattern_id,
                                );
                                if (!currentMember) {
                                    return scope === 'this week'
                                        ? 'This week.'
                                        : 'Today.';
                                }
                                return scope === 'this week'
                                    ? `${currentMember.display_name}'s week this week.`
                                    : `${currentMember.display_name} has the kids today.`;
                            })()}
                            {/* Second design sentence — "Hand-off Sunday
                                May 31 at 18:00." MEDIUM finding from the
                                audit: previously dropped, leaving the
                                subtitle thinner than the design source. */}
                            {nextHandoff
                                ? ` Hand-off ${format(nextHandoff.at, 'EEEE MMM d')} at ${format(nextHandoff.at, 'HH:mm')}.`
                                : null}
                        </ThemedText>
                    </View>

                    {/* Legend — one dot per household member (parents only).
                        We surface all members rather than just the
                        schedule's two parents because external co-parents
                        often appear in the bars via overrides. */}
                    <View style={styles.legend}>
                        {(members ?? []).slice(0, 4).map((m) => (
                            <LegendDot
                                key={m.profile_id}
                                color={colorForResponsible(
                                    m.profile_id,
                                    colorMap,
                                )}
                                label={m.display_name}
                                palette={colors}
                            />
                        ))}
                    </View>

                    {/* 4-week visualization */}
                    <View style={styles.weeksWrap}>
                        <View
                            style={[
                                styles.weeksCard,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            {weeks.map((w, i) => {
                                const isCurrentWeek =
                                    w.start.getTime() === weekStart.getTime();
                                const isLast = i === weeks.length - 1;
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.weekBlock,
                                            i > 0 && { paddingTop: 14 },
                                            !isLast && {
                                                paddingBottom: 14,
                                                borderBottomColor:
                                                    colors.hair,
                                                borderBottomWidth:
                                                    StyleSheet.hairlineWidth,
                                            },
                                        ]}>
                                        <View style={styles.weekHeader}>
                                            <ThemedText
                                                style={[
                                                    styles.weekLabel,
                                                    {
                                                        color: isCurrentWeek
                                                            ? colors.accent
                                                            : colors.inkSec,
                                                        fontFamily:
                                                            FontFamily.monoMedium,
                                                        fontWeight:
                                                            isCurrentWeek
                                                                ? '600'
                                                                : '500',
                                                    },
                                                ]}>
                                                {format(w.start, 'MMM d')} –{' '}
                                                {format(
                                                    addDays(w.start, 6),
                                                    'd',
                                                )}
                                                {isCurrentWeek ? ' · NOW' : ''}
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    styles.weekNumber,
                                                    {
                                                        color: colors.inkFaint,
                                                        fontFamily:
                                                            FontFamily.monoMedium,
                                                    },
                                                ]}>
                                                Wk {isoWeekNumber(w.start)}
                                            </ThemedText>
                                        </View>
                                        <CustodyWeekBar
                                            days={w.days.map((r) => ({
                                                // 'AB' both-present days
                                                // (#379) → `shared` token
                                                // (post-fix audit bumped
                                                // from accentSoft for dark
                                                // mode contrast).
                                                color: r.bothPresent
                                                    ? colors.shared
                                                    : colorForResponsible(
                                                          r.profileId,
                                                          colorMap,
                                                      ),
                                            }))}
                                            // #493: warn ticks at every
                                            // actual cycle transition,
                                            // not just the next hand-off
                                            // — lets the user see WHEN
                                            // the rotation flips while
                                            // scrolling future weeks.
                                            handoffIndices={w.handoffIndices}
                                            size="lg"
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Footer hint pre-empts the "how do I move just one
                        weekend?" support question per README. */}
                    <View style={styles.footerHint}>
                        <Feather
                            name="info"
                            size={13}
                            color={colors.inkFaint}
                        />
                        <ThemedText
                            style={[
                                styles.footerHintText,
                                { color: colors.inkFaint },
                            ]}>
                            Tap{' '}
                            <ThemedText
                                style={{
                                    color: colors.text,
                                    fontFamily: FontFamily.monoSemiBold,
                                }}>
                                Pattern
                            </ThemedText>{' '}
                            to change the alternation rule or handoff time.
                            Long-press a day to add a one-off swap.
                        </ThemedText>
                    </View>
                </ScrollView>

                {/* Sticky "+ New override" FAB */}
                {!isCaregiver ? (
                    <Pressable
                        onPress={() => {
                            // Open today's override editor; the existing
                            // /custody/[date] modal handles new-vs-edit.
                            const todayKey = format(
                                new Date(),
                                'yyyy-MM-dd',
                            );
                            router.push({
                                pathname: '/custody/[date]',
                                params: { date: todayKey },
                            });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="New custody override"
                        style={({ pressed }) => [
                            styles.fab,
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
                                styles.fabText,
                                { color: colors.onAccent },
                            ]}>
                            New override
                        </ThemedText>
                    </Pressable>
                ) : null}
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

function LegendDot({
    color,
    label,
    palette,
}: {
    color: string;
    label: string;
    palette: Palette;
}) {
    return (
        <View style={styles.legendDot}>
            <View
                style={[
                    styles.legendDotChip,
                    { backgroundColor: color },
                ]}
            />
            <ThemedText
                style={[
                    styles.legendDotLabel,
                    {
                        color: palette.inkSec,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {label}
            </ThemedText>
        </View>
    );
}

function isoWeekNumber(date: Date): number {
    const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );
}

// Silence unused — withAlpha kept on imports for future legend tint work.
void withAlpha;

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 100 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pretitle: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    patternBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    patternBtnText: {
        fontSize: 10,
        letterSpacing: 0.3,
        fontWeight: '600',
    },

    summary: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 6 },
    summaryLabel: {
        fontSize: 11,
        letterSpacing: -0.2,
        marginBottom: 4,
    },
    title: {
        fontSize: 26,
        fontWeight: '600',
        letterSpacing: -0.9,
        lineHeight: 28,
    },
    subtitle: {
        fontSize: 12.5,
        marginTop: 6,
        lineHeight: 18,
    },

    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 14,
    },
    legendDot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDotChip: { width: 10, height: 10, borderRadius: 3 },
    legendDotLabel: { fontSize: 11, letterSpacing: -0.2 },

    weeksWrap: { paddingHorizontal: 16 },
    weeksCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        overflow: 'hidden',
    },
    weekBlock: {},
    weekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekLabel: { fontSize: 11, letterSpacing: -0.2 },
    weekNumber: { fontSize: 10 },

    // Pending swap requests section (#372). Sits at the top of the
    // scrollable content. Warn-tinted card mirrors the Family Hub
    // banner's vocabulary so the deep-link feels visually continuous.
    pendingSection: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    pendingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pendingLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
    },
    pendingRow: {
        gap: 4,
    },
    pendingRowText: {
        fontSize: 13,
        letterSpacing: -0.2,
        lineHeight: 18,
    },
    pendingRowNote: {
        fontSize: 12,
        letterSpacing: -0.1,
        lineHeight: 16,
        fontStyle: 'italic',
    },
    // Per-row Accept / Decline action strip (#399). Decline sits on
    // the left as the outlined secondary; Accept on the right as the
    // accent-tinted primary. Mirrors the standard "destructive on left,
    // affirmative on right" two-button row pattern used elsewhere.
    pendingActionsRow: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    declineBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    declineBtnText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    acceptBtn: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptBtnText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    pendingHint: {
        fontSize: 9,
        letterSpacing: 0.4,
        marginTop: 4,
    },
    footerHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingTop: 12,
    },
    footerHintText: {
        flex: 1,
        fontSize: 11,
        lineHeight: 16,
    },

    fab: {
        position: 'absolute',
        right: 16,
        bottom: 28,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        ...HEAVY_FAB_SHADOW,
    },
    fabText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },

    pressed: { opacity: 0.7 },
});
