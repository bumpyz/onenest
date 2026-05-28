// NotificationsInbox — Phase 10 redesign (design source: screens-extra-3.jsx
// NotificationsInbox at line 1418, v3 spec).
//
// The activity inbox surfaces:
//   • Real signals computed from existing data: conflicts (from
//     useWeekSummary), unassigned events, custody hand-offs in the next
//     24h. These render with current data — no stub.
//   • Persisted rows from the `notifications` table (#381) for mentions,
//     swap requests, task-complete activity, digest receipts,
//     OAuth-connect events, custody-override fan-out. Decorative
//     "SAMPLE" scaffolds were retired when persistence landed.
//
// Phase 10 v3 changes vs. the prior pass:
//   • Consolidated header — removed the secondary back-bar; the mono
//     count meta + 22/600 "Activity" title + Mark-all-read pill all
//     sit inline at the top per the design.
//   • Unread rows get a soft accent-tinted background (`accent08`).
//   • Unread accent dot moved to an absolute-positioned 6px chip at
//     the row's left edge (instead of inline in the title).
//   • Avatar layered over the bottom-right of the icon tile when a
//     row has both a kind icon and a referenced member.
//   • Inline `@YOU` mono caps badge next to the title for mention
//     items so they read as "directed at you" at a glance.

import { format, isToday, isYesterday } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
    BrandColors,
    Colors,
    FontFamily,
    Spacing,
    Typography,
} from '@/constants/theme';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useWeekSummary } from '@/hooks/use-week-summary';
import { resolveCustodianOnDate, buildOverrideMap } from '@/lib/custody';
import {
    dismissNotification,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type Notification,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

type InboxKind =
    | 'conflict'
    | 'unassigned'
    | 'handoff'
    | 'task'
    | 'event'
    | 'mention'
    | 'swap'
    | 'digest'
    | 'invite'
    | 'connect'
    // Custody-override fan-out (#494 Phase E). All three render with
    // the swap-style "repeat" glyph but tint differs: request = warn
    // (decision needed), change + decision = accent (informational).
    | 'override_change'
    | 'override_request'
    | 'override_decision';

type InboxItem = {
    id: string;
    kind: InboxKind;
    title: string;
    body: string;
    /** When this notification fired. Determines bucket (Today/Yesterday/Earlier). */
    at: Date;
    unread?: boolean;
    /** Sample/scaffold flag — for items derived from non-persisted sources. */
    sample?: boolean;
    /** Optional member avatar to render. */
    avatarColor?: string;
    avatarInitial?: string;
    /** Tap destination — optional; many items are dead-ends today. */
    href?: string;
};

type Filter = 'all' | 'unread' | 'mentions' | 'conflicts';

export default function NotificationsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members } = useHouseholdMembers(household?.id);
    const { schedule: custodySchedule } = useCustodySchedule(household?.id);
    // Pull a small window of overrides — we only walk +7 days for hand-off
    // detection. Pre-computed bounds avoid the hook fetching the full
    // history.
    const overrideRangeStart = useMemo(() => new Date(), []);
    const overrideRangeEnd = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d;
    }, []);
    const { overrides } = useCustodyOverrides(
        household?.id,
        overrideRangeStart,
        overrideRangeEnd,
    );
    const { summary } = useWeekSummary(household?.id);

    // Persisted notifications (#381). Fetched on mount + on focus so
    // tabbing back picks up rows written by other surfaces (swap
    // accept/decline, future event reminders, etc.). The derived
    // signals below (conflicts, hand-offs) stay as live-computed rows
    // and don't go through the table — they're already "free" reads.
    const [persisted, setPersisted] = useState<Notification[]>([]);
    const refetchPersisted = useCallback(async () => {
        try {
            const rows = await listNotifications({ limit: 100 });
            setPersisted(rows);
        } catch {
            setPersisted([]);
        }
    }, []);
    useEffect(() => {
        void refetchPersisted();
    }, [refetchPersisted]);
    useFocusEffect(
        useCallback(() => {
            void refetchPersisted();
        }, [refetchPersisted]),
    );

    // Per-row tap: mark the persisted row read (best-effort; derived
    // items get rejected at the DB and we swallow), then route to the
    // item's href if it has one. Optimistic refetch picks up the
    // updated read_at so the row's unread-dot drops immediately.
    const onRowPress = useCallback(
        async (item: InboxItem) => {
            try {
                await markNotificationRead(item.id);
                await refetchPersisted();
            } catch {
                // No-op for derived items.
            }
            // Cast: href is a free-form string (DB-driven), not a
            // typed-routes literal. expo-router accepts it at runtime.
            if (item.href) router.push(item.href as never);
        },
        [refetchPersisted, router],
    );

    // Build the inbox items from real signals where possible. The order
    // doesn't matter here — sectioning by date bucket handles that below.
    const items: InboxItem[] = useMemo(() => {
        const list: InboxItem[] = [];

        // Real: conflicts from summary
        // The summary's Conflict shape is one row per (event + colliding
        // busy block); craft an inbox row per conflict.
        for (const c of summary?.conflicts ?? []) {
            const start = new Date(c.event.starts_at);
            list.push({
                id: `conflict-${c.event.id}-${c.blockStartsAt}`,
                kind: 'conflict',
                title: `Conflict at ${format(start, 'EEE HH:mm')}`,
                body: `${c.event.title} overlaps a busy block`,
                at: start,
                unread: true,
            });
        }

        // Real: unassigned events ahead
        for (const e of summary?.unassignedEvents ?? []) {
            list.push({
                id: `unassigned-${e.id}`,
                kind: 'unassigned',
                title: 'Unassigned event ahead',
                body: `${e.title} · ${format(new Date(e.starts_at), 'EEE HH:mm')}`,
                at: new Date(e.starts_at),
            });
        }

        // Real: next hand-off in the custody schedule (within 7 days).
        // resolveCustodianOnDate returns a `ResolvedCustody` object; compare
        // .profileId between today and each forward day to find the swap.
        if (custodySchedule && members && members.length >= 2) {
            const overrideMap = buildOverrideMap(overrides ?? []);
            const now = new Date();
            const todayCustodian = resolveCustodianOnDate(
                custodySchedule,
                overrideMap,
                now,
            );
            if (todayCustodian?.profileId) {
                for (let i = 1; i <= 7; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() + i);
                    const next = resolveCustodianOnDate(
                        custodySchedule,
                        overrideMap,
                        d,
                    );
                    if (next?.profileId && next.profileId !== todayCustodian.profileId) {
                        const nextMember = members.find(
                            (m) => m.profile_id === next.profileId,
                        );
                        list.push({
                            id: `handoff-${format(d, 'yyyy-MM-dd')}`,
                            kind: 'handoff',
                            title:
                                i === 1
                                    ? `Hand-off tomorrow to ${nextMember?.display_name ?? 'co-parent'}`
                                    : `Hand-off ${format(d, 'EEE')} to ${nextMember?.display_name ?? 'co-parent'}`,
                            body: 'Custody transitions at 17:00',
                            at: d,
                            avatarColor: nextMember?.color ?? colors.accent,
                            avatarInitial: (nextMember?.display_name?.[0] ?? '?').toUpperCase(),
                        });
                        break;
                    }
                }
            }
        }

        // Persisted notifications (#381). Each row in the
        // `notifications` table becomes an InboxItem. Kind-specific
        // avatar resolution: swap_request/swap_decision use the
        // requester's color when we can find it; others fall back to
        // the accent. The `id` field anchors mark-read/dismiss to the
        // real DB row.
        for (const n of persisted) {
            // Pick an avatar member when the payload references a
            // profile id we can look up. Best-effort — many kinds
            // don't have an avatar (digest, connect, invite).
            const payloadProfileId =
                typeof n.payload?.requester_profile_id === 'string'
                    ? (n.payload.requester_profile_id as string)
                    : null;
            const m = payloadProfileId
                ? (members ?? []).find((x) => x.profile_id === payloadProfileId)
                : null;
            list.push({
                id: n.id,
                kind: n.kind as InboxKind,
                title: n.title,
                body: n.body ?? '',
                at: new Date(n.created_at),
                unread: n.read_at === null,
                avatarColor: m?.color ?? undefined,
                avatarInitial: m
                    ? (m.display_name?.[0] ?? '?').toUpperCase()
                    : undefined,
                href: n.href ?? undefined,
            });
        }
        return list;
    }, [summary, custodySchedule, overrides, members, persisted, colors.accent]);

    const [filter, setFilter] = useState<Filter>('all');

    const filtered = useMemo(() => {
        switch (filter) {
            case 'unread':
                return items.filter((i) => i.unread);
            case 'mentions':
                return items.filter((i) => i.kind === 'mention');
            case 'conflicts':
                return items.filter((i) => i.kind === 'conflict');
            default:
                return items;
        }
    }, [items, filter]);

    const buckets = useMemo(() => {
        const today: InboxItem[] = [];
        const yesterday: InboxItem[] = [];
        const earlier: InboxItem[] = [];
        for (const item of filtered) {
            if (isToday(item.at)) today.push(item);
            else if (isYesterday(item.at)) yesterday.push(item);
            else earlier.push(item);
        }
        // Within each bucket, newer-first
        const byDate = (a: InboxItem, b: InboxItem) => b.at.getTime() - a.at.getTime();
        today.sort(byDate);
        yesterday.sort(byDate);
        earlier.sort(byDate);
        return { today, yesterday, earlier };
    }, [filtered]);

    const newCount = items.filter((i) => i.unread).length;
    const todayCount = buckets.today.length;
    const mentionsCount = items.filter((i) => i.kind === 'mention').length;
    const conflictsCount = items.filter((i) => i.kind === 'conflict').length;

    if (authLoading || householdsLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Phase 10 v3: the design source assumes a bottom-nav
                    return path. The screen is reached via push from
                    Home (Today bell), Settings, or a notification
                    deeplink — none of which sit on a tab — so we add
                    a small back chevron in the leading slot to keep
                    return navigation available without bringing back
                    the old full-width chrome bar. The meta + title +
                    Mark-all-read group stays inline per the spec. */}
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Header summary + Mark all read */}
                    <View style={styles.headerRow}>
                        <Pressable
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            style={({ pressed }) => [
                                styles.headerBackBtn,
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
                        <View style={{ flex: 1 }}>
                            <ThemedText
                                style={[
                                    styles.headerCounts,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                {newCount} NEW · {todayCount} TODAY
                            </ThemedText>
                            <ThemedText
                                style={[styles.headerTitle, { color: colors.text }]}>
                                Activity
                            </ThemedText>
                        </View>
                        <Pressable
                            onPress={async () => {
                                // Persisted notifications mark-all-read
                                // (#381). Derived items (conflicts /
                                // hand-offs) don't have a read state —
                                // they reflect live data, so nothing
                                // to persist. Refetch after to pick up
                                // the updated read_at timestamps.
                                try {
                                    await markAllNotificationsRead();
                                    await refetchPersisted();
                                } catch {
                                    // Best-effort.
                                }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Mark all read"
                            style={({ pressed }) => [
                                styles.markAllReadBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.markAllReadText,
                                    { color: colors.text },
                                ]}>
                                Mark all read
                            </ThemedText>
                        </Pressable>
                    </View>

                    {/* Filter chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}>
                        <FilterChip
                            label={`All · ${items.length}`}
                            active={filter === 'all'}
                            onPress={() => setFilter('all')}
                            colors={colors}
                        />
                        <FilterChip
                            label={`Unread · ${newCount}`}
                            active={filter === 'unread'}
                            onPress={() => setFilter('unread')}
                            colors={colors}
                        />
                        {mentionsCount > 0 ? (
                            <FilterChip
                                label={`Mentions · ${mentionsCount}`}
                                active={filter === 'mentions'}
                                onPress={() => setFilter('mentions')}
                                dotColor={colors.accent}
                                colors={colors}
                            />
                        ) : null}
                        {conflictsCount > 0 ? (
                            <FilterChip
                                label={`Conflicts · ${conflictsCount}`}
                                active={filter === 'conflicts'}
                                onPress={() => setFilter('conflicts')}
                                dotColor={colors.warn}
                                colors={colors}
                            />
                        ) : null}
                    </ScrollView>

                    {/* Buckets. onRowPress marks the underlying
                        persisted row read + routes to its href. Derived
                        items (conflicts / hand-offs) skip mark-read
                        since their IDs don't match a DB row — the
                        helper silently no-ops when called with a
                        non-uuid id (RLS denies, swallowed in db.ts). */}
                    <Bucket
                        label="Today"
                        items={buckets.today}
                        emptyHint={filter === 'all' ? "You're all caught up." : null}
                        colors={colors}
                        router={router}
                        onRowPress={onRowPress}
                    />
                    <Bucket
                        label="Yesterday"
                        items={buckets.yesterday}
                        colors={colors}
                        router={router}
                        onRowPress={onRowPress}
                    />
                    <Bucket
                        label="Earlier"
                        items={buckets.earlier}
                        colors={colors}
                        router={router}
                        onRowPress={onRowPress}
                    />

                    {/* Sample-data note — only show if we rendered scaffolds */}
                    {items.some((i) => i.sample) ? (
                        <View
                            style={[
                                styles.sampleNote,
                                {
                                    borderColor: colors.hair,
                                    backgroundColor: colors.backgroundInset,
                                },
                            ]}>
                            <Feather
                                name="info"
                                size={13}
                                color={colors.textSecondary}
                                style={{ marginTop: 2 }}
                            />
                            <ThemedText
                                type="small"
                                style={{ flex: 1, color: colors.textSecondary, lineHeight: 18 }}>
                                Rows marked <ThemedText
                                    type="smallBold"
                                    style={{ color: colors.inkSec, fontFamily: FontFamily.monoSemiBold }}>
                                    SAMPLE
                                </ThemedText>{' '}
                                are placeholders until the notifications backend ships. Live
                                rows (conflicts, hand-offs) update from your real data.
                            </ThemedText>
                        </View>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function FilterChip({
    label,
    active,
    dotColor,
    onPress,
    colors,
}: {
    label: string;
    active: boolean;
    dotColor?: string;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
                styles.filterChip,
                {
                    borderColor: active ? colors.accent : colors.hair,
                    backgroundColor: active
                        ? colors.accent
                        : colors.backgroundElement,
                },
                pressed && styles.pressed,
            ]}>
            {dotColor ? (
                <View
                    style={[
                        styles.filterChipDot,
                        { backgroundColor: dotColor },
                    ]}
                />
            ) : null}
            <ThemedText
                style={[
                    styles.filterChipText,
                    { color: active ? colors.onAccent : colors.text },
                ]}>
                {label}
            </ThemedText>
        </Pressable>
    );
}

function Bucket({
    label,
    items,
    emptyHint,
    colors,
    router,
    onRowPress,
}: {
    label: string;
    items: InboxItem[];
    emptyHint?: string | null;
    colors: Palette;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
    /** Per-row tap handler. Parent owns mark-read + href routing. */
    onRowPress?: (item: InboxItem) => void;
}) {
    if (items.length === 0 && !emptyHint) return null;
    return (
        <View>
            <View style={styles.bucketHeader}>
                <ThemedText
                    style={[
                        styles.bucketLabel,
                        {
                            color: colors.inkSec,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {label.toUpperCase()}
                </ThemedText>
            </View>
            <View
                style={[
                    styles.bucketCard,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {items.length === 0 ? (
                    <View style={styles.bucketEmpty}>
                        <ThemedText
                            themeColor="textSecondary"
                            type="small"
                            style={{ textAlign: 'center' }}>
                            {emptyHint}
                        </ThemedText>
                    </View>
                ) : (
                    items.map((item, idx) => (
                        <InboxRow
                            key={item.id}
                            item={item}
                            last={idx === items.length - 1}
                            colors={colors}
                            onPress={() => {
                                if (onRowPress) onRowPress(item);
                                else if (item.href) router.push(item.href);
                            }}
                        />
                    ))
                )}
            </View>
        </View>
    );
}

function InboxRow({
    item,
    last,
    onPress,
    colors,
}: {
    item: InboxItem;
    last: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    const iconForKind: Record<InboxKind, React.ComponentProps<typeof Feather>['name']> = {
        conflict: 'alert-triangle',
        unassigned: 'help-circle',
        handoff: 'arrow-right',
        task: 'check-square',
        event: 'calendar',
        mention: 'at-sign',
        swap: 'repeat',
        digest: 'inbox',
        invite: 'user-plus',
        connect: 'link',
        override_change: 'repeat',
        override_request: 'repeat',
        override_decision: 'repeat',
    };
    const tintForKind: Record<InboxKind, string> = {
        conflict: colors.warn,
        unassigned: colors.warn,
        handoff: colors.accent,
        task: colors.accent,
        event: colors.accent,
        mention: colors.accent,
        swap: colors.accent,
        digest: colors.accent,
        invite: colors.accent,
        connect: colors.accent,
        // override_request needs the approver's attention — warn-tint
        // it so the row stands out from passive change/decision rows.
        override_change: colors.accent,
        override_request: colors.warn,
        override_decision: colors.accent,
    };
    const tint = tintForKind[item.kind];
    const icon = iconForKind[item.kind];

    // Phase 10 v3: unread rows get a faint accent wash + an
    // absolute-positioned accent dot at the row's leading edge. The
    // wash is rendered via `accent + '14'` (~8% alpha) so it sits on
    // light + dark surfaces without crushing contrast.
    const unreadBg = item.unread ? withAlpha(colors.accent, 0x14 / 0xff) : undefined;
    const isMention = item.kind === 'mention';
    return (
        <Pressable
            onPress={onPress}
            disabled={!item.href}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={({ pressed }) => [
                styles.inboxRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                unreadBg && { backgroundColor: unreadBg },
                pressed && item.href && styles.pressed,
            ]}>
            {/* Leading unread chip — absolute-positioned 6px accent
                dot at the left edge so the row reads as "fresh" even
                in a long list without trying to find the inline dot.
                Spec source: line 1646 (`position: absolute, left: 4`). */}
            {item.unread ? (
                <View
                    style={[
                        styles.leadingUnreadDot,
                        { backgroundColor: colors.accent },
                    ]}
                />
            ) : null}

            {/* Icon tile (always rendered) + optional avatar overlay at
                bottom-right of the tile. Spec layers them so both the
                "kind" semantic AND the actor are legible — the prior
                impl picked one or the other. The overlay's outer ring
                tracks the row's bg (cardOnUnread vs. card) so the
                avatar reads as "punched out" of the tile rather than
                floating on it. */}
            <View style={styles.rowAvatarStack}>
                <View
                    style={[
                        styles.rowIconTile,
                        { backgroundColor: withAlpha(tint, 0x22 / 0xff) },
                    ]}>
                    <Feather name={icon} size={14} color={tint} />
                </View>
                {item.avatarColor && item.avatarInitial ? (
                    <View
                        style={[
                            styles.rowAvatarOverlay,
                            {
                                backgroundColor: item.avatarColor,
                                borderColor: item.unread
                                    ? colors.background
                                    : colors.backgroundElement,
                            },
                        ]}>
                        <ThemedText style={styles.rowAvatarOverlayText}>
                            {item.avatarInitial}
                        </ThemedText>
                    </View>
                ) : null}
            </View>

            {/* Body */}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={styles.rowTitleRow}>
                    <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={[
                            { flex: 1, color: colors.text },
                            item.unread && { fontWeight: '600' },
                        ]}>
                        {item.title}
                    </ThemedText>
                    {isMention ? (
                        <View
                            style={[
                                styles.mentionBadge,
                                {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0x22 / 0xff,
                                    ),
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.mentionBadgeText,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                @YOU
                            </ThemedText>
                        </View>
                    ) : null}
                </View>
                <ThemedText
                    themeColor="textSecondary"
                    type="small"
                    numberOfLines={1}>
                    {item.body}
                </ThemedText>
            </View>

            {/* Trailing meta: relative time + optional SAMPLE badge */}
            <View style={styles.rowMeta}>
                <ThemedText
                    style={[
                        styles.rowTime,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {compactRelativeTime(item.at)}
                </ThemedText>
                {item.sample ? (
                    <View
                        style={[
                            styles.sampleBadge,
                            { backgroundColor: colors.backgroundInset },
                        ]}>
                        <ThemedText
                            style={[
                                styles.sampleBadgeText,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            SAMPLE
                        </ThemedText>
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}

// Compact "9m" / "3h" / "2d" string per the design's mono-meta convention.
function compactRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    // Future events (e.g. unassigned next week) — render the same compact
    // distance but prefix with `in`.
    if (diffMs < 0) {
        return `in ${formatDistanceCompact(-diffMs)}`;
    }
    return formatDistanceCompact(diffMs);
}

function formatDistanceCompact(ms: number): string {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${Math.max(1, m)}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return `${Math.floor(d / 7)}w`;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },

    scroll: { paddingBottom: 64, gap: Spacing.three },

    // ── Header row (back btn + counts + title + Mark all read)
    // Phase 10 v3: this single row carries the entire chrome. The leading
    // back chevron preserves return navigation since the screen is
    // pushed (not on a tab), the meta + title block sits in the middle
    // column, and the Mark-all-read pill anchors to the right edge.
    // 16px horizontal so the back button has the same gutter as the
    // section cards below.
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 6,
        gap: 10,
    },
    headerBackBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCounts: {
        fontSize: 10,
        letterSpacing: -0.2,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '600',
        letterSpacing: -0.6,
        marginTop: 1,
    },
    markAllReadBtn: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 7,
        borderWidth: StyleSheet.hairlineWidth,
    },
    markAllReadText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },

    // ── Filter chips
    filterRow: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    filterChipDot: { width: 6, height: 6, borderRadius: 3 },
    filterChipText: { fontSize: 11.5, fontWeight: '600', letterSpacing: -0.1 },

    // ── Buckets
    bucketHeader: {
        paddingHorizontal: 24,
        paddingTop: Spacing.two,
        paddingBottom: Spacing.two,
    },
    bucketLabel: {
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    bucketCard: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    bucketEmpty: { padding: Spacing.four },

    // ── Inbox row
    // paddingLeft tightened from 14 → 12 to make room for the leading
    // 6px unread dot (which sits at left: 4 + 8 gap from the icon
    // tile). Visually unchanged for read rows.
    inboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    leadingUnreadDot: {
        position: 'absolute',
        left: 4,
        top: 18,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    rowAvatarStack: {
        width: 32,
        height: 32,
        marginTop: 2,
        position: 'relative',
    },
    rowIconTile: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Avatar layered at the bottom-right of the icon tile. Border
    // tracks the row's bg color so the avatar reads as "punched out"
    // of the tile rather than floating above it. 14px is the same
    // size the design source uses.
    rowAvatarOverlay: {
        position: 'absolute',
        bottom: -3,
        right: -3,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowAvatarOverlayText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '700',
        fontFamily: FontFamily.sansSemiBold,
        lineHeight: 10,
    },
    rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mentionBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    mentionBadgeText: {
        fontSize: 8.5,
        letterSpacing: 0.3,
        lineHeight: 11,
    },
    rowMeta: { alignItems: 'flex-end', gap: 4, marginTop: 2 },
    rowTime: { fontSize: 10, letterSpacing: -0.2 },
    sampleBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    sampleBadgeText: {
        fontSize: 9,
        letterSpacing: 0.3,
    },

    // ── Sample note
    sampleNote: {
        marginHorizontal: 16,
        marginTop: Spacing.three,
        padding: Spacing.three,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },

    pressed: { opacity: 0.7 },
});

