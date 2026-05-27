// /conflict/[id] — ConflictResolution screen scaffold.
//
// Reached from every surface that signals a conflict per the v3 spec
// (onenest-spec-v3/design_handoff_calendar_conflicts §The conflict-
// resolver access rule):
//   • Event detail's CONFLICT chip (wired in this pass)
//   • Calendar week/day event blocks' warn-bug badge (deferred —
//     requires wiring conflict detection into calendar.tsx; tracked
//     as a follow-up)
//   • Calendar month cells' warn dot (deferred — same follow-up)
//   • Notifications inbox conflict rows
//   • Event overflow sheet's "Reassign across custody" action
//
// This is a SCAFFOLD. The full conflict-resolution UX (move event,
// reassign across custody, accept other parent's swap, etc.) is the
// Phase 12 / #299 work. Until that lands, this screen shows the
// what-conflicts-with-what context plus three escape hatches:
//   • Open the event detail (resolve it via the existing inline ribbon)
//   • Open the conflicting event's detail
//   • Dismiss (just close the modal — no destructive state change)
//
// Param: `id` is the event id whose conflict the user tapped into.

import { Feather } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useEvent } from '@/hooks/use-event';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { memberColorMap } from '@/lib/colors';
import { withAlpha } from '@/lib/platform-styles';
import type { Conflict } from '@/lib/summary';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function ConflictResolutionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { event, isLoading: eventLoading } = useEvent(id);
    const { members } = useHouseholdMembers(household?.id);
    const { summary, isLoading: summaryLoading } = useWeekSummary(
        household?.id,
    );

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    // Find every conflict entry that names this event. WeekSummary's
    // model emits one row per (event, opposing party) pair, so a single
    // event may have multiple conflicts (e.g. overlaps two different
    // busy blocks). We render the full list — the user might need to
    // resolve each one separately.
    //
    // We also include conflicts where this event is the *other* side
    // (`withEvent.id === id`) so navigation from either direction shows
    // the same context.
    const relevantConflicts = useMemo<Conflict[]>(() => {
        if (!summary || !id) return [];
        return summary.conflicts.filter(
            (c) => c.event.id === id || c.withEvent?.id === id,
        );
    }, [summary, id]);

    // Once the data has loaded once, remember it — re-fetches during
    // navigation should not bounce the user out via the Redirect below.
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const stillLoading =
        authLoading || householdsLoading || eventLoading || summaryLoading;
    useEffect(() => {
        if (!stillLoading && event) setHasLoadedOnce(true);
    }, [stillLoading, event]);

    if (stillLoading && !hasLoadedOnce) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (hasLoadedOnce && !event) return <Redirect href="/" />;
    if (!event) return <LoadingScreen />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar — back chevron + "Resolve conflict" title. */}
                <View style={styles.topBar}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.topBarBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather
                            name="chevron-left"
                            size={16}
                            color={colors.text}
                        />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.topBarTitle,
                            { color: colors.text },
                        ]}>
                        Resolve conflict
                    </ThemedText>
                    <View style={styles.topBarBtnSpacer} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    {/* Warn hero — explains what's conflicting. Soft warn
                        tint + alert-triangle icon mirrors the design
                        language used by the chip / ribbon. */}
                    <View
                        style={[
                            styles.warnCard,
                            {
                                backgroundColor: withAlpha(
                                    colors.warn,
                                    0.1,
                                ),
                                borderColor: withAlpha(colors.warn, 0.4),
                                borderLeftColor: colors.warn,
                            },
                        ]}>
                        <Feather
                            name="alert-triangle"
                            size={18}
                            color={colors.warn}
                            style={styles.warnIcon}
                        />
                        <View style={styles.warnBody}>
                            <ThemedText
                                style={[
                                    styles.warnTitle,
                                    {
                                        color: colors.text,
                                    },
                                ]}>
                                {event.title}
                            </ThemedText>
                            <ThemedText
                                style={[
                                    styles.warnSubtitle,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoRegular,
                                    },
                                ]}>
                                {relevantConflicts.length === 0
                                    ? 'No active conflicts on this event.'
                                    : `${relevantConflicts.length} ${
                                          relevantConflicts.length === 1
                                              ? 'conflict'
                                              : 'conflicts'
                                      } detected within the next 7 days.`}
                            </ThemedText>
                        </View>
                    </View>

                    {/* Per-conflict rows. Each lists the kind of conflict
                        (event-vs-event vs event-vs-external-busy) and an
                        affordance to open the other side if applicable. */}
                    {relevantConflicts.length > 0 ? (
                        <View style={styles.section}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                WHAT'S CONFLICTING
                            </ThemedText>
                            <View
                                style={[
                                    styles.conflictsCard,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {relevantConflicts.map((c, idx) => {
                                    const isLast =
                                        idx === relevantConflicts.length - 1;
                                    const otherEvent =
                                        c.event.id === id
                                            ? c.withEvent
                                            : c.event;
                                    const isExternal = !c.withEvent;
                                    const profileColor = colorMap.get(
                                        c.profileId,
                                    );
                                    const profileMember = members?.find(
                                        (m) => m.profile_id === c.profileId,
                                    );
                                    return (
                                        <View
                                            key={`${c.event.id}-${c.blockStartsAt}-${idx}`}
                                            style={[
                                                styles.conflictRow,
                                                !isLast && {
                                                    borderBottomColor:
                                                        colors.hair,
                                                    borderBottomWidth:
                                                        StyleSheet.hairlineWidth,
                                                },
                                            ]}>
                                            <View
                                                style={[
                                                    styles.conflictDot,
                                                    {
                                                        backgroundColor:
                                                            profileColor ??
                                                            colors.warn,
                                                    },
                                                ]}
                                            />
                                            <View
                                                style={
                                                    styles.conflictRowBody
                                                }>
                                                <ThemedText
                                                    style={[
                                                        styles.conflictRowTitle,
                                                        { color: colors.text },
                                                    ]}>
                                                    {isExternal
                                                        ? `Busy on ${
                                                              profileMember?.display_name ??
                                                              'a paired calendar'
                                                          }`
                                                        : otherEvent?.title ??
                                                          'Another event'}
                                                </ThemedText>
                                                <ThemedText
                                                    style={[
                                                        styles.conflictRowMeta,
                                                        {
                                                            color: colors.textSecondary,
                                                            fontFamily:
                                                                FontFamily.monoRegular,
                                                        },
                                                    ]}>
                                                    {isExternal
                                                        ? 'External calendar overlap'
                                                        : c.withChildId
                                                          ? 'Same child double-booked'
                                                          : 'Same parent double-booked'}
                                                </ThemedText>
                                            </View>
                                            {otherEvent ? (
                                                <Pressable
                                                    onPress={() =>
                                                        router.push({
                                                            pathname:
                                                                '/event/[id]',
                                                            params: {
                                                                id: otherEvent.id,
                                                            },
                                                        })
                                                    }
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Open the conflicting event"
                                                    style={({ pressed }) => [
                                                        styles.openBtn,
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <Feather
                                                        name="chevron-right"
                                                        size={14}
                                                        color={colors.textSecondary}
                                                    />
                                                </Pressable>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}

                    {/* Actions card. The actual move/reassign UX is
                        deferred to Phase 12; for now we route the user
                        back to the event editor where they can change
                        time/responsible inline, and offer Dismiss as a
                        no-op for "I'm aware, leave it." */}
                    <View style={styles.section}>
                        <ThemedText
                            style={[
                                styles.sectionLabel,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            ACTIONS
                        </ThemedText>
                        <View
                            style={[
                                styles.actionsCard,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <Pressable
                                onPress={() =>
                                    router.replace({
                                        pathname: '/event/[id]',
                                        params: { id: event.id },
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Open this event to change time or assignee"
                                style={({ pressed }) => [
                                    styles.actionRow,
                                    {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="edit-2"
                                    size={16}
                                    color={colors.accent}
                                />
                                <View style={styles.actionRowBody}>
                                    <ThemedText
                                        style={[
                                            styles.actionRowTitle,
                                            { color: colors.text },
                                        ]}>
                                        Open this event
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.actionRowSub,
                                            { color: colors.textSecondary },
                                        ]}>
                                        Change the time, day, or
                                        responsible parent.
                                    </ThemedText>
                                </View>
                                <Feather
                                    name="chevron-right"
                                    size={14}
                                    color={colors.textSecondary}
                                />
                            </Pressable>
                            <Pressable
                                onPress={() => router.back()}
                                accessibilityRole="button"
                                accessibilityLabel="Dismiss without changes"
                                style={({ pressed }) => [
                                    styles.actionRow,
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="x"
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <View style={styles.actionRowBody}>
                                    <ThemedText
                                        style={[
                                            styles.actionRowTitle,
                                            { color: colors.text },
                                        ]}>
                                        Dismiss
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.actionRowSub,
                                            { color: colors.textSecondary },
                                        ]}>
                                        Keep both — accept the overlap
                                        and revisit later.
                                    </ThemedText>
                                </View>
                            </Pressable>
                        </View>
                    </View>

                    {/* Footnote — flags this as the scaffold, not the
                        final UX. Lets a future reviewer / QA know the
                        full move/reassign flow is deferred without
                        cluttering primary affordances. */}
                    <ThemedText
                        style={[
                            styles.footnote,
                            {
                                color: colors.textSecondary,
                                fontFamily: FontFamily.monoRegular,
                            },
                        ]}>
                        The full in-line move / reassign flow ships with
                        Phase 12. Use Open this event for now.
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    topBarBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    // Right-side spacer so the title stays centered relative to the
    // back button's footprint.
    topBarBtnSpacer: { width: 32, height: 32 },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    warnCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
    },
    warnIcon: { marginTop: 2 },
    warnBody: { flex: 1 },
    warnTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    warnSubtitle: {
        fontSize: 11.5,
        letterSpacing: -0.2,
        lineHeight: 16,
    },
    section: {
        marginTop: Spacing.four,
    },
    sectionLabel: {
        fontSize: 11,
        letterSpacing: 0.4,
        paddingHorizontal: 4,
        paddingBottom: 6,
    },
    conflictsCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    conflictRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
    },
    conflictDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    conflictRowBody: { flex: 1 },
    conflictRowTitle: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    conflictRowMeta: {
        fontSize: 10.5,
        letterSpacing: -0.2,
    },
    openBtn: {
        padding: 6,
    },
    actionsCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
    },
    actionRowBody: { flex: 1 },
    actionRowTitle: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    actionRowSub: {
        fontSize: 11.5,
        letterSpacing: -0.2,
        lineHeight: 15,
    },
    footnote: {
        marginTop: Spacing.four,
        fontSize: 10.5,
        letterSpacing: -0.2,
        textAlign: 'center',
        paddingHorizontal: 16,
        lineHeight: 14,
    },
    pressed: { opacity: 0.7 },
});
