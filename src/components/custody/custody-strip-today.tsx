// CustodyStripToday — compact status strip that lives on the Today screen
// between the AI command bar and the conflict card. Single-tap target →
// /custody/schedule.
//
// Design source: design_handoff_custody_surfaces — CustodyStripToday
// (screens-custody.jsx ~550-637) + README "Change 1 · Today".
//
// Layout:
//   • Top row: avatar + "You have the kids" / "X has the kids" (or
//     "Together this week" when both parents share) + WK chip + chevron
//   • Bottom row: 7-day CustodyWeekBar (today-dot + bold today label) +
//     next-handoff line + countdown
//
// Hides entirely when the household has no custody schedule (single-home
// families never see custody UI per README · "When to hide").

import { Feather } from '@expo/vector-icons';
import { differenceInHours, format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useCurrentWeekCustody } from '@/hooks/use-current-week-custody';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useChildren } from '@/hooks/use-children';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import {
    UNASSIGNED_COLOR,
    colorForResponsible,
    memberColorMap,
} from '@/lib/colors';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

import { CustodyWeekBar } from './custody-week-bar';

export function CustodyStripToday({
    householdId,
}: {
    householdId: string | undefined;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const router = useRouter();
    const { user } = useAuth();
    const { members } = useHouseholdMembers(householdId);
    const { children } = useChildren(householdId);
    const custody = useCurrentWeekCustody(householdId);
    // Pull the schedule's pattern id so the period chip can render
    // pattern-correct shorthand. Previously hardcoded "ALT" for every
    // pattern; the audit flagged it (HIGH) — 2-2-3 / 2-2-5-5 / 5-2 /
    // alternating-weekends households were all mislabeled.
    const { schedule } = useCustodySchedule(householdId);

    // README rule: hide entirely when there's no custody schedule —
    // single-home families never see custody UI.
    if (!custody) return null;

    const patternShortLabel = (() => {
        switch (schedule?.pattern_id) {
            case '7-7':
                return 'ALT';
            case '2-2-3':
                return '2-2-3';
            case '2-2-5-5':
                return '2-2-5-5';
            case '3-4-4-3':
                return '3-4-4-3';
            case '5-2':
                return '5-2';
            case 'alternating-weekends':
                return 'EOW';
            default:
                return 'WK';
        }
    })();

    const { weekCustody, nextHandoff } = custody;
    const colorMap = memberColorMap(members);

    // Top-row identity. "You have the kids" when current === viewer,
    // "X has the kids" otherwise, "Together this week" when bothPresent.
    const currentMember = (members ?? []).find(
        (m) => m.profile_id === weekCustody.currentParentId,
    );
    const currentColor = colorForResponsible(
        weekCustody.currentParentId,
        colorMap,
    );
    const isMe = !!user && weekCustody.currentParentId === user.id;
    const topLabel = weekCustody.bothPresent
        ? 'Together this week'
        : isMe
          ? 'You have the kids'
          : currentMember
            ? `${currentMember.display_name} has the kids`
            : 'No custodian set';

    // Week-number chip — ISO week number computed locally. Format follows
    // design's "ALT · WK 22" pattern; "ALT" is shorthand for "alternating
    // weeks" pattern style but reads as a generic period marker for users
    // on other patterns too.
    const weekNumber = isoWeekNumber(weekCustody.weekStart);

    // 7-day bar — map resolved custodian profile ids to identity colors.
    // 'AB' both-present days (#379) render with the dedicated `shared`
    // token. Previously used `accentSoft` which in dark mode was nearly
    // identical to the card background (1.49:1 contrast, below WCAG 3:1);
    // `colors.shared` is a brighter neutral in dark mode that clears the
    // contrast bar while staying the same pale tint in light mode.
    const days = weekCustody.days.map((r) => ({
        color: r.bothPresent
            ? colors.shared
            : colorForResponsible(r.profileId, colorMap),
    }));

    // Find the handoff index inside this week (or omit if the next
    // handoff is past Sunday). The next-handoff's day-of-week determines
    // the column the warn-tick anchors to.
    let handoffIndex: number | undefined = undefined;
    if (nextHandoff) {
        const dayDelta = Math.floor(
            (nextHandoff.at.getTime() - weekCustody.weekStart.getTime()) /
                86_400_000,
        );
        if (dayDelta >= 0 && dayDelta < 7) handoffIndex = dayDelta;
    }

    // Bottom-row next-handoff line. Look up the receiving parent + child
    // names (we don't actually know which kid hands off — that's a
    // per-child-pattern feature deferred for now — so the line shows only
    // parents until we have that data).
    const nextReceiver = nextHandoff
        ? (members ?? []).find(
              (m) => m.profile_id === nextHandoff.toProfileId,
          )
        : null;
    // Giver side — resolved from `fromProfileId` so the next-handoff line
    // reads "from → to" instead of "→ to" with an orphan arrow. The
    // audit's MEDIUM #15 flagged the orphan-arrow render. Falls through
    // to null when transitioning out of an AB both-present day (no
    // single parent gave up custody — the togetherness ends and one
    // parent leaves), in which case the line shortens to "→ Casey".
    const nextGiver = nextHandoff?.fromProfileId
        ? (members ?? []).find(
              (m) => m.profile_id === nextHandoff.fromProfileId,
          )
        : null;
    const nextReceiverColor = nextHandoff
        ? colorForResponsible(nextHandoff.toProfileId, colorMap)
        : UNASSIGNED_COLOR;
    const countdownLabel = nextHandoff
        ? formatCountdown(nextHandoff.at)
        : null;
    // Deferred — per-child handoff resolution needs the per-child
    // schedule layer in the README. For now, surface a single example
    // child name from `children` if any exist, otherwise just show parent
    // → parent. children is unused-but-kept for future wiring.
    void children;

    return (
        <View style={styles.outer}>
            <Pressable
                onPress={() => router.push('/custody/schedule')}
                accessibilityRole="button"
                accessibilityLabel={`${topLabel}. Open custody schedule.`}
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                    pressed && styles.pressed,
                ]}>
                {/* Top row */}
                <View
                    style={[
                        styles.topRow,
                        { borderBottomColor: colors.hair },
                    ]}>
                    {weekCustody.bothPresent ? (
                        <StackedAvatars
                            members={(members ?? []).slice(0, 2)}
                            colorMap={colorMap}
                        />
                    ) : (
                        <Avatar
                            initial={
                                currentMember?.display_name
                                    ?.charAt(0)
                                    .toUpperCase() ?? '?'
                            }
                            color={currentColor}
                        />
                    )}
                    <ThemedText
                        numberOfLines={1}
                        style={[styles.topLabel, { color: colors.text }]}>
                        {topLabel}
                    </ThemedText>
                    <View style={{ flex: 1 }} />
                    <ThemedText
                        style={[
                            styles.weekChip,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        {patternShortLabel} · WK {weekNumber}
                    </ThemedText>
                    <Feather
                        name="chevron-right"
                        size={12}
                        color={colors.inkFaint}
                    />
                </View>

                {/* Bottom row: bar + next-handoff line */}
                <View style={styles.bottom}>
                    <CustodyWeekBar
                        days={days}
                        todayIndex={weekCustody.todayIndex}
                        handoffIndex={handoffIndex}
                        size="sm"
                    />
                    {nextHandoff ? (
                        <View style={styles.nextRow}>
                            <View style={styles.nextLeft}>
                                <Avatar
                                    initial={
                                        nextReceiver?.display_name
                                            ?.charAt(0)
                                            .toUpperCase() ?? '?'
                                    }
                                    color={nextReceiverColor}
                                    size={14}
                                />
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        styles.nextLabel,
                                        { color: colors.inkSec },
                                    ]}>
                                    Next ·{' '}
                                    <ThemedText
                                        style={[
                                            styles.nextMono,
                                            {
                                                color: colors.text,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {format(nextHandoff.at, 'EEE HH:mm')}
                                    </ThemedText>
                                    {nextReceiver
                                        ? nextGiver
                                            ? ` · ${nextGiver.display_name} → ${nextReceiver.display_name}`
                                            : ` · → ${nextReceiver.display_name}`
                                        : ''}
                                </ThemedText>
                            </View>
                            {countdownLabel ? (
                                <ThemedText
                                    style={[
                                        styles.countdown,
                                        {
                                            color: colors.accent,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    {countdownLabel}
                                </ThemedText>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            </Pressable>
        </View>
    );
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function Avatar({
    initial,
    color,
    size = 22,
}: {
    initial: string;
    color: string;
    size?: number;
}) {
    return (
        <View
            style={[
                styles.avatar,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
            ]}>
            <ThemedText
                style={[
                    styles.avatarText,
                    { fontSize: size <= 14 ? 8 : 10 },
                ]}>
                {initial}
            </ThemedText>
        </View>
    );
}

function StackedAvatars({
    members,
    colorMap,
}: {
    members: Array<{ profile_id: string; display_name: string }>;
    colorMap: Map<string, string>;
}) {
    return (
        <View style={styles.stack}>
            {members.map((m, i) => {
                const c = colorForResponsible(m.profile_id, colorMap);
                return (
                    <View
                        key={m.profile_id}
                        style={[
                            styles.stackAvatar,
                            {
                                backgroundColor: c,
                                marginLeft: i === 0 ? 0 : -8,
                                zIndex: members.length - i,
                            },
                        ]}>
                        <ThemedText style={styles.avatarText}>
                            {m.display_name.charAt(0).toUpperCase()}
                        </ThemedText>
                    </View>
                );
            })}
        </View>
    );
}

/** Computes ISO 8601 week number (1-53) for the given date. */
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

/** "IN 2H", "IN 1D", "IN 6D", etc. Short mono format per design source. */
function formatCountdown(at: Date): string {
    const now = new Date();
    const hours = differenceInHours(at, now);
    if (hours <= 0) return 'NOW';
    if (hours < 24) return `IN ${hours}H`;
    const days = Math.round(hours / 24);
    return `IN ${days}D`;
}

const styles = StyleSheet.create({
    outer: { paddingHorizontal: 16, paddingBottom: 14 },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingTop: 11,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topLabel: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    weekChip: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    bottom: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 12,
    },
    nextRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    nextLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
        minWidth: 0,
    },
    nextLabel: { fontSize: 11.5, letterSpacing: -0.1 },
    nextMono: { fontSize: 11.5 },
    countdown: {
        fontSize: 10,
        letterSpacing: -0.1,
    },

    avatar: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: '600',
    },
    stack: { flexDirection: 'row' },
    stackAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    pressed: { opacity: 0.85 },
});
