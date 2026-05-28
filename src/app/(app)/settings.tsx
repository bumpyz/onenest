import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing, Surfaces } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useChildren } from '@/hooks/use-children';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { usePendingInvitations } from '@/hooks/use-pending-invitations';
import { signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { findPattern } from '@/lib/custody';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { memberColorMap } from '@/lib/colors';
import { deleteMyAccount, type HouseholdType } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import {
    useAppColorScheme,
    useThemePreference,
} from '@/providers/theme-provider';

// ─── SGroup / SRow / SToggle primitives (Phase 6.4) ────────────────────────
//
// New design primitives that match screens-extra.jsx:2142-2212. SGroup is a
// section card with a mono caps label above; SRow is a single hairline-
// separated row inside the card; SToggle is SRow with a Switch on the right.
// Together they're the canonical iOS-Settings vocabulary the redesign uses
// for Notifications / AI assistant / About. SettingsSection (below) keeps
// existing functional sections working with their bespoke inline editors;
// new sections built in 6.4 use these primitives so they read consistently.
//
// We don't replace SettingsSection wholesale because the existing screens
// host complex inline editors (display name, custody picker, location list
// CRUD) that don't decompose cleanly into hairline rows. Migrating them is
// a follow-up; 6.4 adds the new vocabulary alongside.

function SGroup({
    label,
    subLabel,
    children,
}: {
    label: string;
    subLabel?: string;
    children: ReactNode;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={styles.sGroup}>
            <View style={styles.sGroupHeader}>
                <ThemedText
                    style={[
                        styles.sGroupLabel,
                        {
                            color: colors.inkSec,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {label.toUpperCase()}
                </ThemedText>
                {subLabel ? (
                    <ThemedText
                        style={[
                            styles.sGroupSubLabel,
                            { color: colors.textSecondary },
                        ]}>
                        {subLabel}
                    </ThemedText>
                ) : null}
            </View>
            <View
                style={[
                    styles.sGroupCard,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {children}
            </View>
        </View>
    );
}

// Single row inside an SGroup. Padding + bottom hairline match the design
// (13/14 padding, hairline-color divider). `last` prop suppresses the
// divider on the final row. `right` slot accepts a string (rendered as mono
// secondary) or any ReactNode (e.g. a CStack of avatars + count, a pill).
// `chevron` appends a right-facing caret to signal "tap to open detail."
function SRow({
    label,
    sub,
    right,
    chevron,
    last,
    onPress,
}: {
    label: string;
    sub?: string;
    /** Right slot. String → mono secondary text; ReactNode → custom. */
    right?: string | ReactNode;
    chevron?: boolean;
    last?: boolean;
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Audit found a bug where the function-style was only invoked by
    // Pressable — when onPress is absent the Wrapper became View, which
    // does NOT invoke function-styles, so styles.sRow (flexDirection: row)
    // never applied → the non-tappable Version row stacked vertically.
    // Build a static style array here and apply it whether the row is
    // tappable or not. Pressed-state still flows through Pressable for
    // tappable rows via the inner pressed && ... check.
    const baseStyle = [
        styles.sRow,
        !last && { borderBottomColor: colors.hair, borderBottomWidth: StyleSheet.hairlineWidth },
    ];

    const body = (
        <>
            <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>
                    {label}
                </ThemedText>
                {sub ? (
                    <ThemedText
                        style={[styles.sRowSub, { color: colors.textSecondary }]}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            {typeof right === 'string' ? (
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.sRowRight,
                        { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                    ]}>
                    {right}
                </ThemedText>
            ) : right ? (
                <View>{right}</View>
            ) : null}
            {chevron ? (
                <Feather name="chevron-right" size={14} color={colors.inkFaint} />
            ) : null}
        </>
    );

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={({ pressed }) => [
                    baseStyle,
                    pressed && styles.pressed,
                ]}>
                {body}
            </Pressable>
        );
    }
    return <View style={baseStyle}>{body}</View>;
}

// Boolean-toggle row using RN's Switch (which renders the native platform
// switch on iOS/Android and a styled checkbox-ish control on web). Wrapped
// in a SRow shell for consistent label + sub + divider treatment.
function SToggle({
    label,
    sub,
    value,
    onChange,
    last,
}: {
    label: string;
    sub?: string;
    value: boolean;
    onChange: (next: boolean) => void;
    last?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.sRow,
                !last && { borderBottomColor: colors.hair, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>
                    {label}
                </ThemedText>
                {sub ? (
                    <ThemedText
                        style={[styles.sRowSub, { color: colors.textSecondary }]}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: colors.inkFaint, true: colors.accent }}
                thumbColor="#FFFFFF"
                accessibilityLabel={label}
            />
        </View>
    );
}

// useAsyncStorageBool — small hook to back a boolean preference with
// AsyncStorage. Used by the Notifications + AI assistant SGroups in 6.4
// per the product call to scaffold these visually before the backend
// (user_preferences table, edge-function gating) lands. The state is
// optimistic — writes are fire-and-forget; on read failure we fall back
// to the default.
function useAsyncStorageBool(
    key: string,
    defaultValue: boolean,
): [boolean, (next: boolean) => void] {
    const [value, setValue] = useState(defaultValue);
    // Hydrate from storage once on mount. We accept a brief flash of the
    // default during the round-trip; that's fine for the scaffold (real
    // preferences would land via a hook that prefetches before render).
    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(key)
            .then((raw) => {
                if (cancelled || raw === null) return;
                setValue(raw === 'true');
            })
            .catch(() => {
                // Swallow — fall back to defaultValue.
            });
        return () => {
            cancelled = true;
        };
    }, [key]);
    const setAndPersist = useCallback(
        (next: boolean) => {
            setValue(next);
            AsyncStorage.setItem(key, next ? 'true' : 'false').catch(() => {
                // Swallow — UI already reflects the new value optimistically.
            });
        },
        [key],
    );
    return [value, setAndPersist];
}

// ─── SettingsSection ────────────────────────────────────────────────────────
//
// Every top-level section uses this shell: a small bold title (and optional
// description) floating above a white card that holds the section's content.
// Establishes the "title → card → contents" rhythm so the screen reads as a
// stack of consistent units rather than a grab-bag of bespoke layouts.
//
// Before this existed, sections were a coin flip — some wrapped in a card
// (Household, the Account sub-sections), some bare (Children, My color,
// Invite, Saved locations). Result: visual whiplash on scroll. This wrapper
// fixes that by giving every section the same skeleton, pulled from the
// canonical `Surfaces.card` token so the design language matches Home / Lists
// / Contacts cards.
function SettingsSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const surface = Surfaces.card;
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <ThemedText type="smallBold">{title}</ThemedText>
                {description ? (
                    <ThemedText themeColor="textSecondary" type="small">
                        {description}
                    </ThemedText>
                ) : null}
            </View>
            <View
                style={[
                    styles.sectionCard,
                    {
                        backgroundColor: colors[surface.fill],
                        borderRadius: surface.radius,
                    },
                    surface.shadow,
                ]}>
                {children}
            </View>
        </View>
    );
}

export default function SettingsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const scheme = useAppColorScheme();
    const { preference: themePreference } = useThemePreference();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { households } = useHouseholds();
    const household = households?.[0];
    const householdType: HouseholdType = household?.household_type ?? 'separated';
    const { schedule: custodySchedule } = useCustodySchedule(household?.id);
    const { members } = useHouseholdMembers(household?.id);
    // Caregivers see a trimmed-down Settings: own profile (name, color, tz,
    // appearance), paired calendars, account / sign out. No household-type
    // editor, custody schedule, children mgmt, locations mgmt, or invite UI —
    // those are parent-only data per migration 0031's RLS.
    const { isCaregiver } = useMyRole(household?.id);
    // memberColorMap result is currently unread on this screen but the call
    // is kept as a tripwire — when the design surfaces avatar colors back
    // here (Members nav row already does so via member.color), having the
    // map ready makes that swap a one-line change. Wrap in void to silence
    // unused-locals.
    void memberColorMap(members);
    const myMember = members?.find((m) => m.profile_id === user?.id);
    const myColor = myMember?.color ?? null;

    // Pending invite count surfaces in the Members SRow accessory. The
    // /settings/members sub-route has its own usePendingInvitations
    // instance for the actual list + revoke flow.
    const { invitations } = usePendingInvitations(household?.id);
    // (Phase 6.6.2: useLocations removed. The Saved locations editor lives
    // at /settings/locations now with its own hook instance.)
    const { children, refetch: refetchChildren } = useChildren(household?.id);
    // (Phase 6.6.3: useExternalCalendars hook moved to /settings/calendars.)

    // (Phase 6.7.6: invite form state + display-name editor state +
    // color-picker state all moved to /settings/members and /settings/profile.
    // Settings is now a summary-only screen; the only mutable state it
    // owns are the AsyncStorage-backed scaffold toggles below. The
    // setTimeout-based "Copied!" affordance + Alert-based revoke confirm
    // both moved with the invite UI.)

    // (Phase 6.6.1: Default-timezone state + handlers removed. Resolution
    // moved to lib/timezones.ts at event-create time. useMyProfile +
    // updateMyDefaultTimezone are no longer imported here.)

    // (Phase 6.6.4: household-type editor state + onChangeHouseholdType
    // handler moved to /settings/household. Settings now just renders the
    // SGroup summary; tap the row to edit.)

    // ── Phase 6.4 toggle scaffolds (AsyncStorage-backed) ─────────────────
    //
    // These toggles ship the design's Notifications + AI assistant SGroups
    // without their backends. State lives client-side per the product call:
    // - Weekly digest already ships via sunday-summary; default-on reflects
    //   that.
    // - Task/hand-off/conflict/activity reminders depend on Phase 10's
    //   notifications-inbox + per-prefs RLS — defaults are pessimistic so
    //   nothing fires unexpectedly when the wiring lands.
    // - AI toggles all default off; #303 hasn't shipped.
    // Keys are prefixed `onenest:settings:` to avoid collision with other
    // AsyncStorage entries in the app (e.g. the home welcome-card flag).
    const [notifWeeklyDigest, setNotifWeeklyDigest] = useAsyncStorageBool(
        'onenest:settings:notif:weekly-digest',
        true,
    );
    const [notifTaskReminders, setNotifTaskReminders] = useAsyncStorageBool(
        'onenest:settings:notif:task-reminders',
        true,
    );
    const [notifHandoffReminders, setNotifHandoffReminders] = useAsyncStorageBool(
        'onenest:settings:notif:handoff-reminders',
        false,
    );
    const [notifConflictAlerts, setNotifConflictAlerts] = useAsyncStorageBool(
        'onenest:settings:notif:conflict-alerts',
        true,
    );
    const [notifCoparentActivity, setNotifCoparentActivity] = useAsyncStorageBool(
        'onenest:settings:notif:coparent-activity',
        false,
    );
    const [aiInlineParse, setAiInlineParse] = useAsyncStorageBool(
        'onenest:settings:ai:inline-parse',
        false,
    );
    const [aiSmartSuggestions, setAiSmartSuggestions] = useAsyncStorageBool(
        'onenest:settings:ai:smart-suggestions',
        false,
    );
    const [aiActivitySummaries, setAiActivitySummaries] = useAsyncStorageBool(
        'onenest:settings:ai:activity-summaries',
        false,
    );

    // (Phase 6.6.3: external-calendar state + connect/sync/disconnect
    // handlers moved to src/app/settings/calendars.tsx. Settings no longer
    // owns this surface.)

    // (Phase 6.6.4: onChangeHouseholdType moved to /settings/household.)

    // Refetch on screen focus so changes made inside the children modal
    // (/child/new + /child/[id]) show up the moment the user returns. Without
    // this the list would only refresh on full reload. (Locations moved to
    // /settings/locations in 6.6.2, which has its own focus refetch.)
    useFocusEffect(
        useCallback(() => {
            refetchChildren();
        }, [refetchChildren]),
    );

    // (Phase 6.7.6: onInvite / onStartEditName / onCancelEditName /
    // onSaveName / onPickColor / onCopy / onRevoke handlers all moved to
    // the /settings/members and /settings/profile sub-routes along with
    // the editors they back. inputStyle moved with them.)

    // ── Section render order ──────────────────────────────────────────────
    //
    // Top-down rhythm: "about me" → "about my family" → "external connections"
    // → "account / housekeeping". This maps to how users mentally categorize
    // the settings on this screen and matches the platform convention (iOS
    // Settings groups by scope, not by feature).
    //
    //   1.  Display name              (about me)
    //   2.  My color                  (about me)
    //   3.  Default timezone          (about me — affects events I create)
    //   4.  Appearance                (about me — UI preference)
    //   5.  Household                 (my family — name + type + roster)
    //   6.  Children                  (my family — parent-only)
    //   7.  Custody schedule          (my family — parent-only, separated only)
    //   8.  Saved locations           (my family — parent-only)
    //   9.  Paired calendars          (external — both roles see this)
    //   10. Invite (+ pending list)   (external — parent-only)
    //   11. Account                   (housekeeping — restore welcome + sign out)
    //
    // Two structural changes from the previous layout: Account no longer
    // hosts Display name / Timezone / Appearance as sub-cards (they're
    // promoted to top-level sections so every "thing the user can change" is
    // one card with one purpose), and Pending invitations is folded into the
    // Invite section as a sub-list (it's contextual to the invite action, not
    // a separate concept).

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Phase 6.7.6: top bar with back chevron. Settings is no
                    longer a tab (reached from Family → Manage → Settings),
                    so it needs an explicit way out. The sub-routes under
                    /settings/* have the same top-bar pattern. */}
                <View style={[styles.topBar, { borderBottomColor: colors.hair }]}>
                    <Pressable
                        onPress={() => {
                            // Phase 6.7 bug fix: Settings is a hidden tab
                            // (href: null), reached only from /family →
                            // Manage → Settings. `router.back()` here pops
                            // the tab history, which lands on the first
                            // tab (Home) instead of Family. Navigate
                            // explicitly to /family — that's the design-
                            // intent entry point and matches what users
                            // expect when they hit the back chevron.
                            router.push('/family');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.topBarIconBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="chevron-left" size={14} color={colors.text} />
                    </Pressable>
                    <ThemedText style={[styles.topBarTitle, { color: colors.text }]}>
                        Settings
                    </ThemedText>
                    <View style={styles.topBarIconBtn} />
                </View>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* SIGNED IN AS pretitle. Phase 6.7.6 dropped the big
                        "Settings" page title in favor of the top-bar title
                        above; the mono pretitle stays as a quick sanity
                        check of which account is signed in. */}
                    {user?.email ? (
                        <View style={styles.pageHeader}>
                            <ThemedText
                                style={[
                                    styles.pageHeaderPretitle,
                                    { color: colors.textSecondary },
                                ]}>
                                SIGNED IN AS {user.email.toUpperCase()}
                            </ThemedText>
                        </View>
                    ) : null}

                    {/* Phase 6.7.6: profile hero is now a read-only summary
                        with an explicit EDIT chip that opens /settings/profile.
                        The display-name inline editor and the "My color"
                        swatch picker both moved to that screen — having them
                        inline crowded the hero and didn't match design intent
                        (the hero should be a 1-row glance, not a mini editor).
                        Hidden when myMember hasn't resolved yet.
                        UX-audit fix: tap target was the WHOLE row, which
                        meant tapping the avatar / name / email blob also
                        navigated. Design isolates the affordance to the EDIT
                        pill only (screens-settings.jsx:175-186) so the rest
                        of the hero reads as non-interactive context. The
                        outer container is now a static View; the EDIT pill
                        is the only tappable element. */}
                    {myMember ? (
                        <View
                            style={[
                                styles.profileHero,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.profileHeroAvatar,
                                    { backgroundColor: myColor ?? colors.accent },
                                ]}>
                                <ThemedText style={styles.profileHeroAvatarText}>
                                    {(myMember.display_name?.[0] ?? '?').toUpperCase()}
                                </ThemedText>
                            </View>
                            <View style={styles.profileHeroBody}>
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        styles.profileHeroName,
                                        { color: colors.text },
                                    ]}>
                                    {myMember.display_name ?? '—'}
                                </ThemedText>
                                {user?.email ? (
                                    <ThemedText
                                        numberOfLines={1}
                                        style={[
                                            styles.profileHeroEmail,
                                            {
                                                color: colors.textSecondary,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {user.email}
                                    </ThemedText>
                                ) : null}
                                {/* Phase 6.7 UX fix: design shows two pills
                                    (role + Admin) side-by-side. We surface
                                    Admin to the household creator since the
                                    schema doesn't track explicit admin
                                    status separately yet (household.created_by
                                    is the closest signal). Pill source string
                                    is lower-case; textTransform handles the
                                    caps — avoids double-encoded uppercase. */}
                                <View style={styles.profileHeroPills}>
                                    <View
                                        style={[
                                            styles.profileHeroPill,
                                            {
                                                backgroundColor:
                                                    (myColor ?? colors.accent) + '22',
                                                borderColor:
                                                    (myColor ?? colors.accent) + '55',
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.profileHeroPillText,
                                                { color: colors.text },
                                            ]}>
                                            {myMember.role === 'caregiver'
                                                ? 'Caregiver'
                                                : myMember.role === 'viewer'
                                                  ? 'Viewer'
                                                  : 'Parent'}
                                        </ThemedText>
                                    </View>
                                    {household?.created_by === user?.id ? (
                                        <View
                                            style={[
                                                styles.profileHeroPill,
                                                {
                                                    backgroundColor:
                                                        colors.accent + '22',
                                                    borderColor:
                                                        colors.accent + '55',
                                                },
                                            ]}>
                                            <ThemedText
                                                style={[
                                                    styles.profileHeroPillText,
                                                    { color: colors.text },
                                                ]}>
                                                Admin
                                            </ThemedText>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                            <Pressable
                                onPress={() => router.push('/settings/profile')}
                                accessibilityRole="button"
                                accessibilityLabel="Edit profile"
                                style={({ pressed }) => [
                                    styles.profileHeroEditChip,
                                    {
                                        backgroundColor: colors.backgroundInset,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.profileHeroEditChipText,
                                        {
                                            color: colors.accent,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    EDIT
                                </ThemedText>
                                <Feather
                                    name="chevron-right"
                                    size={12}
                                    color={colors.accent}
                                />
                            </Pressable>
                        </View>
                    ) : null}

                    {/* (Phase 6.7.6: in-hero display-name editor + my-color
                        swatch picker removed. Both editors moved to
                        /settings/profile, reached via the EDIT chip on the
                        slim hero card above.) */}

                    {/* Phase 6.6.7: Household SGroup summary, now fully
                        chevroned. Each row deep-links to the matching
                        sub-route under /settings — Name + Family type both
                        go to /settings/household (single editor handles
                        both fields), Children to /settings/children, and
                        Custody (separated households only) to
                        /settings/custody. Members is informational only —
                        editing membership doesn't live anywhere yet, so
                        keep it non-tappable rather than route to a screen
                        that can't act on it. Hidden until household
                        resolves. */}
                    {household ? (
                        <SGroup label="Household">
                            <SRow
                                label="Name"
                                right={household.name}
                                chevron
                                onPress={() => router.push('/settings/household')}
                            />
                            <SRow
                                label="Family type"
                                right={
                                    householdType === 'single_parent'
                                        ? 'Just me + my kids'
                                        : householdType === 'couple'
                                          ? 'My partner and me'
                                          : 'Separated co-parents'
                                }
                                chevron
                                onPress={() => router.push('/settings/household')}
                            />
                            {/* Phase 6.7.6: Members is now a chevron nav row
                                that opens /settings/members — the new
                                consolidated screen owns both the invite
                                form (lifted out of this page's standalone
                                hero card + SettingsSection) and the member
                                list. The right slot still surfaces an
                                avatar stack + count for at-a-glance scan;
                                `+N pending` appears when there are open
                                invitations so the count badge tells the
                                truth before you tap. Caregivers stay
                                bounced out by the sub-route's own gate. */}
                            {!isCaregiver ? (
                                <Pressable
                                    onPress={() => router.push('/settings/members')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Members"
                                    style={({ pressed }) => [
                                        styles.householdSummaryRow,
                                        { borderBottomColor: colors.hair },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="smallBold"
                                        style={{ flex: 1, color: colors.text }}>
                                        Members
                                    </ThemedText>
                                    <View style={styles.householdSummaryRight}>
                                        {(members ?? []).slice(0, 4).map((m) => (
                                            <View
                                                key={m.profile_id}
                                                style={[
                                                    styles.householdSummaryAvatar,
                                                    {
                                                        backgroundColor:
                                                            m.color ?? colors.accent,
                                                        borderColor:
                                                            colors.backgroundElement,
                                                    },
                                                ]}>
                                                <ThemedText
                                                    style={styles.householdSummaryAvatarText}>
                                                    {(
                                                        m.display_name?.[0] ?? '?'
                                                    ).toUpperCase()}
                                                </ThemedText>
                                            </View>
                                        ))}
                                        <ThemedText
                                            style={[
                                                styles.householdSummaryCount,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily: FontFamily.monoMedium,
                                                },
                                            ]}>
                                            {members?.length ?? 0}
                                            {invitations && invitations.length > 0
                                                ? ` · ${invitations.length} pending`
                                                : ''}
                                        </ThemedText>
                                        <Feather
                                            name="chevron-right"
                                            size={14}
                                            color={colors.inkFaint}
                                        />
                                    </View>
                                </Pressable>
                            ) : null}
                            <Pressable
                                onPress={() => router.push('/settings/children')}
                                accessibilityRole="button"
                                accessibilityLabel="Children"
                                style={({ pressed }) => [
                                    styles.householdSummaryRow,
                                    {
                                        borderBottomColor:
                                            householdType === 'separated'
                                                ? colors.hair
                                                : 'transparent',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    type="smallBold"
                                    style={{ flex: 1, color: colors.text }}>
                                    Children
                                </ThemedText>
                                <View style={styles.householdSummaryRight}>
                                    {(children ?? []).slice(0, 4).map((c) => (
                                        <ChildBadge
                                            key={c.id}
                                            name={c.display_name}
                                            color={c.color}
                                            size="sm"
                                        />
                                    ))}
                                    <ThemedText
                                        style={[
                                            styles.householdSummaryCount,
                                            {
                                                color: colors.textSecondary,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {children?.length ?? 0}
                                    </ThemedText>
                                    <Feather
                                        name="chevron-right"
                                        size={14}
                                        color={colors.inkFaint}
                                    />
                                </View>
                            </Pressable>
                            {householdType === 'separated' ? (
                                <>
                                    <SRow
                                        label="Custody schedule"
                                        /* Phase 6.7 pass-2 UX: design tints the
                                           custody value in accent to flag "this is
                                           the active pattern" (screens-settings.jsx:
                                           206-209). SRow's default right-slot
                                           renders mono-secondary; we hand-roll a
                                           ThemedText here to override the color. */
                                        right={
                                            <ThemedText
                                                style={{
                                                    fontFamily: FontFamily.monoMedium,
                                                    fontSize: 12,
                                                    letterSpacing: -0.2,
                                                    color: custodySchedule
                                                        ? colors.accent
                                                        : colors.textSecondary,
                                                }}>
                                                {custodySchedule
                                                    ? findPattern(custodySchedule.pattern_id)
                                                          ?.label ?? custodySchedule.pattern_id
                                                    : 'Not set'}
                                            </ThemedText>
                                        }
                                        chevron
                                        onPress={() => router.push('/settings/custody')}
                                    />
                                    {/* Phase G (#489): brief-items editor. Only
                                        relevant in separated households since
                                        the brief paradigm is "caregiver hands
                                        kids back at hand-off" — which doesn't
                                        exist in single_parent / couple shapes.
                                        Routes to /settings/brief-items. */}
                                    <SRow
                                        label="Hand-off brief"
                                        right={
                                            <ThemedText
                                                style={{
                                                    fontFamily: FontFamily.monoMedium,
                                                    fontSize: 12,
                                                    letterSpacing: -0.2,
                                                    color: colors.textSecondary,
                                                }}>
                                                For caregivers
                                            </ThemedText>
                                        }
                                        chevron
                                        onPress={() =>
                                            router.push('/settings/brief-items')
                                        }
                                        last
                                    />
                                </>
                            ) : null}
                        </SGroup>
                    ) : null}

                    {/* (Phase 6.6.1: Default timezone editor removed.
                        Timezone is now resolved from the device via
                        Intl.DateTimeFormat at event-create time, with a
                        California fallback when Intl is unavailable on
                        web. See resolveDefaultTimezone() in lib/timezones.ts.
                        profiles.default_timezone is legacy and no longer
                        read.) */}

                    {/* Phase 6.7.6: Appearance SGroup collapsed to two
                        chevron nav rows. The full picker (theme, accent,
                        density, reduce-motion, mono metadata) lives at
                        /settings/appearance. Surfacing the current
                        selection on the right of each row keeps the glance-
                        value of the previous inline editor without
                        crowding the page.

                        Phase 6.7 UX fix: the Theme right-slot now shows the
                        resolved scheme (Light/Dark) when the user picked
                        System — same pattern Family Hub's Manage uses. The
                        accent name is followed by a 14×14 accent square
                        per the design (screens-settings.jsx:237-240). */}
                    <SGroup label="Appearance">
                        <SRow
                            label="Theme & accent"
                            right={
                                <View style={styles.appearanceRowRight}>
                                    <View
                                        style={[
                                            styles.appearanceRowAccentSquare,
                                            {
                                                backgroundColor: colors.accent,
                                                borderColor: colors.hair,
                                            },
                                        ]}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.appearanceRowRightText,
                                            {
                                                color: colors.textSecondary,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {themePreference === 'system'
                                            ? `System · ${scheme === 'dark' ? 'Dark' : 'Light'}`
                                            : themePreference === 'dark'
                                              ? 'Dark'
                                              : 'Light'}
                                    </ThemedText>
                                </View>
                            }
                            chevron
                            onPress={() => router.push('/settings/appearance')}
                        />
                        <SRow
                            label="Compact density"
                            right="Comfortable"
                            chevron
                            last
                            onPress={() => router.push('/settings/appearance')}
                        />
                    </SGroup>

                    {/* (Phase 6.6.4: Household editor moved to /settings/household.
                        Name + Family type + Members list live there now.
                        Reached via the Household SGroup summary's Name + Family
                        type chevron rows on this page, wired in 6.6.7.) */}

                    {/* (Phase 6.6.5: Children list moved to /settings/children.
                        Reached via the Household SGroup summary's Children row
                        chevron, wired in 6.6.7.) */}

                    {/* (Phase 6.6.6: Custody schedule moved to /settings/custody.
                        Reached via the Household SGroup summary's Custody schedule
                        row chevron, wired in 6.6.7.) */}

                    {/* (Phase 6.6.2: Saved locations moved to its own
                        sub-route at /settings/locations. Reached via the
                        Manage list in Family Hub once we wire that link in
                        6.6.7.) */}

                    {/* (Phase 6.6.3: Paired calendars moved to /settings/calendars.
                        Reached via the Manage list in Family Hub. State + sync /
                        connect / disconnect handlers live in that route file. */}

                    {/* (Phase 6.7.6: invite hero card + invite SettingsSection
                        + pending invitations sub-list all moved to
                        /settings/members. The Household SGroup's Members
                        nav row above is the only entry point now. */}

                    {/* ── Notifications SGroup (Phase 6.4) ──
                        5 SToggle rows scaffolded with AsyncStorage-backed
                        state. Backend wiring lands with Phase 10's
                        notifications inbox + per-user preferences table.
                        See useAsyncStorageBool() and the toggle state
                        declarations near the top of this component for the
                        product call. Caregivers see this too — task /
                        hand-off / conflict / activity prefs are useful
                        regardless of role. */}
                    <SGroup label="Notifications">
                        {/* R3 (#420): per-kind notification preferences
                            sub-route. Server-side (notification_preferences
                            table) — honored by the event-reminders cron +
                            future sunday-summary refactor. The SToggle
                            rows below are legacy local-only AsyncStorage
                            state; they should migrate to the new table
                            (or get removed) in a follow-up. The sub-route
                            is the authoritative source. */}
                        <SRow
                            label="Manage by kind"
                            right={
                                <ThemedText
                                    style={{
                                        fontFamily: FontFamily.monoMedium,
                                        fontSize: 12,
                                        letterSpacing: -0.2,
                                        color: colors.textSecondary,
                                    }}>
                                    7 kinds
                                </ThemedText>
                            }
                            chevron
                            onPress={() =>
                                router.push('/settings/notifications')
                            }
                        />
                        <SToggle
                            label="Weekly digest"
                            sub="Sunday at 7pm — conflicts, unassigned events, hand-offs"
                            value={notifWeeklyDigest}
                            onChange={setNotifWeeklyDigest}
                        />
                        <SToggle
                            label="Task reminders"
                            sub="15 min before due time · custom per task"
                            value={notifTaskReminders}
                            onChange={setNotifTaskReminders}
                        />
                        <SToggle
                            label="Hand-off reminders"
                            sub="2 hours before custody changes"
                            value={notifHandoffReminders}
                            onChange={setNotifHandoffReminders}
                        />
                        <SToggle
                            label="Conflict alerts"
                            sub="When new events overlap your schedule"
                            value={notifConflictAlerts}
                            onChange={setNotifConflictAlerts}
                        />
                        <SToggle
                            label="Activity from co-parents"
                            sub="When co-parents or caregivers add events"
                            value={notifCoparentActivity}
                            onChange={setNotifCoparentActivity}
                            last
                        />
                    </SGroup>

                    {/* (Phase 6.5a: Appearance is now merged into the
                        single SGroup higher up — Theme + Accent + Density
                        live in one card right after the legacy Default
                        timezone SettingsSection. The standalone "Appearance
                        — extras" SGroup that lived here in 6.4 has been
                        removed; this comment is the only thing left so a
                        diff reader can find where it went.) */}

                    {/* ── AI assistant SGroup (Phase 6.4) ──
                        4 toggle rows + "What can the AI see?" chevron. All
                        AI-related affordances are deferred to #303 (LLM
                        integration); these toggles are scaffolded so users
                        see the surface area, with persistence local until
                        the integration ships. The disclosure chevron is a
                        no-op until the disclosure screen exists. */}
                    <SGroup label="AI assistant">
                        <SToggle
                            label="Inline parse bar"
                            sub='Type "soccer Wed 4pm" → event'
                            value={aiInlineParse}
                            onChange={setAiInlineParse}
                        />
                        <SToggle
                            label="Smart suggestions"
                            sub="Conflicts, recurring patterns, delegation"
                            value={aiSmartSuggestions}
                            onChange={setAiSmartSuggestions}
                        />
                        <SToggle
                            label="Activity summaries"
                            sub="Weekly recap on Sunday"
                            value={aiActivitySummaries}
                            onChange={setAiActivitySummaries}
                        />
                        <SRow
                            label="What can the AI see?"
                            chevron
                            last
                            onPress={() => {
                                if (Platform.OS === 'web') {
                                    if (typeof window !== 'undefined') {
                                        window.alert(
                                            'AI disclosure screen lands with #303 (LLM integration).',
                                        );
                                    }
                                } else {
                                    Alert.alert(
                                        'AI disclosure',
                                        'Lands with the AI integration (#303).',
                                    );
                                }
                            }}
                        />
                    </SGroup>

                    {/* ── About SGroup (Phase 6.4) ──
                        Help & feedback (mailto link MVP), Privacy /
                        Terms (placeholder external-URL links), Version
                        (sourced from process.env.npm_package_version if
                        present; otherwise the literal "—"). expo-constants
                        Application.nativeApplicationVersion would be the
                        production path on native — left for a follow-up
                        since it requires a dep import + native module check. */}
                    <SGroup label="About">
                        <SRow
                            label="Help & feedback"
                            chevron
                            onPress={() => {
                                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                    window.location.href = 'mailto:support@onenest.app';
                                }
                            }}
                        />
                        {/* Privacy + Terms rows: marked "Coming soon"
                            until the real legal pages exist (#388).
                            Removed the broken onenest.app/{privacy,terms}
                            onPress handlers — those URLs returned 404 and
                            offering a tap that 404s is worse than no tap
                            at all. Once the pages ship, restore the
                            window.open / Linking.openURL + chevron and
                            drop the right-slot badge. */}
                        <SRow
                            label="Privacy policy"
                            right={
                                <ThemedText
                                    style={{
                                        fontFamily: FontFamily.monoSemiBold,
                                        fontSize: 10,
                                        letterSpacing: 0.3,
                                        color: colors.inkFaint,
                                    }}>
                                    COMING SOON
                                </ThemedText>
                            }
                        />
                        <SRow
                            label="Terms of service"
                            right={
                                <ThemedText
                                    style={{
                                        fontFamily: FontFamily.monoSemiBold,
                                        fontSize: 10,
                                        letterSpacing: 0.3,
                                        color: colors.inkFaint,
                                    }}>
                                    COMING SOON
                                </ThemedText>
                            }
                        />
                        {/* Version sourced from app.json via expo-constants
                            (Constants.expoConfig?.version). Metro doesn't
                            inject process.env.npm_package_version at runtime
                            in the renderer, so the env-var read always fell
                            back to "—"; the audit caught this. */}
                        <SRow
                            label="Version"
                            right={Constants.expoConfig?.version ?? '—'}
                            last
                        />
                    </SGroup>

                    {/* ── 11. Tools (UX-028 welcome restore) — kept as a
                        small utility row above the danger zone since it's
                        non-destructive but doesn't fit cleanly into any other
                        SGroup. Could fold into About in 6.4 if we want it
                        deeper. */}
                    {household ? (
                        <SettingsSection title="Tools">
                            <View style={styles.valueRow}>
                                <ThemedText
                                    type="small"
                                    themeColor="textSecondary"
                                    style={{ flex: 1 }}>
                                    Show welcome card on Home again
                                </ThemedText>
                                <Pressable
                                    onPress={async () => {
                                        try {
                                            await AsyncStorage.removeItem(
                                                `onenest:home-welcome-dismissed:${household.id}`,
                                            );
                                            Alert.alert(
                                                'Welcome card restored',
                                                'Visit the Home tab to see it again.',
                                            );
                                        } catch {
                                            // Best-effort; failure here is silent UX-only.
                                        }
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Show welcome card on Home again"
                                    style={({ pressed }) => [
                                        styles.secondaryBtn,
                                        { borderColor: colors.backgroundSelected },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText type="small" style={[styles.actionTextAccent, { color: colors.accent }]}>
                                        Restore
                                    </ThemedText>
                                </Pressable>
                            </View>
                        </SettingsSection>
                    ) : null}

                    {/* Danger zone card per the redesign (screens-extra.jsx:
                        2108-2127). Single card containing two alert-red rows:
                        Sign out (existing handler) + Delete account (placeholder
                        — actual cascading delete is a backend item, see #305-310
                        backlog). The two rows are visually equivalent but
                        Delete account is marked with reduced opacity to signal
                        "this is not the same kind of action." */}
                    <View
                        style={[
                            styles.dangerCard,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {/* Phase 6.7.6 QA fix: signOut() throws on failure and
                            the previous wiring fired it directly with no catch,
                            leaving the user with a hung tap and a dev-only
                            unhandled-rejection warning. Wrap in a confirm +
                            try/catch matching the canonical sign-out on
                            /settings/profile. */}
                        <Pressable
                            onPress={async () => {
                                const doSignOut = async () => {
                                    try {
                                        await signOut();
                                    } catch (err) {
                                        console.error('signOut failed', err);
                                        const msg = errorMessage(err);
                                        if (Platform.OS === 'web') {
                                            if (typeof window !== 'undefined') {
                                                window.alert(`Couldn't sign out: ${msg}`);
                                            }
                                        } else {
                                            Alert.alert("Couldn't sign out", msg);
                                        }
                                    }
                                };
                                if (Platform.OS === 'web') {
                                    const ok =
                                        typeof window !== 'undefined' &&
                                        window.confirm('Sign out of OneNest?');
                                    if (ok) await doSignOut();
                                } else {
                                    Alert.alert(
                                        'Sign out of OneNest?',
                                        'You can sign back in any time.',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Sign out',
                                                style: 'destructive',
                                                onPress: doSignOut,
                                            },
                                        ],
                                    );
                                }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Sign out"
                            style={({ pressed }) => [
                                styles.dangerRow,
                                { borderBottomColor: colors.hair },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText style={styles.dangerRowText}>Sign out</ThemedText>
                        </Pressable>
                        {/* Real delete-account flow (#387). Two-step
                            confirm — first dialog explains what's
                            about to happen, second confirms the
                            user understands data loss is permanent.
                            Both prompts must be accepted before the
                            edge function fires. The function deletes
                            auth.users via service role; cascades to
                            profiles + member rows happen at the DB. */}
                        <Pressable
                            onPress={() => {
                                const runDelete = async () => {
                                    try {
                                        await deleteMyAccount();
                                        // Auth session is invalid now —
                                        // signOut() clears the local
                                        // client state. The user lands
                                        // on /sign-in after the auth
                                        // listener observes the dead
                                        // session.
                                        try {
                                            await signOut();
                                        } catch {
                                            // Best-effort — the row is
                                            // already gone server-side.
                                        }
                                    } catch (err) {
                                        const msg = errorMessage(err);
                                        if (Platform.OS === 'web') {
                                            if (
                                                typeof window !== 'undefined'
                                            ) {
                                                window.alert(
                                                    `Couldn't delete account: ${msg}`,
                                                );
                                            }
                                        } else {
                                            Alert.alert(
                                                "Couldn't delete account",
                                                msg,
                                            );
                                        }
                                    }
                                };
                                const confirmSecondStep = () => {
                                    if (Platform.OS === 'web') {
                                        if (typeof window === 'undefined') return;
                                        const ok = window.confirm(
                                            'Last chance. Delete your account and ALL associated data?',
                                        );
                                        if (ok) void runDelete();
                                    } else {
                                        Alert.alert(
                                            'Delete account?',
                                            'Last chance. This will permanently remove your account and ALL associated data. This cannot be undone.',
                                            [
                                                {
                                                    text: 'Cancel',
                                                    style: 'cancel',
                                                },
                                                {
                                                    text: 'Delete forever',
                                                    style: 'destructive',
                                                    onPress: runDelete,
                                                },
                                            ],
                                        );
                                    }
                                };
                                if (Platform.OS === 'web') {
                                    if (typeof window === 'undefined') return;
                                    const ok = window.confirm(
                                        'Delete account?\n\nThis will permanently delete:\n  • Your sign-in\n  • Your profile\n  • Your membership in any households\n  • Tasks and events you created\n\nIt does NOT delete households you share with others. They will remain accessible to other parents.\n\nContinue?',
                                    );
                                    if (ok) confirmSecondStep();
                                } else {
                                    Alert.alert(
                                        'Delete account?',
                                        "This will permanently delete your sign-in, profile, household memberships, and the tasks + events you created. Households you share with others will remain accessible to other parents. You'll be signed out immediately.",
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Continue',
                                                style: 'destructive',
                                                onPress: confirmSecondStep,
                                            },
                                        ],
                                    );
                                }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Delete account"
                            style={({ pressed }) => [
                                styles.dangerRow,
                                styles.dangerRowLast,
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText style={styles.dangerRowText}>
                                Delete account
                            </ThemedText>
                        </Pressable>
                    </View>

                    {/* Tagline footer — mono caps centered, identifies the
                        product at the bottom of the longest screen. Matches
                        the design's "ONENEST · MADE FOR FAMILIES" footer. */}
                    <ThemedText
                        style={[
                            styles.tagline,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        ONENEST · MADE FOR FAMILIES
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { padding: Spacing.four, gap: Spacing.five, paddingBottom: Spacing.six },

    // ── Phase 6 header (mono pretitle + "Settings" title) ───────────────
    // ── Top bar (Phase 6.7.6) — same pattern as the /settings/* sub-routes
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        gap: Spacing.two,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },

    pageHeader: { gap: 2 },
    pageHeaderPretitle: {
        fontFamily: FontFamily.monoMedium,
        fontSize: 10,
        letterSpacing: -0.2,
    },

    // ── Profile hero card (replaces standalone Display name section) ────
    // 56px circular avatar with pencil-edit badge bottom-right + name +
    // email + role pill column. Matches screens-extra.jsx:1940-1970.
    // Phase 6.5b: profile hero is now column-flow. The avatar + body
    // pair sit in profileHeroTopRow; the swatch row hangs below via
    // profileHeroColorRow with a hairline divider between.
    // Phase 6.7.6: slim flex-row hero — read-only summary + EDIT chip.
    // No more column flow (the old swatch-row underneath was lifted to
    // /settings/profile in 6.7.3).
    profileHero: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    profileHeroEditChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    profileHeroEditChipText: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // Phase 6.7: Theme & accent right-slot is a {square + text} pair
    appearanceRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    appearanceRowAccentSquare: {
        width: 14,
        height: 14,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
    },
    appearanceRowRightText: { fontSize: 12, letterSpacing: -0.2 },

    // (Phase 6.7.6 dead-style sweep: profileHeroTopRow, profileHeroColorRow,
    // profileHeroColorLabel, profileHeroSwatchRow, profileHeroSwatch, and
    // the entire inviteHero* set deleted — the inline display-name editor +
    // swatch picker + dashed invite hero card all moved to
    // /settings/profile and /settings/members.)

    // ── Household summary rows (Phase 6.5d) ────────────────────────────
    // Custom rows for Members / Children where the right slot is an
    // overlapping avatar/badge stack + mono count (SRow's right slot only
    // supports a string or a single ReactNode, which is enough for plain
    // mono text but reads cleaner here with a flex container).
    householdSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    householdSummaryRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    // Phase 6.7 design (CStack size 18 in screens-settings.jsx:196): the
    // 22px avatars were too prominent and pushed the count badge off-row
    // on narrow screens; 18px matches the rest of the chip strip rhythm.
    householdSummaryAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        // Tiny negative margin gives the overlapping-stack feel without
        // needing a dedicated MemberStack import (this is the only place
        // in Settings that wants the overlap pattern).
        marginLeft: -5,
    },
    householdSummaryAvatarText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 9,
        fontWeight: '700',
    },
    householdSummaryCount: { fontSize: 11, letterSpacing: -0.2, marginLeft: 4 },
    // Phase 6.7 design (screens-settings.jsx:164): 48×48 CAvatar in the
    // slim hero. The legacy 56px was carry-over from the column-flow hero
    // that hosted an inline editor — now that the editor moved to
    // /settings/profile the smaller size sits cleanly next to the EDIT chip.
    profileHeroAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileHeroAvatarText: {
        color: '#fff',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 18,
        fontWeight: '600',
    },
    profileHeroBody: { flex: 1, minWidth: 0, gap: 1 },
    // Phase 6.7 pass-2 design fix: 16/-0.3 per the handoff
    // (screens-settings.jsx:166). Was 17/-0.4 which read 1pt too large
    // against the new 48px avatar.
    profileHeroName: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    profileHeroEmail: {
        fontSize: 12,
        fontFamily: FontFamily.monoMedium,
        letterSpacing: -0.2,
    },
    profileHeroPills: {
        flexDirection: 'row',
        gap: 5,
        marginTop: 6,
    },
    profileHeroPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    profileHeroPillText: {
        fontFamily: FontFamily.monoSemiBold,
        fontSize: 9.5,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },

    // ── Danger zone card (Sign out + Delete account placeholder) ────────
    // Single card with two alert-red centered rows. Matches the design's
    // restrained treatment (screens-extra.jsx:2108-2127) — destructive
    // actions get their own container at the bottom of the screen, visually
    // separated from settings sections so users don't graze into them.
    dangerCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    dangerRow: {
        paddingVertical: 14,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dangerRowLast: { borderBottomWidth: 0 },
    dangerRowText: {
        color: BrandColors.error,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    // ── Tagline footer (mono caps centered) ────────────────────────────
    tagline: {
        textAlign: 'center',
        fontSize: 10,
        letterSpacing: 0.6,
        marginTop: Spacing.three,
    },

    // ── SGroup / SRow / SToggle primitives (Phase 6.4) ──────────────────
    // SGroup is the new design vocabulary for settings sections (caps mono
    // label above a card containing hairline-separated rows). Distinct
    // from SettingsSection's "title + bold heading above a padded card"
    // because the row-style layout reads tighter and matches iOS Settings.
    sGroup: { gap: 8 },
    sGroupHeader: { paddingHorizontal: Spacing.four },
    sGroupLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    sGroupSubLabel: {
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    sGroupCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    sRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    sRowSub: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
    sRowRight: { fontSize: 12, letterSpacing: -0.2 },

    // (Phase 6.7.6 dead-style sweep: accentSwatch, accentSwatchRow,
    // appearanceMergedRow, appearanceMergedHeader, actionRow, connectRow,
    // primaryBtn, connectBtn, addBtn, actionTextError, subList, subRow,
    // subRowText, subItem, typeColumn, typeOption, memberList, memberRow,
    // memberDot, swatchRow, swatch, chipRow, appearanceChip, roleChipRow,
    // roleChip, inviteRow, pendingSection, pendingHeader, errorText,
    // signOut, signOutText — all deleted. Most belonged to the legacy
    // inline editors that moved to /settings/* sub-routes in Phase 6.6/6.7.)

    // ── SettingsSection — still in use for the Tools sub-card (Welcome
    //    card restore). The section wrapper is light enough to keep.
    section: { gap: Spacing.two },
    sectionHeader: { gap: 2, paddingHorizontal: Spacing.one },
    sectionCard: {
        padding: Surfaces.card.padding,
        gap: Spacing.three,
    },

    // ── Common rows / buttons — only the ones the Tools card uses
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
    },
    secondaryBtn: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    actionTextAccent: { fontWeight: '600' },

    pressed: { opacity: 0.7 },
});
