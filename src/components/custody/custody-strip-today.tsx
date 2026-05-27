// CustodyStripToday — compact status strip that lives on the Today screen
// between the AI command bar and the conflict card.
//
// Now ships in THREE viewer modes (design_handoff_strip_variants
// README, #397 + #398):
//
//   • `coparent` (default) — the household's co-parents see the canonical
//     "You have the kids" / "X has the kids" framing. Tap routes to the
//     editable /custody/schedule. Existing behavior, unchanged.
//
//   • `caregiver` (#397) — nannies / grandparents / etc. read the strip
//     as observers. Labels shift to passive framing ("Alex is on duty
//     this week", "Casey takes Oliver"), the chevron disappears, a
//     `VIEWING` RoleBadge anchors the top-right, and tap routes to
//     /custody/view (read-only).
//
//   • `external` (#398) — external co-parents reading from outside the
//     household. The strip anchors to a single KID (the `childId` prop)
//     and replaces the household identity slot with a KidPOVHeader
//     ("SOPH'S WEEK" caps + state-driven headline). No pattern chip
//     (household-internal), no swap banner, no override path. Identity
//     colors split: in-household parent on the household side of the
//     7-day bar, the viewer's own color (from
//     `child_external_coparents.color`) on the external side.
//
// Hides entirely when the household has no custody schedule (single-home
// families never see custody UI). Resolution + multi-kid stacking for
// the external mode lives at the caller (Today screen + Family Hub).

import { Feather } from '@expo/vector-icons';
import { differenceInHours, format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { KidPOVHeader, RoleBadge } from '@/components/ds';
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

/** Viewer mode for the strip. See module comment for full semantics. */
export type StripViewer = 'coparent' | 'caregiver' | 'external';

export function CustodyStripToday({
    householdId,
    viewer = 'coparent',
    childId,
    externalViewerColor,
}: {
    householdId: string | undefined;
    /** Viewer-perspective mode. Caller decides — Today screen + Family
     *  Hub resolve the current user's role to a household before
     *  passing this prop. Defaults to 'coparent' so existing call sites
     *  keep their behavior. */
    viewer?: StripViewer;
    /** Required for `viewer="external"`. The kid the strip is scoped to.
     *  The external viewer's strip anchors per-kid rather than per-
     *  household. Ignored for the other two modes. */
    childId?: string;
    /** Identity color for the external viewer themselves. Pulled from
     *  `child_external_coparents.color` at the caller (one DB read
     *  there feeds multiple stacked strips). Null falls back to a
     *  stable palette pick. Used only when viewer === 'external'. */
    externalViewerColor?: string | null;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const router = useRouter();
    const { user } = useAuth();
    const { members } = useHouseholdMembers(householdId);
    const { children } = useChildren(householdId);
    const custody = useCurrentWeekCustody(householdId);
    const isReadOnly = viewer === 'caregiver' || viewer === 'external';
    const isExternal = viewer === 'external';
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

    // Top-row identity. Caregiver mode swaps to observer framing — the
    // viewer isn't a party to the hand-off, so passive copy lifts the
    // kids out of the subject line. External mode replaces this whole
    // slot with a KidPOVHeader rendered separately below.
    const currentMember = (members ?? []).find(
        (m) => m.profile_id === weekCustody.currentParentId,
    );
    const currentColor = colorForResponsible(
        weekCustody.currentParentId,
        colorMap,
    );
    const isMe = !!user && weekCustody.currentParentId === user.id;
    // Caregiver-observer framing: "Alex is on duty this week" / "Alex &
    // Riley both on duty" (#397 README · Top label). Co-parent default
    // keeps the existing "You have / X has the kids" phrasing.
    const coparentTopLabel = weekCustody.bothPresent
        ? 'Together this week'
        : isMe
          ? 'You have the kids'
          : currentMember
            ? `${currentMember.display_name} has the kids`
            : 'No custodian set';
    const caregiverTopLabel = weekCustody.bothPresent
        ? // Two-member stack to render "Alex & Riley both on duty" we
          // pull the first two members' names. Deferred to product Q5
          // (settled "keep neutral"), so the label intentionally
          // doesn't prescribe caregiver action.
          (() => {
              const onDuty = (members ?? [])
                  .filter((m) => m.role === 'parent')
                  .slice(0, 2)
                  .map((m) => m.display_name);
              return onDuty.length === 2
                  ? `${onDuty[0]} & ${onDuty[1]} both on duty`
                  : 'Both parents on duty';
          })()
        : currentMember
          ? `${currentMember.display_name} is on duty this week`
          : 'No parent on duty';
    const topLabel =
        viewer === 'caregiver' ? caregiverTopLabel : coparentTopLabel;

    // External viewer needs the kid the strip is scoped to. Caller
    // passes childId; we look it up from the household's children list.
    // When the lookup fails (child belongs to a different household or
    // RLS hasn't loaded it yet), the strip degrades gracefully — the
    // KidPOVHeader gets a fallback name rather than the strip hiding
    // entirely (so the surface doesn't flicker while children loads).
    const stripChild = isExternal
        ? (children ?? []).find((c) => c.id === childId) ?? null
        : null;

    // Headline for the external strip. State-driven copy per #398
    // README: `With Alex · comes to you Fri` / `With you · returns to
    // Alex Wed` / `<kid> comes to you today`. The detection logic
    // mirrors the co-parent strip's resolver — we already know
    // currentParentId + bothPresent + nextHandoff.
    const externalHeadline = (() => {
        if (!stripChild || !user) return '';
        const currentlyWithViewer =
            weekCustody.currentParentId === user.id;
        const isHandoffToday =
            !!custody.nextHandoff &&
            isSameLocalDay(custody.nextHandoff.at, new Date());
        const nextOtherSide = (members ?? []).find(
            (m) => m.profile_id === custody.nextHandoff?.toProfileId,
        );
        if (isHandoffToday) {
            return `${stripChild.display_name} comes to you today`;
        }
        if (currentlyWithViewer) {
            const returnsTo = (members ?? []).find(
                (m) => m.profile_id === custody.nextHandoff?.toProfileId,
            );
            return returnsTo
                ? `With you · returns to ${returnsTo.display_name} ${formatHandoffShort(custody.nextHandoff?.at)}`
                : 'With you';
        }
        const withWhom = currentMember;
        return withWhom
            ? `With ${withWhom.display_name} · comes to you ${formatHandoffShort(custody.nextHandoff?.at)}`
            : '';
        void nextOtherSide;
    })();

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
    //
    // External viewer (#398) — the resolver returns the external
    // viewer's own profileId on days they have custody, but that
    // profile isn't in the household_members list so memberColorMap
    // returns UNASSIGNED. Patch the lookup so the viewer's day shows
    // their own identity color (passed in by the caller from
    // child_external_coparents.color, with a stable fallback).
    const externalFallbackColor = colors.accent;
    const days = weekCustody.days.map((r) => {
        if (r.bothPresent) return { color: colors.shared };
        if (isExternal && r.profileId === user?.id) {
            return {
                color: externalViewerColor || externalFallbackColor,
            };
        }
        return { color: colorForResponsible(r.profileId, colorMap) };
    });

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

    // Tap target — read-only viewers go to /custody/view (role-scoped
     // viewer that doesn't expose Pattern editor or FAB). External
     // viewers carry the kid id forward so the view scopes to one kid.
    const onCardPress = () => {
        if (isExternal && childId) {
            router.push({
                pathname: '/custody/view',
                params: { childId },
            });
        } else if (isReadOnly) {
            router.push('/custody/view');
        } else {
            router.push('/custody/schedule');
        }
    };

    return (
        <View style={styles.outer}>
            <Pressable
                onPress={onCardPress}
                accessibilityRole="button"
                accessibilityLabel={
                    isExternal
                        ? `${stripChild?.display_name ?? 'Child'}'s week. ${externalHeadline}. Open custody view.`
                        : `${topLabel}. ${isReadOnly ? 'Open custody view' : 'Open custody schedule'}.`
                }
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                    pressed && styles.pressed,
                ]}>
                {/* Top row — three branches by viewer:
                    • external: kid avatar + KidPOVHeader + VIEWING badge
                    • caregiver: avatar + observer label + pattern chip + VIEWING
                    • coparent (default): existing render w/ chevron */}
                <View
                    style={[
                        styles.topRow,
                        { borderBottomColor: colors.hair },
                    ]}>
                    {isExternal ? (
                        <>
                            <Avatar
                                initial={
                                    stripChild?.display_name
                                        ?.charAt(0)
                                        .toUpperCase() ?? '?'
                                }
                                color={
                                    stripChild?.color ?? UNASSIGNED_COLOR
                                }
                            />
                            <KidPOVHeader
                                kidName={
                                    stripChild?.display_name ?? 'Child'
                                }
                                headline={externalHeadline}
                            />
                            <RoleBadge kind="viewing" />
                        </>
                    ) : (
                        <>
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
                                style={[
                                    styles.topLabel,
                                    { color: colors.text },
                                ]}>
                                {topLabel}
                            </ThemedText>
                            <View style={{ flex: 1 }} />
                            <ThemedText
                                style={[
                                    styles.weekChip,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily:
                                            FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {patternShortLabel} · WK {weekNumber}
                            </ThemedText>
                            {viewer === 'caregiver' ? (
                                <RoleBadge kind="viewing" />
                            ) : (
                                <Feather
                                    name="chevron-right"
                                    size={12}
                                    color={colors.inkFaint}
                                />
                            )}
                        </>
                    )}
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
                                {/* Avatar — for external mode anchored to
                                    the in-household parent (giver), since
                                    the viewer themselves is the 2nd-person
                                    actor and shouldn't appear as an
                                    avatar (#398 README · Identity in the
                                    next-handoff line). */}
                                <Avatar
                                    initial={
                                        isExternal
                                            ? nextGiver?.display_name
                                                  ?.charAt(0)
                                                  .toUpperCase() ?? '?'
                                            : nextReceiver?.display_name
                                                  ?.charAt(0)
                                                  .toUpperCase() ?? '?'
                                    }
                                    color={
                                        isExternal
                                            ? colorForResponsible(
                                                  nextHandoff.fromProfileId,
                                                  colorMap,
                                              )
                                            : nextReceiverColor
                                    }
                                    size={14}
                                />
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        styles.nextLabel,
                                        { color: colors.inkSec },
                                    ]}>
                                    {viewer === 'caregiver' &&
                                    nextReceiver ? (
                                        // Caregiver passive framing
                                        // (#397): "Casey takes Oliver
                                        // Wed 17:00". Kid name omitted
                                        // until per-child resolution
                                        // lands; fallback reads "Casey
                                        // takes the kids".
                                        <>
                                            {nextReceiver.display_name}{' '}
                                            takes the kids ·{' '}
                                            <ThemedText
                                                style={[
                                                    styles.nextMono,
                                                    {
                                                        color: colors.text,
                                                        fontFamily:
                                                            FontFamily.monoMedium,
                                                    },
                                                ]}>
                                                {format(
                                                    nextHandoff.at,
                                                    'EEE HH:mm',
                                                )}
                                            </ThemedText>
                                        </>
                                    ) : isExternal ? (
                                        // External 2nd-person actor
                                        // (#398): "You take Soph Fri 17:00"
                                        // when the viewer is the receiver,
                                        // "<HouseholdParent> takes Soph
                                        // <date>" when handing back.
                                        nextHandoff.toProfileId ===
                                        user?.id ? (
                                            <>
                                                You take{' '}
                                                {stripChild?.display_name ??
                                                    'them'}{' '}
                                                ·{' '}
                                                <ThemedText
                                                    style={[
                                                        styles.nextMono,
                                                        {
                                                            color: colors.text,
                                                            fontFamily:
                                                                FontFamily.monoMedium,
                                                        },
                                                    ]}>
                                                    {format(
                                                        nextHandoff.at,
                                                        'EEE HH:mm',
                                                    )}
                                                </ThemedText>
                                            </>
                                        ) : (
                                            <>
                                                {nextReceiver?.display_name ??
                                                    'Parent'}{' '}
                                                takes{' '}
                                                {stripChild?.display_name ??
                                                    'them'}{' '}
                                                ·{' '}
                                                <ThemedText
                                                    style={[
                                                        styles.nextMono,
                                                        {
                                                            color: colors.text,
                                                            fontFamily:
                                                                FontFamily.monoMedium,
                                                        },
                                                    ]}>
                                                    {format(
                                                        nextHandoff.at,
                                                        'EEE HH:mm',
                                                    )}
                                                </ThemedText>
                                            </>
                                        )
                                    ) : (
                                        // Default co-parent framing.
                                        <>
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
                                                {format(
                                                    nextHandoff.at,
                                                    'EEE HH:mm',
                                                )}
                                            </ThemedText>
                                            {nextReceiver
                                                ? nextGiver
                                                    ? ` · ${nextGiver.display_name} → ${nextReceiver.display_name}`
                                                    : ` · → ${nextReceiver.display_name}`
                                                : ''}
                                        </>
                                    )}
                                </ThemedText>
                            </View>
                            {countdownLabel ? (
                                <ThemedText
                                    style={[
                                        styles.countdown,
                                        {
                                            // Caregiver-soft countdown
                                            // by default (#397). Alert
                                            // wiring lands with Phase G
                                            // (#489) once the brief-
                                            // task generator exists.
                                            color:
                                                viewer === 'caregiver'
                                                    ? colors.inkSec
                                                    : colors.accent,
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

/** True when `a` and `b` are the same calendar day in local timezone.
 *  Used by the external-viewer headline to detect "comes to you today"
 *  states. Local-tz comparison matches the cycleIndexForDate convention
 *  fixed in the Tokyo-tz regression — never compare on Date.toISOString. */
function isSameLocalDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/** Three-letter weekday for headline copy. "Fri" / "Wed" / etc. Falls
 *  through to empty string for an undefined date so the calling
 *  template renders cleanly when nextHandoff is null. */
function formatHandoffShort(at: Date | undefined): string {
    if (!at) return '';
    return format(at, 'EEE');
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
