// Family Hub — central hub for household chrome (members, custody, kids,
// settings access). Replaces the Contacts + Settings top-level tabs per the
// Phase 6 redesign (screens-extra.jsx:885-1133). Reached via the new "Family"
// tab in the bottom nav.
//
// Layout sections (top to bottom):
//   1. Header bar: mono pretitle ("HOUSEHOLD · TYPE · N PEOPLE") + "Family"
//      title + bell / gear / avatar trio.
//   2. Household hero card: this-week pretitle + current-custodian title +
//      ALT.WEEKS pill + mini 7-day custody bar + next hand-off footer.
//   3. People section: members card with role chips + sub label.
//   4. Kids section: 2-column KidCard grid.
//   5. Manage section: card with NavRows linking to Custody schedule,
//      Contacts, Connected calendars, Settings.
//   6. Recent activity: DEFERRED to a later phase (no eventing pipeline yet
//      — Phase 6 product call was to skip the section entirely rather than
//      show a fake empty state).

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { CustodyWeekBar } from '@/components/custody/custody-week-bar';
import { HairlineDivider, SectionHeader } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useSwapRequests } from '@/hooks/use-swap-requests';
import { useCurrentWeekCustody } from '@/hooks/use-current-week-custody';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useExternalCalendars } from '@/hooks/use-external-calendars';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { useThemePreference, useAppColorScheme } from '@/providers/theme-provider';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { findPattern } from '@/lib/custody';
import type {
    Child,
    HouseholdMember,
    HouseholdType,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';

// Widened to accept both light + dark palette literal types — see the same
// pattern in (app)/index.tsx. Without this, `(typeof Colors)['light']`
// infers the exact hex strings of the light palette only.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Compact (uppercased) household-type label for the mono pretitle. The full
// labels in HOUSEHOLD_TYPE_OPTIONS ("Just me + my kids" etc.) are tuned for
// the onboarding picker — too long to sit inline with the household name.
function compactHouseholdType(t: HouseholdType): string {
    switch (t) {
        case 'single_parent':
            return 'SOLO';
        case 'couple':
            return 'COUPLE';
        case 'separated':
            return 'CO-PARENTING';
    }
}

// Mist Forest (light) / Charcoal Forest (dark) display label for the Settings
// nav row's right-side meta. Mirrors the design's "Theme · Mist Forest" copy.
// `system` follows the OS — show the resolved label with a trailing "· Auto"
// so the nav row reflects both the preference AND what's actually rendering.
function themeDisplayName(
    pref: 'light' | 'dark' | 'system',
    resolved: 'light' | 'dark',
): string {
    if (pref === 'system') {
        return resolved === 'dark' ? 'Charcoal · Auto' : 'Mist · Auto';
    }
    return resolved === 'dark' ? 'Charcoal Forest' : 'Mist Forest';
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function FamilyHubScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const { preference: themePreference } = useThemePreference();
    const { user } = useAuth();

    const { households } = useHouseholds();
    const household = households?.[0];
    const {
        members,
        isLoading: membersLoading,
        refetch: refetchMembers,
    } = useHouseholdMembers(household?.id);
    const { children, refetch: refetchChildren } = useChildren(household?.id);
    const { schedule: custodySchedule, refetch: refetchCustody } =
        useCustodySchedule(household?.id);
    const { calendars: externalCalendars } = useExternalCalendars();

    // Refresh members + children whenever Family Hub regains focus, so
    // color/name edits made in /settings/profile, /child/[id], or
    // /settings/members reflect immediately when the user navigates
    // back. Each useHouseholdMembers / useChildren instance has its
    // own state (no shared cache), so the editor's local refetch
    // doesn't propagate to peer screens without this.
    useFocusEffect(
        // Custody refetch added (audit MEDIUM #21): Stop / Save in the
        // pattern editor mutates the schedule but only refetches the
        // editor's own useCustodySchedule instance. Without this, popping
        // back to the hub showed the stale hero until something else
        // triggered a re-fetch. Same applies to swap-request changes
        // (eventual #399).
        useCallback(() => {
            refetchMembers();
            refetchChildren();
            refetchCustody();
        }, [refetchMembers, refetchChildren, refetchCustody]),
    );
    // No FAB on Family Hub — the canonical FamilyHubV2 canvas
    // (onenest-spec-v3/design_handoff_calendar_conflicts §07.1) omits
    // it, on the principle that Family is the one multi-kind tab where
    // create affordances already live in-context (Invite member inline
    // at the bottom of People, Kids section's own add affordance, and
    // Add contact lives on the Contacts tab). A chooser FAB here would
    // duplicate surfaces that are already visible above the fold.

    // Hide all member-dependent chrome until the members fetch resolves —
    // without this guard the header pretitle briefly reads "0 PEOPLE" and the
    // People card renders empty for the first ~150ms after navigating in.
    // The members hook returns isLoading:true on mount even when households
    // is already cached by the parent (_layout) since each useHouseholdMembers
    // call has its own state.
    const dataReady = !!household && !membersLoading;

    // Custody surfaces v2 — single composed hook replaces the per-screen
    // resolver. The hero, the Today strip, and the schedule viewer all read
    // from the same source so a per-child schedule layer (planned, README
    // "Future · Per-child patterns") only needs to land once.
    const custody = useCurrentWeekCustody(household?.id);
    const colorMap = useMemo(() => memberColorMap(members ?? []), [members]);

    // Per-day color array consumed by the shared CustodyWeekBar primitive.
    // bar primitive does its own light/dark alpha treatment.
    //
    // 'AB' both-present days (#379) render with the dedicated `shared`
    // token (was `accentSoft`; bumped after post-fix audit found
    // dark-mode contrast too low — see `theme.ts` shared token comment).
    const weekBarDays = useMemo(() => {
        if (!custody) return [];
        return custody.weekCustody.days.map((r) => ({
            color: r.bothPresent
                ? colors.shared
                : colorForResponsible(r.profileId, colorMap),
        }));
    }, [custody, colorMap, colors.shared]);

    // Count of custodian transitions this week — used in the hero title
    // ("Alex's week · 4 hand-offs"). A transition is any adjacent day-pair
    // where the resolved STATE differs — full tuple comparison so
    // A→AB and AB→A count too (the household's daily reality genuinely
    // changes). Previous version short-circuited on `a && b` which
    // treated AB days (profileId null) as "no data" and missed them.
    const weekHandoffCount = useMemo(() => {
        if (!custody) return 0;
        const days = custody.weekCustody.days;
        let n = 0;
        for (let i = 1; i < days.length; i++) {
            const a = days[i - 1];
            const b = days[i];
            if (!a || !b) continue;
            if (
                a.profileId !== b.profileId ||
                a.bothPresent !== b.bothPresent
            ) {
                n += 1;
            }
        }
        return n;
    }, [custody]);

    // Hero "Alex's week" — viewed parent (the current-week custodian today).
    // When the household has no schedule we fall through to the single/couple
    // hero variant below.
    const todayCustodian = useMemo(() => {
        if (!custody) return null;
        return (
            members?.find(
                (m) => m.profile_id === custody.weekCustody.currentParentId,
            ) ?? null
        );
    }, [custody, members]);

    // "Next · Wed 17:00 · Oliver → Casey" — receiver lookup off the shared
    // hook's nextHandoff. README convention: hand-off lands at 18:00 local on
    // the giving-up parent's last day (resolved inside the hook).
    const nextReceiver = useMemo(() => {
        if (!custody?.nextHandoff) return null;
        return (
            members?.find(
                (m) => m.profile_id === custody.nextHandoff!.toProfileId,
            ) ?? null
        );
    }, [custody, members]);
    const nextGiver = useMemo(() => {
        if (!custody?.nextHandoff) return null;
        return (
            members?.find(
                (m) => m.profile_id === custody.nextHandoff!.fromProfileId,
            ) ?? null
        );
    }, [custody, members]);

    // Find the handoff index inside this week's bar. README spec puts the
    // warn-tick on the giving-up parent's last day column. Omits when next
    // handoff has scrolled past Sunday.
    const heroHandoffIndex = useMemo(() => {
        if (!custody?.nextHandoff) return undefined;
        const delta = Math.floor(
            (custody.nextHandoff.at.getTime() -
                custody.weekCustody.weekStart.getTime()) /
                86_400_000,
        );
        if (delta < 0 || delta >= 7) return undefined;
        return delta;
    }, [custody]);

    // Caregiver role gates the swap banner (#372 post-fix audit): RLS
    // still lets caregivers READ swap_requests rows, but they can't act
    // on them ("Co-parent requested" copy is wrong for a third party).
    // #397/#398 will own the caregiver custody-UI story; for now we
    // simply hide.
    const { isCaregiver } = useMyRole(household?.id);

    // Pending swap requests (#372). Read-only banner — accept/decline
    // lives in /custody/schedule's Pending section (and eventually #399's
    // dedicated review screen). We shape the raw rows into the
    // banner's display contract right here so the JSX stays compact.
    const { requests: pendingSwapRequests } = useSwapRequests(
        isCaregiver ? undefined : household?.id,
        'pending',
    );
    const pendingSwaps = useMemo(() => {
        // Exclude swaps the viewer themselves requested. The banner
        // reads "<requester> requested a swap" and offers a REVIEW chip
        // — that framing is wrong when the viewer IS the requester.
        // (#399 will own the awaiting-decision affordance for the
        // requester's own swaps; right now the request just sits.)
        return (pendingSwapRequests ?? [])
            .filter((s) => s.requested_by_profile_id !== user?.id)
            .map((s) => {
            const requester =
                members?.find(
                    (m) => m.profile_id === s.requested_by_profile_id,
                ) ?? null;
            // Range label collapses to "Fri Jun 12" for single-day swaps
            // and "Fri Jun 12–Sun Jun 14" for multi-day. Date-fns
            // formatters keep the locale-agnostic output the design uses.
            // parseISO treats date-only YYYY-MM-DD strings as local
            // midnight — exactly what an all-day swap-request row means.
            // Previously used `new Date(s.from_date)` which parses
            // YYYY-MM-DD as UTC midnight; combined with local-tz
            // formatting that rolled the displayed date back a day in
            // any tz west of UTC (CRITICAL #4 of custody audit).
            const fromDate = parseISO(s.from_date);
            const toDate = parseISO(s.to_date);
            const sameDay = s.from_date === s.to_date;
            const rangeLabel = sameDay
                ? format(fromDate, 'EEE MMM d')
                : `${format(fromDate, 'EEE MMM d')}–${format(toDate, 'EEE MMM d')}`;
            return {
                id: s.id,
                requesterName: requester?.display_name ?? 'Co-parent',
                rangeLabel,
            };
        });
    }, [pendingSwapRequests, members, user?.id]);

    // Connected-calendar status text: "GOOGLE" pill (or "MICROSOFT" / null).
    // Multi-account households can have both; we surface the first ACTIVE one
    // for the compact pill — the full list (and connect / disconnect controls)
    // lives inside Settings. The actual tokens live in Vault per migration
    // 0017, so we use is_active as the "connected and working" signal.
    const connectedCalendarLabel = useMemo(() => {
        const first = externalCalendars?.find((c) => c.is_active);
        if (!first) return null;
        return first.provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
    }, [externalCalendars]);

    const householdType = household?.household_type ?? 'couple';
    const isSeparated = householdType === 'separated';

    const peopleCount = members?.length ?? 0;
    const childCount = children?.length ?? 0;
    const custodyPatternLabel = custodySchedule
        ? findPattern(custodySchedule.pattern_id)?.label ?? custodySchedule.pattern_id
        : 'Not set';

    const currentUser = members?.find((m) => m.profile_id === user?.id) ?? null;

    // Gate the whole screen on dataReady so the header pretitle doesn't flash
    // "— · COUPLE · 0 PEOPLE" while members fetches. Parent layout already
    // ensures households is loaded — this just smooths over the per-screen
    // member-fetch window. LoadingScreen is the same component used by Home.
    if (!dataReady) {
        return <LoadingScreen />;
    }

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Header — mono pretitle, "Family" title, bell + gear +
                        avatar trio on the right. Tap targets:
                          • bell → Phase 10 notifications inbox (no-op for now)
                          • gear → /settings (Manage card also links there
                            with more context; the gear is a one-tap shortcut)
                          • avatar → /settings, opening the profile section. */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <ThemedText
                                style={[
                                    styles.headerPretitle,
                                    { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                                ]}
                                numberOfLines={1}>
                                {(household?.name ?? '—').toUpperCase()} ·{' '}
                                {compactHouseholdType(householdType)} · {peopleCount}{' '}
                                {peopleCount === 1 ? 'PERSON' : 'PEOPLE'}
                            </ThemedText>
                            <ThemedText
                                style={[
                                    Typography.titleSecondary,
                                    { color: colors.text, marginTop: 1 },
                                ]}>
                                Family
                            </ThemedText>
                        </View>
                        <View style={styles.headerActions}>
                            {/* Bell button — opens the NotificationsInbox at
                                /notifications (#363 shipped Phase 10). Was
                                rendered inert with opacity 0.45 while the
                                inbox was a stub; with the route now live
                                we drop the dimmer and wire it through.
                                UX-audit fix: "first-tap feels broken"
                                affordances should either be live or
                                removed — live it is. */}
                            <Pressable
                                onPress={() => router.push('/notifications')}
                                accessibilityRole="button"
                                accessibilityLabel="Notifications"
                                style={({ pressed }) => [
                                    styles.headerIconBtn,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather name="bell" size={14} color={colors.text} />
                            </Pressable>
                            <Pressable
                                onPress={() => router.push('/settings')}
                                accessibilityRole="button"
                                accessibilityLabel="Settings"
                                style={({ pressed }) => [
                                    styles.headerIconBtn,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather name="settings" size={14} color={colors.text} />
                            </Pressable>
                            {currentUser ? (
                                <Pressable
                                    // Phase 6.7 icon-audit fix: avatar opens
                                    // the user's profile editor directly,
                                    // not the general Settings screen. The
                                    // gear icon (above) still routes to
                                    // /settings — two distinct affordances
                                    // for two distinct destinations. Matches
                                    // the standard "avatar = my profile"
                                    // pattern across iOS / Material.
                                    onPress={() => router.push('/settings/profile')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Profile">
                                    <View
                                        style={[
                                            styles.headerAvatar,
                                            {
                                                backgroundColor:
                                                    currentUser.color ?? colors.accent,
                                            },
                                        ]}>
                                        <ThemedText style={styles.headerAvatarText}>
                                            {(
                                                currentUser.display_name?.[0] ?? '?'
                                            ).toUpperCase()}
                                        </ThemedText>
                                    </View>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>

                    {/* Custody hero — v2 design (custody-as-hero promotion,
                        replaces the legacy "mini custody" card AND removes
                        the Manage > Custody nav row, which now lives behind
                        the hero's tap target). Section label sits ABOVE the
                        card per the v2 spec so the card itself reads as the
                        primary surface, not a settings list item.

                        Single-home families (single_parent / couple) still
                        get the simpler household-snapshot card — same
                        rationale as before: no custody pattern to
                        visualize. */}
                    {isSeparated && custody ? (
                        <>
                            <View style={styles.heroSectionLabelWrap}>
                                <ThemedText
                                    style={[
                                        styles.heroSectionLabel,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    CUSTODY SCHEDULE
                                </ThemedText>
                            </View>
                            <Pressable
                                onPress={() => router.push('/custody/schedule')}
                                accessibilityRole="button"
                                accessibilityLabel="Open custody schedule"
                                style={({ pressed }) => [
                                    styles.heroCardV2,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <View style={styles.heroTopV2}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <View style={styles.heroPretitleRow}>
                                            {todayCustodian ? (
                                                <View
                                                    style={[
                                                        styles.heroPretitleAvatar,
                                                        {
                                                            backgroundColor:
                                                                colorForResponsible(
                                                                    todayCustodian.profile_id,
                                                                    colorMap,
                                                                ),
                                                        },
                                                    ]}>
                                                    <ThemedText
                                                        style={
                                                            styles.heroPretitleAvatarText
                                                        }>
                                                        {(
                                                            todayCustodian.display_name?.[0] ??
                                                            '?'
                                                        ).toUpperCase()}
                                                    </ThemedText>
                                                </View>
                                            ) : null}
                                            <ThemedText
                                                style={[
                                                    styles.heroPretitle,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                THIS WEEK
                                            </ThemedText>
                                        </View>
                                        <ThemedText
                                            style={[
                                                styles.heroTitle,
                                                {
                                                    color: colors.text,
                                                    marginTop: 4,
                                                },
                                            ]}
                                            numberOfLines={1}>
                                            {todayCustodian
                                                ? `${todayCustodian.display_name}'s week`
                                                : 'This week'}
                                            {weekHandoffCount > 0
                                                ? ` · ${weekHandoffCount} hand-${weekHandoffCount === 1 ? 'off' : 'offs'}`
                                                : ''}
                                        </ThemedText>
                                    </View>
                                    <View
                                        style={[
                                            styles.altPill,
                                            {
                                                backgroundColor: withAlpha(
                                                    colors.accent,
                                                    0.13,
                                                ),
                                            },
                                        ]}>
                                        <View
                                            style={[
                                                styles.altPillDot,
                                                {
                                                    backgroundColor:
                                                        colors.accent,
                                                },
                                            ]}
                                        />
                                        <ThemedText
                                            style={[
                                                styles.altPillText,
                                                {
                                                    color: colors.accent,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            {custodyPatternLabel.toUpperCase()}
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Shared CustodyWeekBar primitive — same
                                    component used by Today strip / viewer /
                                    editor preview, so a future visual change
                                    touches one file. md size matches the
                                    20px-tall hero spec. */}
                                <CustodyWeekBar
                                    days={weekBarDays}
                                    todayIndex={custody.weekCustody.todayIndex}
                                    handoffIndex={heroHandoffIndex}
                                    size="md"
                                />

                                {/* Footer — "Next · Wed 17:00 · Oliver →
                                    Casey" + "OPEN SCHEDULE →" CTA. The whole
                                    card is tappable so the CTA is visual
                                    affordance only (no separate tap target). */}
                                {custody.nextHandoff ? (
                                    <View
                                        style={[
                                            styles.heroFooterV2,
                                            { borderTopColor: colors.hair },
                                        ]}>
                                        <ThemedText
                                            numberOfLines={1}
                                            style={[
                                                styles.heroFooterText,
                                                {
                                                    color: colors.inkSec,
                                                    flex: 1,
                                                },
                                            ]}>
                                            Next ·{' '}
                                            <ThemedText
                                                style={{
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                    color: colors.text,
                                                }}>
                                                {format(
                                                    custody.nextHandoff.at,
                                                    'EEE HH:mm',
                                                )}
                                            </ThemedText>
                                            {nextGiver && nextReceiver
                                                ? ` · ${nextGiver.display_name} → ${nextReceiver.display_name}`
                                                : nextReceiver
                                                  ? ` · → ${nextReceiver.display_name}`
                                                  : ''}
                                        </ThemedText>
                                        <View style={styles.heroOpenCta}>
                                            <ThemedText
                                                style={[
                                                    styles.heroOpenCtaText,
                                                    {
                                                        color: colors.accent,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                OPEN SCHEDULE
                                            </ThemedText>
                                            <Feather
                                                name="chevron-right"
                                                size={12}
                                                color={colors.accent}
                                            />
                                        </View>
                                    </View>
                                ) : null}

                                {/* Pending swap banner (#372) — warn-tinted
                                    strip below the footer when there are
                                    outstanding swap requests. Now backed by
                                    the real swap_requests table (migration
                                    0048). Tap routes to /custody/schedule
                                    with ?focus=pending so the schedule
                                    surfaces its Pending section (the full
                                    accept/decline review UI lands in #399). */}
                                {pendingSwaps.length > 0 ? (
                                    <Pressable
                                        onPress={(e) => {
                                            // Prevent the outer hero
                                            // Pressable from also firing.
                                            // The hero opens the schedule
                                            // at its default scroll
                                            // position; the banner opens
                                            // it scrolled to Pending.
                                            e.stopPropagation();
                                            router.push(
                                                '/custody/schedule?focus=pending',
                                            );
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Review swap request from ${pendingSwaps[0]!.requesterName}`}
                                        style={({ pressed }) => [
                                            styles.swapBanner,
                                            {
                                                backgroundColor: withAlpha(
                                                    colors.warn,
                                                    0.09,
                                                ),
                                                borderColor: withAlpha(
                                                    colors.warn,
                                                    0.27,
                                                ),
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <Feather
                                            name="repeat"
                                            size={12}
                                            color={colors.warn}
                                        />
                                        {/* Two-line layout: name + verb on
                                            line 1, mono range label on line 2.
                                            At 402px width with the icon + REVIEW
                                            chip flanking, single-line truncated
                                            the date for any name >12 chars
                                            (audit #330 MEDIUM #1). */}
                                        <View style={{ flex: 1, gap: 1 }}>
                                            <ThemedText
                                                numberOfLines={1}
                                                style={[
                                                    styles.swapBannerText,
                                                    { color: colors.text },
                                                ]}>
                                                {pendingSwaps[0]!.requesterName}{' '}
                                                requested a swap
                                            </ThemedText>
                                            <ThemedText
                                                numberOfLines={1}
                                                style={{
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                    color: colors.inkSec,
                                                    fontSize: 11,
                                                    letterSpacing: -0.1,
                                                }}>
                                                {pendingSwaps[0]!.rangeLabel}
                                            </ThemedText>
                                        </View>
                                        <ThemedText
                                            style={[
                                                styles.swapBannerCta,
                                                {
                                                    color: colors.warn,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            REVIEW
                                        </ThemedText>
                                    </Pressable>
                                ) : null}
                            </Pressable>
                        </>
                    ) : (
                        // Simplified hero card for single_parent / couple.
                        // No custody pattern to visualize — show people and
                        // kid counts as the snapshot summary instead.
                        <View
                            style={[
                                styles.heroCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.heroPretitle,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                YOUR HOUSEHOLD
                            </ThemedText>
                            <ThemedText
                                style={[
                                    styles.heroTitle,
                                    { color: colors.text, marginTop: 2 },
                                ]}>
                                {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                                {childCount > 0
                                    ? ` · ${childCount} ${childCount === 1 ? 'kid' : 'kids'}`
                                    : ''}
                            </ThemedText>
                        </View>
                    )}

                    {/* People section */}
                    <View style={styles.sectionHead}>
                        <SectionHeader
                            label={`People · ${peopleCount}`}
                            rightSlot={
                                <Pressable
                                    onPress={() =>
                                        router.push('/settings/members')
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel="Invite people">
                                    <ThemedText
                                        style={[
                                            styles.sectionRightLink,
                                            {
                                                color: colors.accent,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        + INVITE
                                    </ThemedText>
                                </Pressable>
                            }
                        />
                    </View>
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {(members ?? []).map((m, i) => (
                            <View key={m.profile_id}>
                                {i > 0 ? <HairlineDivider insetLeft={Spacing.three} /> : null}
                                <PersonRow
                                    member={m}
                                    isCurrentUser={m.profile_id === user?.id}
                                    colors={colors}
                                />
                            </View>
                        ))}
                    </View>

                    {/* Kids section. Hidden entirely for households with no
                        children — adds a "+ ADD" link in the empty state via
                        the section header itself so the surface stays useful. */}
                    <View style={styles.sectionHead}>
                        <SectionHeader
                            label={`Kids · ${childCount}`}
                            rightSlot={
                                <Pressable
                                    onPress={() => router.push('/child/new')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Add a child">
                                    <ThemedText
                                        style={[
                                            styles.sectionRightLink,
                                            {
                                                color: colors.accent,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        + ADD
                                    </ThemedText>
                                </Pressable>
                            }
                        />
                    </View>
                    {childCount > 0 ? (
                        <View style={styles.kidGrid}>
                            {(children ?? []).map((c) => (
                                <KidCard
                                    key={c.id}
                                    child={c}
                                    members={members ?? []}
                                    colors={colors}
                                    onPress={() => router.push(`/child/${c.id}`)}
                                />
                            ))}
                        </View>
                    ) : (
                        <View
                            style={[
                                styles.emptyCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <ThemedText
                                style={[Typography.bodySm, { color: colors.textSecondary }]}>
                                No kids yet. Tap + ADD to start a roster.
                            </ThemedText>
                        </View>
                    )}

                    {/* Manage section — the new home for Custody schedule,
                        Contacts, Connected calendars, and Settings deep links.
                        Each NavRow renders an icon + title + right-side mono
                        summary + chevron, mirroring iOS Settings convention. */}
                    <View style={styles.sectionHead}>
                        <SectionHeader label="Manage" />
                    </View>
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {/* Custody surfaces v2: the Custody row was removed
                            from Manage when the schedule was promoted to a
                            full hero card above. README "Change 2 · Family
                            Hub" calls this out — the hero IS the entry
                            point now, so having a redundant nav row would
                            duplicate the affordance. */}
                        {/* Phase 6.7: Contacts moved out of the Manage list
                            and back to a top-level tab. The legacy "N saved"
                            count surfaced here had no good home in the new
                            tab-bar slot, so it's gone — the count is still
                            visible inside the Contacts screen itself. */}
                        {/* Phase 6.6.7: Connected calendars now deep-links to
                            the /settings/calendars sub-route — the legacy
                            inline editor was extracted in 6.6.3. */}
                        <NavRow
                            icon="link"
                            iconColor={colors.text}
                            title="Connected calendars"
                            rightPill={connectedCalendarLabel}
                            colors={colors}
                            onPress={() => router.push('/settings/calendars')}
                        />
                        <HairlineDivider insetLeft={Spacing.six + 4} />
                        {/* Phase 6.6.7: Saved locations sub-route entry point.
                            Lives here on Family Hub because the only place a
                            location editor was reachable from before 6.6 was
                            buried mid-Settings; surfacing it under Manage gives
                            it a real home. */}
                        <NavRow
                            icon="map-pin"
                            iconColor={colors.text}
                            title="Saved locations"
                            colors={colors}
                            onPress={() => router.push('/settings/locations')}
                        />
                        <HairlineDivider insetLeft={Spacing.six + 4} />
                        <NavRow
                            icon="settings"
                            iconColor={colors.text}
                            title="Settings"
                            rightText={`Theme · ${themeDisplayName(
                                themePreference,
                                scheme === 'dark' ? 'dark' : 'light',
                            )}`}
                            colors={colors}
                            onPress={() => router.push('/settings')}
                        />
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* No FAB. Family Hub is the one multi-content tab the FAB
                rule formally exempts: the canonical FamilyHubV2 canvas
                (onenest-spec-v3/design_handoff_calendar_conflicts §07.1)
                renders no FAB, and the create affordances that would
                otherwise live there are already reachable in-context —
                "Invite member" sits inline at the bottom of the People
                section, the Kids section has its own "Add child" entry,
                and "Add contact" lives on the Contacts tab. Adding a
                FAB here would duplicate affordances that are already
                visible above the fold. */}
        </ThemedView>
    );
}

// ─── PersonRow ───────────────────────────────────────────────────────────────
//
// Single member in the People section's card. Layout: 32px circular avatar +
// name (and "You" suffix when the row matches the current user) + role chip
// + sub label (currently the household role itself; profile email isn't in
// our schema so we don't render it).

function PersonRow({
    member,
    isCurrentUser,
    colors,
}: {
    member: HouseholdMember;
    isCurrentUser: boolean;
    colors: Palette;
}) {
    const initial = (member.display_name?.[0] ?? '?').toUpperCase();
    const memberColor = member.color ?? colors.accent;
    const roleLabel =
        member.role === 'parent'
            ? 'Parent'
            : member.role === 'caregiver'
              ? 'Caregiver'
              : 'Viewer';
    return (
        <View style={styles.personRow}>
            <View style={[styles.personAvatar, { backgroundColor: memberColor }]}>
                <ThemedText style={styles.personAvatarText}>{initial}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
                <View style={styles.personTitleRow}>
                    <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={{ color: colors.text }}>
                        {member.display_name}
                    </ThemedText>
                    <View
                        style={[
                            styles.rolePill,
                            { backgroundColor: withAlpha(memberColor, 0.18) },
                        ]}>
                        <ThemedText
                            style={[
                                styles.rolePillText,
                                {
                                    color: memberColor,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            {roleLabel.toUpperCase()}
                        </ThemedText>
                    </View>
                </View>
                <ThemedText
                    style={[Typography.bodySm, { color: colors.textSecondary }]}
                    numberOfLines={1}>
                    {isCurrentUser ? 'You' : roleLabel}
                </ThemedText>
            </View>
        </View>
    );
}

// ─── KidCard ─────────────────────────────────────────────────────────────────
//
// 2-column grid card per child. Top color band in the child's stored color
// (same color used on event badges + Lists rows so the household reads
// consistently); ChildBadge + name; optional birthdate footer.

function KidCard({
    child,
    members,
    colors,
    onPress,
}: {
    child: Child;
    members: HouseholdMember[];
    colors: Palette;
    onPress: () => void;
}) {
    // Age — precise computation including the "haven't had this year's
    // birthday yet" adjustment so a child born in December reads as
    // their actual age in January (the rough year-diff version was off
    // by one in those months).
    const age = useMemo(() => {
        if (!child.birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(child.birthdate)) {
            return null;
        }
        const [y, m, d] = child.birthdate.split('-').map(Number);
        const dob = new Date(y, m - 1, d);
        if (Number.isNaN(dob.getTime())) return null;
        const now = new Date();
        let a = now.getFullYear() - dob.getFullYear();
        const beforeBirthday =
            now.getMonth() < dob.getMonth() ||
            (now.getMonth() === dob.getMonth() &&
                now.getDate() < dob.getDate());
        if (beforeBirthday) a -= 1;
        if (a < 0 || a > 30) return null;
        return a;
    }, [child.birthdate]);

    // Compose the "age · grade" sublabel. Either may be missing; show
    // whichever exists, separated by a mono middot when both are set.
    const meta = useMemo(() => {
        const parts: string[] = [];
        if (age !== null) parts.push(`${age} yr${age === 1 ? '' : 's'}`);
        if (child.grade) parts.push(child.grade);
        return parts.length ? parts.join(' · ') : null;
    }, [age, child.grade]);

    // Lives-with footer — until each KidCard fetches its own
    // children_living_with row (N+1 query at this density), default to
    // the household's parent members. Multi-household / external
    // co-parent rendering tracked under #298 / #410.
    const parents = members.filter((m) => m.role === 'parent');
    const livesWithLabel = useMemo(() => {
        if (parents.length === 0) return null;
        if (parents.length === 1) return `with ${parents[0].display_name}`;
        if (parents.length === 2) {
            return `${parents[0].display_name} & ${parents[1].display_name}`;
        }
        return `${parents[0].display_name} +${parents.length - 1}`;
    }, [parents]);

    const initial = (child.display_name?.[0] ?? '?').toUpperCase();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.kidCard,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                },
                pressed && styles.pressed,
            ]}>
            {/* Top color bar — spec: position absolute, 3px, child.color. */}
            <View
                style={[styles.kidTopBar, { backgroundColor: child.color }]}
            />
            <View style={styles.kidBody}>
                {/* Header row: 32px avatar + name + meta caption. */}
                <View style={styles.kidHeader}>
                    <View
                        style={[
                            styles.kidAvatar,
                            { backgroundColor: child.color },
                        ]}>
                        <ThemedText style={styles.kidAvatarText}>
                            {initial}
                        </ThemedText>
                    </View>
                    <View style={styles.kidHeaderText}>
                        <ThemedText
                            numberOfLines={1}
                            style={[
                                styles.kidName,
                                { color: colors.text },
                            ]}>
                            {child.display_name}
                        </ThemedText>
                        {meta ? (
                            <ThemedText
                                numberOfLines={1}
                                style={[
                                    styles.kidMeta,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                {meta}
                            </ThemedText>
                        ) : null}
                    </View>
                </View>
                {/* Lives-with footer — small stack + label. */}
                {livesWithLabel ? (
                    <View style={styles.kidFooter}>
                        <View style={styles.kidFooterStack}>
                            {parents.slice(0, 2).map((p, i) => (
                                <View
                                    key={p.profile_id}
                                    style={[
                                        styles.kidFooterDot,
                                        {
                                            backgroundColor:
                                                p.color ?? colors.inkFaint,
                                            marginLeft: i === 0 ? 0 : -4,
                                            borderColor: colors.backgroundElement,
                                        },
                                    ]}
                                />
                            ))}
                        </View>
                        <ThemedText
                            numberOfLines={1}
                            style={[
                                styles.kidFooterLabel,
                                { color: colors.inkSec },
                            ]}>
                            {livesWithLabel}
                        </ThemedText>
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}

// ─── NavRow ──────────────────────────────────────────────────────────────────
//
// Manage-section nav row. Layout: 18×18 icon + title + right summary
// (text or pill) + chevron. Tap → onPress (typically router.push).

function NavRow({
    icon,
    iconColor,
    title,
    rightText,
    rightAccent,
    rightPill,
    colors,
    onPress,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    iconColor: string;
    title: string;
    /** Plain right-side mono text. Use rightAccent to tint it accent. */
    rightText?: string;
    /** When true, rightText renders in accent color (matches design's
     *  "Alternating weeks" treatment for Custody). */
    rightAccent?: boolean;
    /** Alternative to rightText: a tinted pill (e.g. "GOOGLE" for connected
     *  calendars). When both are set, the pill wins. */
    rightPill?: string | null;
    colors: Palette;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [
                styles.navRow,
                pressed && styles.pressed,
            ]}>
            <View style={styles.navIcon}>
                <Feather name={icon} size={18} color={iconColor} />
            </View>
            <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={{ color: colors.text, flex: 1 }}>
                {title}
            </ThemedText>
            {rightPill ? (
                <View
                    style={[
                        styles.navPill,
                        { backgroundColor: withAlpha(colors.accent, 0.13) },
                    ]}>
                    <View
                        style={[styles.navPillDot, { backgroundColor: colors.accent }]}
                    />
                    <ThemedText
                        style={[
                            styles.navPillText,
                            { color: colors.accent, fontFamily: FontFamily.monoSemiBold },
                        ]}>
                        {rightPill}
                    </ThemedText>
                </View>
            ) : rightText ? (
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.navRightText,
                        {
                            color: rightAccent ? colors.accent : colors.textSecondary,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {rightText}
                </ThemedText>
            ) : null}
            <Feather name="chevron-right" size={16} color={colors.textSecondary} />
        </Pressable>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: Spacing.six },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        gap: Spacing.two,
    },
    headerPretitle: { fontSize: 10, letterSpacing: -0.2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarText: {
        color: '#fff',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
        fontWeight: '600',
    },

    // Hero card — legacy single/couple snapshot variant. The custody hero
    // V2 uses its own *V2 styles below.
    heroCard: {
        marginHorizontal: 16,
        marginTop: 6,
        marginBottom: 18,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
    },
    heroPretitle: {
        fontSize: 10,
        letterSpacing: 0.4,
    },
    heroTitle: {
        fontSize: 19,
        fontWeight: '600',
        letterSpacing: -0.5,
    },
    altPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
    },
    altPillDot: { width: 5, height: 5, borderRadius: 3 },
    altPillText: { fontSize: 10, letterSpacing: 0.3 },

    // ─── Custody hero V2 ────────────────────────────────────────────────
    // Section label sits OUTSIDE the card (matches the "CUSTODY SCHEDULE"
    // pretitle in the v2 spec). Card padding matches design source 16px.
    heroSectionLabelWrap: {
        paddingHorizontal: 24,
        paddingTop: 6,
        paddingBottom: 8,
    },
    heroSectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    heroCardV2: {
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
    },
    heroTopV2: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: Spacing.two,
    },
    heroPretitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    // 18px avatar lives in the pretitle row per the v2 spec (~883 in source).
    heroPretitleAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroPretitleAvatarText: {
        color: '#fff',
        fontSize: 9,
        fontFamily: FontFamily.sansSemiBold,
        fontWeight: '600',
    },
    heroFooterV2: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.two,
    },
    heroFooterText: { fontSize: 12, letterSpacing: -0.1 },
    heroOpenCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroOpenCtaText: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    // Warn-tinted pending-swap strip sits below the footer. Backed by an
    // empty array today (no swap_requests table yet).
    swapBanner: {
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        // Two-line text content — keep the chrome (icon + REVIEW chip)
        // centered against the text block (audit #330 MEDIUM #1).
        alignItems: 'center',
        gap: 8,
    },
    swapBannerText: { fontSize: 11.5, letterSpacing: -0.1 },
    swapBannerCta: {
        fontSize: 9.5,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },

    // Section headers
    sectionHead: { paddingHorizontal: 8, marginTop: 0 },
    sectionRightLink: { fontSize: 10, letterSpacing: -0.1 },

    // Generic card wrapping a list of rows (People, Manage)
    card: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        marginBottom: 16,
    },
    emptyCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
    },

    // PersonRow
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
    },
    personAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    personAvatarText: {
        color: '#fff',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
        fontWeight: '600',
    },
    personTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    rolePill: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 3,
    },
    rolePillText: { fontSize: 9, letterSpacing: 0.3 },

    // KidCard grid (2 columns)
    kidGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 18,
    },
    kidCard: {
        // 2-column layout: 50% width minus the 8px gap between cards.
        flexBasis: '48%',
        flexGrow: 1,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        position: 'relative',
    },
    // Top 3px color bar — spec: position absolute, full-width, child color.
    kidTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    kidBody: {
        // Padding above accounts for the 3px top bar (3 + 11 ≈ spec's 14).
        paddingTop: 14,
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 8,
    },
    kidHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    kidAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    kidAvatarText: {
        color: '#1A1A1A',
        fontFamily: FontFamily.sansBold,
        fontSize: 14,
        fontWeight: '700',
    },
    kidHeaderText: { flex: 1, minWidth: 0 },
    kidName: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    kidMeta: {
        fontSize: 10,
        letterSpacing: -0.2,
        marginTop: 1,
    },
    kidFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    kidFooterStack: { flexDirection: 'row' },
    kidFooterDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
    },
    kidFooterLabel: {
        fontSize: 10.5,
        letterSpacing: -0.1,
        flex: 1,
    },

    // NavRow
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    navIcon: { width: 18, height: 18 },
    navRightText: { fontSize: 11, letterSpacing: -0.2 },
    navPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
    },
    navPillDot: { width: 5, height: 5, borderRadius: 3 },
    navPillText: { fontSize: 10, letterSpacing: 0.3 },

    pressed: { opacity: 0.7 },
});
