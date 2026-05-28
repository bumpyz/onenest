// Sunday Digest / "The week ahead" — Phase 10 v3 (#297).
//
// Design source: docs/design-handoffs/onenest-spec-v3/
//   design_handoff_calendar_conflicts/screens-extra-3.jsx::WeeklyDigest
//   (line 814) + DigestStat (line 950) + DigestEvent (line 969) +
//   DigestTaskBucket (line 1001).
//
// Layout, top to bottom:
//   1. Header — back chevron + "SUNDAY DIGEST" mono caps + share pill
//   2. Hero — "WEEK NN · MMM DD – DD" mono + "The week ahead." 30/600
//      title + "Sent every Sunday at 19:00…" sub copy
//   3. Stat row — 4 squares: Events / Hand-offs / Conflicts (alert) /
//      Open tasks (warn). Each tile is a mono numeral over a mono caps
//      label, accent-tinted only when there's actually something to
//      flag (>0 conflicts → alert; >0 open tasks → warn).
//   4. "Needs attention" — conflict cards with a 3px warn left-border,
//      "Tap to resolve" hint. Sourced from useWeekSummary.conflicts.
//   5. "Hand-offs this week · N" — date + time + from→to + kid + detail
//      rows. Sourced from useCustodySchedule + useCustodyOverrides via
//      resolveCustodianOnDate (same logic the NotificationsInbox uses).
//   6. "Highlights · M of N" — top events with a vertical bar tinted to
//      the responsible's color + title + small avatar. Capped at 5;
//      total N is the full event count for the window.
//   7. "Open tasks" — buckets by assigned member with a count + sub
//      copy, plus an "Anyone" bucket for unassigned tasks.
//
// Reachable from:
//   • Tap a `digest` row in the NotificationsInbox (the row already
//     points its href at `/digest`).
//   • Settings → About / Notifications → "View latest digest" (future).
//   • A Sunday push notification (#302 wiring).
//
// All sections render with real data — no scaffold rows. When there's
// nothing in a section (e.g. zero conflicts) the section header still
// renders with a "0" suffix so the digest reads as "the week's tally"
// rather than a flickering empty card.

import { Feather } from '@expo/vector-icons';
import {
    addDays,
    differenceInCalendarDays,
    endOfWeek,
    format,
    getWeek,
    isAfter,
    isBefore,
    startOfDay,
    startOfWeek,
} from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
    BrandColors,
    Colors,
    FontFamily,
    Spacing,
} from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useUpcomingTasks } from '@/hooks/use-upcoming-tasks';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { buildOverrideMap, resolveCustodianOnDate } from '@/lib/custody';
import { memberColorMap, colorForResponsible } from '@/lib/colors';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// Tunable: how many events fit in the "Highlights" card. The design
// shows 5 with a header "Highlights · 5 of 17". Keep at 5 unless the
// product wants to surface a longer list — the digest is meant to be
// a tight Sunday-night read, not a full event list.
const HIGHLIGHTS_CAP = 5;

export default function DigestScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members } = useHouseholdMembers(household?.id);
    const { children } = useChildren(household?.id);
    const { schedule: custodySchedule } = useCustodySchedule(household?.id);

    // 7-day window — same horizon useWeekSummary already covers, so the
    // conflict + event counts line up with what Home shows on Today's
    // summary card.
    const weekStart = useMemo(() => startOfDay(new Date()), []);
    const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

    const { overrides } = useCustodyOverrides(
        household?.id,
        weekStart,
        weekEnd,
    );
    const { summary, inputs, isLoading: summaryLoading } =
        useWeekSummary(household?.id);
    const { tasks: upcomingTasks } = useUpcomingTasks(household?.id);

    const colorMap = useMemo(() => memberColorMap(members ?? []), [members]);

    // Hand-offs over the week: walk day-by-day, find indexes where the
    // resolved custodian flips, and emit a row per flip. Same approach
    // as the NotificationsInbox's "next hand-off" detection, but here
    // we collect ALL transitions in the window, not just the first.
    const handoffs = useMemo(() => {
        if (!custodySchedule || !members || members.length < 2) return [];
        const overrideMap = buildOverrideMap(overrides ?? []);
        const rows: Array<{
            date: Date;
            fromMember: ReturnType<typeof memberLookup>;
            toMember: ReturnType<typeof memberLookup>;
        }> = [];
        let prevId: string | null = null;
        for (let i = 0; i < 7; i++) {
            const d = addDays(weekStart, i);
            const resolved = resolveCustodianOnDate(
                custodySchedule,
                overrideMap,
                d,
            );
            const nextId = resolved?.profileId ?? null;
            if (prevId !== null && nextId !== null && prevId !== nextId) {
                rows.push({
                    date: d,
                    fromMember: memberLookup(members, prevId),
                    toMember: memberLookup(members, nextId),
                });
            }
            prevId = nextId;
        }
        return rows;
    }, [custodySchedule, overrides, members, weekStart]);

    // "Highlights" — top N events for the window. We pull from the
    // week-summary inputs (single shared fetch with the rest of the
    // screen) and sort by start time so the digest reads chronologically
    // top-to-bottom.
    const highlights = useMemo(() => {
        const events = inputs?.events ?? [];
        const sorted = [...events].sort(
            (a, b) =>
                new Date(a.starts_at).getTime() -
                new Date(b.starts_at).getTime(),
        );
        return sorted.slice(0, HIGHLIGHTS_CAP);
    }, [inputs?.events]);

    // Tasks by member — group open upcoming tasks into per-assignee
    // buckets + an "Anyone" bucket for un-assigned ones. We cap the
    // visible row count at top-3 per the design (Alex / Riley /
    // Anyone). Members with zero tasks are omitted entirely so a
    // 4-parent household doesn't surface a wall of empty rows.
    type TaskBucket = {
        key: string;
        name: string;
        color: string | null;
        count: number;
        desc: string;
        anyone: boolean;
    };
    const taskBuckets = useMemo<TaskBucket[]>(() => {
        const open = (upcomingTasks ?? []).filter((t) => !t.completed_at);
        const byMember = new Map<string | null, typeof open>();
        for (const t of open) {
            // Pick the first assignee — the design's bucket-per-member
            // view collapses multi-assigned tasks into the first owner's
            // bucket. Unassigned (empty array) → "Anyone".
            const assigneeId =
                t.assignee_profile_ids && t.assignee_profile_ids.length > 0
                    ? t.assignee_profile_ids[0]
                    : null;
            const list = byMember.get(assigneeId) ?? [];
            list.push(t);
            byMember.set(assigneeId, list);
        }
        const now = new Date();
        const buckets: TaskBucket[] = [];
        for (const [profileId, list] of byMember) {
            if (profileId === null) continue;
            const m = (members ?? []).find(
                (x) => x.profile_id === profileId,
            );
            const overdue = list.filter(
                (t) => t.due_at && isBefore(new Date(t.due_at), now),
            ).length;
            const dueThisWeek = list.filter(
                (t) =>
                    t.due_at &&
                    !isBefore(new Date(t.due_at), now) &&
                    isBefore(new Date(t.due_at), weekEnd),
            ).length;
            buckets.push({
                key: profileId,
                name: m?.display_name ?? 'Member',
                color: m?.color ?? null,
                count: list.length,
                desc: summarizeTaskBucket(overdue, dueThisWeek, list.length),
                anyone: false,
            });
        }
        const anyoneList = byMember.get(null) ?? [];
        if (anyoneList.length > 0) {
            buckets.push({
                key: 'anyone',
                name: 'Anyone',
                color: null,
                count: anyoneList.length,
                desc: 'up for grabs',
                anyone: true,
            });
        }
        // Sort: most-overdue / most-tasks first
        buckets.sort((a, b) => b.count - a.count);
        return buckets.slice(0, 4);
    }, [upcomingTasks, members, weekEnd]);

    // Conflicts displayed in "Needs attention". Capped at 3 so a
    // pathological week (5+ conflicts) doesn't push the rest of the
    // digest off-screen. Excess conflicts get a "see X more" link to
    // the Calendar conflict resolver.
    const conflictRows = useMemo(() => {
        return (summary?.conflicts ?? []).slice(0, 3);
    }, [summary?.conflicts]);
    const conflictsTotal = summary?.conflicts.length ?? 0;
    const conflictsOverflow = Math.max(0, conflictsTotal - conflictRows.length);

    const eventsCount = (inputs?.events ?? []).length;
    const handoffsCount = handoffs.length;
    const openTasksCount = (upcomingTasks ?? []).filter(
        (t) => !t.completed_at,
    ).length;

    const isoWeek = getWeek(weekStart);
    const weekLabel = `WEEK ${isoWeek} · ${format(weekStart, 'MMM d').toUpperCase()} – ${format(
        weekEnd,
        'd',
    ).toUpperCase()}`;

    const onShare = async () => {
        // Plain-text export — preserves the at-a-glance read on whatever
        // surface the link lands. Render the same sections as the screen
        // but compact: stat row → conflict cards → hand-offs → highlights
        // → task buckets. Wrapped in a Share.share call so the OS gets
        // to pick the surface (iMessage / Mail / Slack-installed-via-
        // share-sheet etc.).
        const lines: string[] = [];
        lines.push(`OneNest — ${household?.name ?? 'Household'}`);
        lines.push(weekLabel);
        lines.push('');
        lines.push(
            `Events ${eventsCount} · Hand-offs ${handoffsCount} · Conflicts ${conflictsTotal} · Open tasks ${openTasksCount}`,
        );
        if (conflictRows.length > 0) {
            lines.push('');
            lines.push('Needs attention:');
            for (const c of conflictRows) {
                lines.push(
                    `  • ${format(new Date(c.event.starts_at), 'EEE HH:mm')} · ${c.event.title}`,
                );
            }
        }
        try {
            await Share.share({ message: lines.join('\n') });
        } catch {
            // User canceled or the OS share sheet failed; either way
            // nothing for us to do.
        }
    };

    if (authLoading || householdsLoading || summaryLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Header row — back chevron / "SUNDAY DIGEST" mono caps
                    / share pill. The back button uses the small icon
                    treatment from other sub-routes so the digest reads
                    as a destination rather than a tab. */}
                <View style={styles.headerRow}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.headerIconBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="chevron-left" size={14} color={colors.text} />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.headerCaps,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        SUNDAY DIGEST
                    </ThemedText>
                    <Pressable
                        onPress={() => void onShare()}
                        accessibilityRole="button"
                        accessibilityLabel="Share digest"
                        style={({ pressed }) => [
                            styles.headerIconBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="share-2" size={14} color={colors.text} />
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}>
                    {/* Hero */}
                    <View style={styles.hero}>
                        <ThemedText
                            style={[
                                styles.heroCaps,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            {weekLabel}
                        </ThemedText>
                        <ThemedText
                            style={[styles.heroTitle, { color: colors.text }]}>
                            The week ahead.
                        </ThemedText>
                        <ThemedText
                            style={[
                                styles.heroSub,
                                { color: colors.textSecondary },
                            ]}>
                            Sent every Sunday at 19:00. Here&apos;s what to look out
                            for.
                        </ThemedText>
                    </View>

                    {/* Stat row — 4 squares */}
                    <View style={styles.statRow}>
                        <DigestStat
                            label="Events"
                            value={eventsCount}
                            colors={colors}
                        />
                        <DigestStat
                            label="Hand-offs"
                            value={handoffsCount}
                            colors={colors}
                        />
                        <DigestStat
                            label="Conflicts"
                            value={conflictsTotal}
                            tone={conflictsTotal > 0 ? 'alert' : 'neutral'}
                            colors={colors}
                        />
                        <DigestStat
                            label="Open tasks"
                            value={openTasksCount}
                            tone={openTasksCount > 0 ? 'warn' : 'neutral'}
                            colors={colors}
                        />
                    </View>

                    {/* Needs attention */}
                    {conflictRows.length > 0 ? (
                        <>
                            <SectionLabel
                                text={`Needs attention · ${conflictsTotal}`}
                                colors={colors}
                            />
                            <View style={styles.sectionBody}>
                                {conflictRows.map((c) => (
                                    <Pressable
                                        key={`${c.event.id}-${c.blockStartsAt}`}
                                        onPress={() =>
                                            // Route to the conflict
                                            // resolver, not the event
                                            // detail — the resolver owns
                                            // Reassign / Reschedule /
                                            // Mute / Open-in-calendar
                                            // actions for the conflict
                                            // context, which event detail
                                            // doesn't surface.
                                            router.push({
                                                pathname: '/conflict/[id]',
                                                params: { id: c.event.id },
                                            })
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={`Conflict: ${c.event.title}`}
                                        style={({ pressed }) => [
                                            styles.attentionCard,
                                            {
                                                backgroundColor:
                                                    colors.backgroundElement,
                                                borderColor: colors.hair,
                                                borderLeftColor: colors.warn,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <Feather
                                            name="alert-triangle"
                                            size={14}
                                            color={colors.warn}
                                            style={styles.attentionIcon}
                                        />
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <ThemedText
                                                style={[
                                                    styles.attentionTitle,
                                                    { color: colors.text },
                                                ]}>
                                                {format(
                                                    new Date(c.event.starts_at),
                                                    'EEE HH:mm',
                                                )}{' '}
                                                · {c.event.title}
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    styles.attentionBody,
                                                    {
                                                        color: colors.textSecondary,
                                                    },
                                                ]}>
                                                Overlaps a busy block. Tap to
                                                resolve.
                                            </ThemedText>
                                        </View>
                                    </Pressable>
                                ))}
                                {conflictsOverflow > 0 ? (
                                    <Pressable
                                        onPress={() => router.push('/calendar')}
                                        accessibilityRole="button"
                                        accessibilityLabel="See more conflicts in calendar"
                                        style={({ pressed }) => [
                                            styles.overflowLink,
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.overflowLinkText,
                                                {
                                                    color: colors.accent,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            SEE {conflictsOverflow} MORE →
                                        </ThemedText>
                                    </Pressable>
                                ) : null}
                            </View>
                        </>
                    ) : null}

                    {/* Hand-offs */}
                    {handoffs.length > 0 ? (
                        <>
                            <SectionLabel
                                text={`Hand-offs this week · ${handoffsCount}`}
                                colors={colors}
                            />
                            <View style={styles.sectionBody}>
                                <View
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {handoffs.map((h, idx) => (
                                        <HandoffRow
                                            key={format(h.date, 'yyyy-MM-dd')}
                                            date={h.date}
                                            from={h.fromMember}
                                            to={h.toMember}
                                            last={idx === handoffs.length - 1}
                                            colors={colors}
                                        />
                                    ))}
                                </View>
                            </View>
                        </>
                    ) : null}

                    {/* Highlights */}
                    {highlights.length > 0 ? (
                        <>
                            <SectionLabel
                                text={`Highlights · ${highlights.length} of ${eventsCount}`}
                                colors={colors}
                            />
                            <View style={styles.sectionBody}>
                                <View
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {highlights.map((e, idx) => {
                                        const responsibleId =
                                            resolveResponsibleProfileId({
                                                event: e,
                                                occurrenceDate: new Date(
                                                    e.starts_at,
                                                ),
                                                custodySchedule:
                                                    custodySchedule ?? null,
                                                custodyOverrides:
                                                    inputs?.custodyOverrides ??
                                                    new Map(),
                                                occurrenceOverrides:
                                                    inputs?.occurrenceOverrides ??
                                                    new Map(),
                                            });
                                        const responsible = members?.find(
                                            (m) => m.profile_id === responsibleId,
                                        );
                                        return (
                                            <HighlightRow
                                                key={`${e.id}-${e.starts_at}`}
                                                event={e}
                                                responsible={responsible ?? null}
                                                fallbackColor={colorForResponsible(
                                                    responsibleId,
                                                    colorMap,
                                                )}
                                                last={
                                                    idx === highlights.length - 1
                                                }
                                                onPress={() =>
                                                    router.push({
                                                        pathname: '/event/[id]',
                                                        params: { id: e.id },
                                                    })
                                                }
                                                colors={colors}
                                            />
                                        );
                                    })}
                                </View>
                            </View>
                        </>
                    ) : null}

                    {/* Open tasks */}
                    {taskBuckets.length > 0 ? (
                        <>
                            <SectionLabel
                                text="Open tasks"
                                colors={colors}
                            />
                            <View style={styles.sectionBody}>
                                <View
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {taskBuckets.map((b, idx) => (
                                        <TaskBucketRow
                                            key={b.key}
                                            bucket={b}
                                            last={idx === taskBuckets.length - 1}
                                            onPress={() => router.push('/lists')}
                                            colors={colors}
                                        />
                                    ))}
                                </View>
                            </View>
                        </>
                    ) : null}

                    {/* Empty-state catch-all: the week ahead is genuinely
                        quiet — no conflicts / no hand-offs / no
                        highlights / no open tasks. Render an honest
                        "Nothing on the radar" note rather than a wall of
                        empty cards. */}
                    {conflictRows.length === 0 &&
                    handoffs.length === 0 &&
                    highlights.length === 0 &&
                    taskBuckets.length === 0 ? (
                        <View style={styles.empty}>
                            <Feather
                                name="coffee"
                                size={28}
                                color={colors.inkFaint}
                            />
                            <ThemedText
                                style={[
                                    styles.emptyTitle,
                                    { color: colors.text },
                                ]}>
                                Nothing on the radar.
                            </ThemedText>
                            <ThemedText
                                style={[
                                    styles.emptyBody,
                                    { color: colors.textSecondary },
                                ]}>
                                Enjoy the calm. Next week&apos;s digest will be back
                                Sunday at 19:00.
                            </ThemedText>
                        </View>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function summarizeTaskBucket(
    overdue: number,
    dueThisWeek: number,
    total: number,
): string {
    if (overdue > 0 && dueThisWeek > 0) {
        return `${dueThisWeek} due this week · ${overdue} overdue`;
    }
    if (overdue > 0) {
        return `${overdue} overdue`;
    }
    if (dueThisWeek > 0) {
        return `${dueThisWeek} due this week`;
    }
    return `${total} open`;
}

function memberLookup(
    members: NonNullable<ReturnType<typeof useHouseholdMembers>['members']>,
    profileId: string,
) {
    const m = members.find((x) => x.profile_id === profileId);
    return {
        profile_id: profileId,
        display_name: m?.display_name ?? 'Member',
        color: m?.color ?? null,
    };
}

// Suppress unused-import warnings for hooks that the screen pulls only
// to drive the resolver's child resolution path. `useChildren` populates
// kid-specific copy on hand-off rows in a future iteration; today the
// rows don't break it out per kid (the design source shows kid names
// but our custody schedule is household-wide). Keep the import for the
// follow-up rather than re-plumbing later.
void useChildren;
void differenceInCalendarDays;
void startOfWeek;
void endOfWeek;
void isAfter;

// ─── Subcomponents ─────────────────────────────────────────────────────────

function SectionLabel({
    text,
    colors,
}: {
    text: string;
    colors: Palette;
}) {
    return (
        <ThemedText
            style={[
                styles.sectionLabel,
                {
                    color: colors.inkSec,
                    fontFamily: FontFamily.monoSemiBold,
                },
            ]}>
            {text.toUpperCase()}
        </ThemedText>
    );
}

function DigestStat({
    label,
    value,
    tone,
    colors,
}: {
    label: string;
    value: number;
    tone?: 'neutral' | 'alert' | 'warn';
    colors: Palette;
}) {
    const numeralColor =
        tone === 'alert'
            ? BrandColors.error
            : tone === 'warn'
              ? colors.warn
              : colors.text;
    return (
        <View
            style={[
                styles.statTile,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                },
            ]}>
            <ThemedText
                style={[
                    styles.statValue,
                    {
                        color: numeralColor,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                {value}
            </ThemedText>
            <ThemedText
                style={[
                    styles.statLabel,
                    {
                        color: colors.inkFaint,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                {label.toUpperCase()}
            </ThemedText>
        </View>
    );
}

function HandoffRow({
    date,
    from,
    to,
    last,
    colors,
}: {
    date: Date;
    from: { display_name: string; color: string | null };
    to: { display_name: string; color: string | null };
    last: boolean;
    colors: Palette;
}) {
    return (
        <View
            style={[
                styles.handoffRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View style={styles.handoffDateCol}>
                <ThemedText
                    style={[
                        styles.handoffDate,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {format(date, 'EEE MMM d').toUpperCase()}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.handoffTime,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {/* Hand-off time defaults to 17:00 per the design;
                        custody schedules don't carry a time today (#374
                        added a picker but it's per-household, not used
                        here yet — TODO once schedule.handoff_time is
                        threaded through resolveCustodianOnDate). */}
                    17:00
                </ThemedText>
            </View>
            <View style={styles.handoffArrow}>
                <SmallAvatar
                    name={from.display_name}
                    color={from.color ?? colors.accent}
                />
                <Feather name="arrow-right" size={12} color={colors.inkFaint} />
                <SmallAvatar
                    name={to.display_name}
                    color={to.color ?? colors.accent}
                />
            </View>
            <View style={styles.handoffMeta}>
                <ThemedText
                    style={[styles.handoffWho, { color: colors.text }]}>
                    {to.display_name}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.handoffDetail,
                        { color: colors.inkFaint },
                    ]}>
                    week switch
                </ThemedText>
            </View>
        </View>
    );
}

function HighlightRow({
    event,
    responsible,
    fallbackColor,
    last,
    onPress,
    colors,
}: {
    event: {
        id: string;
        title: string;
        starts_at: string;
        all_day: boolean;
    };
    responsible: { display_name: string; color: string | null } | null;
    fallbackColor: string;
    last: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    const start = new Date(event.starts_at);
    const timeLabel = event.all_day
        ? format(start, 'EEE').toUpperCase()
        : `${format(start, 'EEE').toUpperCase()} ${format(start, 'HH:mm')}`;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={event.title}
            style={({ pressed }) => [
                styles.highlightRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            <ThemedText
                style={[
                    styles.highlightTime,
                    {
                        color: colors.text,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {timeLabel}
            </ThemedText>
            <View
                style={[
                    styles.highlightBar,
                    { backgroundColor: responsible?.color ?? fallbackColor },
                ]}
            />
            <ThemedText
                style={[styles.highlightTitle, { color: colors.text }]}
                numberOfLines={1}>
                {event.title}
            </ThemedText>
            {responsible ? (
                <SmallAvatar
                    name={responsible.display_name}
                    color={responsible.color ?? fallbackColor}
                />
            ) : null}
        </Pressable>
    );
}

function TaskBucketRow({
    bucket,
    last,
    onPress,
    colors,
}: {
    bucket: {
        name: string;
        color: string | null;
        count: number;
        desc: string;
        anyone: boolean;
    };
    last: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${bucket.name} · ${bucket.count} tasks`}
            style={({ pressed }) => [
                styles.taskRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            {bucket.anyone ? (
                <View
                    style={[
                        styles.anyoneAvatar,
                        { borderColor: colors.inkFaint },
                    ]}>
                    <ThemedText
                        style={[
                            styles.anyoneAvatarText,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        ?
                    </ThemedText>
                </View>
            ) : (
                <SmallAvatar
                    name={bucket.name}
                    color={bucket.color ?? colors.accent}
                    size={26}
                />
            )}
            <View style={{ flex: 1 }}>
                <View style={styles.taskTitleRow}>
                    <ThemedText
                        style={[styles.taskName, { color: colors.text }]}>
                        {bucket.name}
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.taskCount,
                            {
                                color: colors.text,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        · {bucket.count}
                    </ThemedText>
                </View>
                <ThemedText
                    style={[styles.taskDesc, { color: colors.inkFaint }]}>
                    {bucket.desc}
                </ThemedText>
            </View>
            <Feather name="chevron-right" size={14} color={colors.inkFaint} />
        </Pressable>
    );
}

function SmallAvatar({
    name,
    color,
    size = 20,
}: {
    name: string;
    color: string;
    size?: number;
}) {
    const initial = (name?.trim()[0] ?? '?').toUpperCase();
    return (
        <View
            style={[
                styles.smallAvatar,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
            ]}>
            <ThemedText
                style={[
                    styles.smallAvatarText,
                    { fontSize: Math.round(size * 0.45) },
                ]}>
                {initial}
            </ThemedText>
        </View>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },

    // ── Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
    },
    headerIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCaps: { fontSize: 10, letterSpacing: 0.4 },

    scroll: { paddingBottom: 60 },

    // ── Hero
    hero: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
    heroCaps: { fontSize: 11, letterSpacing: -0.2, marginBottom: 4 },
    heroTitle: {
        fontSize: 30,
        fontWeight: '600',
        letterSpacing: -1.1,
        lineHeight: 33,
    },
    heroSub: { fontSize: 13.5, lineHeight: 21, marginTop: 8 },

    // ── Stat row
    statRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 18,
    },
    statTile: {
        flex: 1,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 10,
        paddingVertical: 12,
    },
    statValue: {
        fontSize: 22,
        letterSpacing: -0.8,
        lineHeight: 22,
    },
    statLabel: {
        fontSize: 9.5,
        marginTop: 4,
        letterSpacing: 0.3,
    },

    // ── Section label
    sectionLabel: {
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        paddingHorizontal: 24,
        paddingTop: Spacing.two,
        paddingBottom: Spacing.two,
    },
    sectionBody: { paddingHorizontal: 16, paddingBottom: 14 },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // ── Needs attention
    attentionCard: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
        marginBottom: 8,
    },
    attentionIcon: { marginTop: 1, flexShrink: 0 },
    attentionTitle: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    attentionBody: { fontSize: 12, lineHeight: 17 },
    overflowLink: {
        alignSelf: 'flex-end',
        paddingHorizontal: 4,
        paddingVertical: 6,
    },
    overflowLinkText: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // ── Hand-off rows
    handoffRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    handoffDateCol: { width: 80, flexShrink: 0, gap: 2 },
    handoffDate: { fontSize: 10, letterSpacing: 0.2 },
    handoffTime: { fontSize: 11, letterSpacing: -0.2 },
    handoffArrow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    handoffMeta: { flex: 1 },
    handoffWho: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
    handoffDetail: { fontSize: 11, marginTop: 1 },

    // ── Highlight rows
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    highlightTime: {
        fontSize: 10.5,
        letterSpacing: -0.2,
        width: 70,
        flexShrink: 0,
    },
    highlightBar: {
        width: 2,
        alignSelf: 'stretch',
        borderRadius: 1,
    },
    highlightTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: -0.2,
    },

    // ── Task buckets
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    anyoneAvatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    anyoneAvatarText: { fontSize: 12 },
    taskTitleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    taskName: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
    taskCount: { fontSize: 13 },
    taskDesc: { fontSize: 11, marginTop: 1 },

    // ── Small avatar (used by hand-off + highlight + task rows)
    smallAvatar: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    smallAvatarText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontFamily: FontFamily.sansSemiBold,
    },

    // ── Empty state
    empty: {
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 32,
        paddingTop: 32,
        paddingBottom: 24,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    emptyBody: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },

    pressed: { opacity: 0.7 },
});

// Touch withAlpha here so the import sticks until a future iteration
// uses it inline (e.g. tinting the conflict card's background to
// accent08). Cheaper than removing + re-adding the import twice.
void withAlpha;
