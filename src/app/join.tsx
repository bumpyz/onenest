// Join Household — what an invitee sees after tapping a private invite
// link (Phase 9 redesign, #296).
//
// Design source: docs/design-handoffs/onenest-spec-v3/
//   design_handoff_calendar_conflicts/screens-extra-2.jsx::JoinHousehold (line 185).
//
// Layout, top to bottom:
//   1. Top X — decline (lightweight close, hairline circle)
//   2. Hero block (centered):
//      • "YOU'VE BEEN INVITED" mono pill (accent-tinted, sparkle glyph)
//      • Inviter avatar (96px) with accent ring
//      • "{inviter} invited you to join" copy
//      • "{household name}" 28/600 title
//      • Mono caps meta: "{HOUSEHOLD TYPE} · {KID COUNT} KIDS" (when known)
//   3. "Who's here" card — parents/caregivers stack + kid stack
//   4. "JOIN AS" — single read-only role display (per chat decision: the
//      inviter picks the role at invite time; the invitee can't override)
//   5. Privacy note (shield icon)
//   6. Sticky CTA — "Accept invitation" + "Decline invitation"
//
// Four route states:
//   • no token in URL  → "Invalid link" + Go home
//   • authLoading      → LoadingScreen
//   • no session       → mini "You're invited" splash + Continue with Google
//   • preview loading  → LoadingScreen
//   • preview error    → "Invitation unavailable" + Go home
//   • preview ready    → the redesigned join screen above
//
// We call `getInvitationFullPreview` (#296 / migration 0063) to fetch the
// parent + kid stacks alongside the scalar fields. The legacy
// `getInvitationPreview` stays untouched for back-compat — nothing else
// in the codebase calls it today, but removing it would burn an RPC
// other clients might still depend on.

import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemberStack } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { signInWithGoogle } from '@/lib/auth';
import {
    acceptInvitation,
    getInvitationFullPreview,
    type HouseholdRole,
    type InvitationFullPreview,
} from '@/lib/db';
import { labelForHouseholdType } from '@/lib/household-types';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// First letter of the inviter's first word — drives the avatar fallback
// initial. Matches the rest of the app's first+last convention but the
// hero shows a single letter (96px circle, design intent is one big
// glyph, not two compact letters).
function firstInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
}

// Role copy for the "Join as" block. We never show the picker (per
// chat decision: the inviter picks the role at invite time), so this
// just maps the enum to title + helper sub.
function roleCopy(role: HouseholdRole): { title: string; sub: string } {
    if (role === 'caregiver') {
        return {
            title: 'Caregiver',
            sub: "Read-only access · see schedule, get reminders · can't edit",
        };
    }
    return {
        title: 'Co-parent',
        sub: 'Edit everything · co-own the calendar · invite others',
    };
}

export default function JoinScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ token?: string | string[] }>();
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();

    const [preview, setPreview] = useState<InvitationFullPreview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => {
        if (!session || !token) return;
        setPreviewLoading(true);
        setPreviewError(null);
        getInvitationFullPreview(token)
            .then((row) => {
                if (!row) {
                    setPreviewError(
                        'This invitation is no longer valid. It may have been used, revoked, or expired.',
                    );
                } else {
                    setPreview(row);
                }
            })
            .catch((err: unknown) => {
                setPreviewError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => setPreviewLoading(false));
    }, [session, token]);

    const handleSignIn = async () => {
        setSigningIn(true);
        try {
            // Preserve the current URL (including ?token=...) so we return
            // here after OAuth round-trip.
            const redirectTo =
                Platform.OS === 'web' ? window.location.href : undefined;
            await signInWithGoogle({ redirectTo });
        } catch (err) {
            setSigningIn(false);
            const message = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') console.error('Sign-in failed', err);
            else Alert.alert('Sign-in failed', message);
        }
    };

    const handleAccept = async () => {
        if (!token) return;
        setAccepting(true);
        try {
            await acceptInvitation(token);
            router.replace('/');
        } catch (err) {
            setAccepting(false);
            const message = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                setPreviewError(message);
            } else {
                Alert.alert("Couldn't accept invitation", message);
            }
        }
    };

    const handleDecline = () => router.replace('/');

    // ── State: no token in URL ───────────────────────────────────────
    if (!token) {
        return (
            <CenteredMessage
                title="Invalid link"
                body="This URL is missing an invitation token."
                cta="Go home"
                onCta={() => router.replace('/')}
                colors={colors}
            />
        );
    }

    if (authLoading) return <LoadingScreen />;

    // ── State: signed out ────────────────────────────────────────────
    // We bounce through a mini hero so the user knows what they're
    // accepting before going through OAuth. Same "You've been invited"
    // pill so the visual identity carries through.
    if (!session) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.signedOutWrap}>
                        <View
                            style={[
                                styles.invitedPill,
                                {
                                    backgroundColor: withAlpha(colors.accent, 0x15 / 0xff),
                                    borderColor: withAlpha(colors.accent, 0x40 / 0xff),
                                },
                            ]}>
                            {/* "+" sparkle glyph — matches the design's
                                fresh / celebratory burst. Feather "mail"
                                read as "you have email," which changes
                                the moment (audit, #296 HIGH). */}
                            <Feather name="plus" size={11} color={colors.accent} />
                            <ThemedText
                                style={[
                                    styles.invitedPillText,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                YOU&apos;VE BEEN INVITED
                            </ThemedText>
                        </View>
                        <ThemedText
                            style={[styles.signedOutTitle, { color: colors.text }]}>
                            Sign in to accept
                        </ThemedText>
                        <ThemedText
                            style={[
                                styles.signedOutSub,
                                { color: colors.textSecondary },
                            ]}>
                            We&apos;ll bring you right back here after sign-in so you
                            can see who&apos;s in the household before joining.
                        </ThemedText>
                        <Pressable
                            onPress={handleSignIn}
                            disabled={signingIn}
                            accessibilityRole="button"
                            accessibilityLabel="Continue with Google"
                            style={({ pressed }) => [
                                styles.googleButton,
                                {
                                    backgroundColor: colors.text,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.googleText,
                                    { color: colors.onAccent },
                                ]}>
                                {signingIn ? 'Opening Google…' : 'Continue with Google'}
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    if (previewLoading) return <LoadingScreen />;

    // ── State: preview lookup failed ──────────────────────────────────
    if (previewError || !preview) {
        return (
            <CenteredMessage
                title="Invitation unavailable"
                body={previewError ?? 'Invitation not found.'}
                cta="Go home"
                onCta={() => router.replace('/')}
                colors={colors}
            />
        );
    }

    // ── State: preview ready (the main redesigned hero) ───────────────
    const inviterColor = preview.inviter_color || colors.accent;
    const role = roleCopy(preview.role);
    const householdTypeLabel = labelForHouseholdType(preview.household_type);
    const kidCount = preview.kid_names.length;
    const adultCount = preview.parent_names.length + 1; // + the inviter themselves
    const metaParts = [
        householdTypeLabel.toUpperCase(),
        kidCount > 0 ? `${kidCount} KID${kidCount === 1 ? '' : 'S'}` : null,
    ].filter((s): s is string => !!s);

    // Build MemberStack inputs — the primitive takes `name` + `color`
    // per item and renders the overlapping-avatar ring. We prepend the
    // inviter to the parents stack so the hero ring above isn't
    // visually duplicated inside the same stack. (The RPC intentionally
    // excludes the inviter from `parent_names` so we don't double-
    // render them.)
    const parentMembers = [
        { key: 'inviter', name: preview.inviter_name, color: inviterColor },
        ...preview.parent_names.map((name, idx) => ({
            key: `parent-${idx}`,
            name,
            color: preview.parent_colors[idx] || colors.accent,
        })),
    ];
    const kidMembers = preview.kid_names.map((name, idx) => ({
        key: `kid-${idx}`,
        name,
        color: preview.kid_colors[idx] || colors.accent,
    }));

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top X — decline (lightweight close) */}
                <View style={styles.topRow}>
                    <View style={styles.topSpacer} />
                    <Pressable
                        onPress={handleDecline}
                        accessibilityRole="button"
                        accessibilityLabel="Decline invitation"
                        disabled={accepting}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="x" size={14} color={colors.inkSec} />
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {/* Hero */}
                    <View style={styles.hero}>
                        <View
                            style={[
                                styles.invitedPill,
                                {
                                    backgroundColor: withAlpha(colors.accent, 0x15 / 0xff),
                                    borderColor: withAlpha(colors.accent, 0x40 / 0xff),
                                },
                            ]}>
                            {/* "+" sparkle glyph — matches the design's
                                fresh / celebratory burst. Feather "mail"
                                read as "you have email," which changes
                                the moment (audit, #296 HIGH). */}
                            <Feather name="plus" size={11} color={colors.accent} />
                            <ThemedText
                                style={[
                                    styles.invitedPillText,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                YOU&apos;VE BEEN INVITED
                            </ThemedText>
                        </View>

                        {/* Inviter avatar with accent ring */}
                        <View style={styles.avatarWrap}>
                            <View
                                style={[
                                    styles.avatarRing,
                                    {
                                        borderColor: withAlpha(colors.accent, 0x55 / 0xff),
                                    },
                                ]}
                            />
                            <View
                                style={[
                                    styles.avatar,
                                    { backgroundColor: inviterColor },
                                ]}>
                                <ThemedText style={styles.avatarInitial}>
                                    {firstInitial(preview.inviter_name)}
                                </ThemedText>
                            </View>
                        </View>

                        <ThemedText
                            style={[styles.invitedBy, { color: colors.textSecondary }]}>
                            <ThemedText
                                style={{ color: colors.text, fontWeight: '600' }}>
                                {preview.inviter_name}
                            </ThemedText>{' '}
                            invited you to join
                        </ThemedText>
                        <ThemedText
                            style={[styles.householdName, { color: colors.text }]}>
                            {preview.household_name}
                        </ThemedText>
                        {metaParts.length > 0 ? (
                            <ThemedText
                                style={[
                                    styles.metaLine,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                {metaParts.join(' · ')}
                            </ThemedText>
                        ) : null}
                    </View>

                    {/* Who's here card — parents + kids stacks. We only
                        render each sub-block when there's something to
                        show, so a solo invitee household doesn't render
                        an empty "Kids" header. */}
                    {parentMembers.length > 0 || kidMembers.length > 0 ? (
                        <View
                            style={[
                                styles.familyCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.familyCardHeader,
                                    { borderBottomColor: colors.hair },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.sectionLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    WHO&apos;S HERE
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.familyCardMeta,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {adultCount} {adultCount === 1 ? 'PERSON' : 'PEOPLE'}
                                    {kidCount > 0
                                        ? ` · ${kidCount} KID${kidCount === 1 ? '' : 'S'}`
                                        : ''}
                                </ThemedText>
                            </View>
                            {parentMembers.length > 0 ? (
                                <View style={styles.familySubBlock}>
                                    <ThemedText
                                        style={[
                                            styles.familySubLabel,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        PARENTS &amp; CAREGIVERS
                                    </ThemedText>
                                    <View style={styles.familyStackRow}>
                                        <MemberStack members={parentMembers} size="md" />
                                        <ThemedText
                                            style={[
                                                styles.familyStackText,
                                                { color: colors.inkSec },
                                            ]}>
                                            {summarizeNames(
                                                parentMembers.map((m) => m.name),
                                            )}
                                        </ThemedText>
                                    </View>
                                </View>
                            ) : null}
                            {kidMembers.length > 0 ? (
                                <View
                                    style={[
                                        styles.familySubBlock,
                                        parentMembers.length > 0 &&
                                            styles.familySubBlockSpacer,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.familySubLabel,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        KIDS
                                    </ThemedText>
                                    <View style={styles.familyStackRow}>
                                        <MemberStack members={kidMembers} size="md" />
                                        <ThemedText
                                            style={[
                                                styles.familyStackText,
                                                { color: colors.inkSec },
                                            ]}>
                                            {kidMembers.map((m) => m.name).join(', ')}
                                        </ThemedText>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {/* "Join as" — read-only role pill (per chat decision).
                        Renders as a single accent-tinted card with title
                        + sub instead of a 3-up picker. */}
                    <View style={styles.roleSection}>
                        <ThemedText
                            style={[
                                styles.sectionLabel,
                                {
                                    color: colors.inkSec,
                                    fontFamily: FontFamily.monoSemiBold,
                                    paddingHorizontal: Spacing.three,
                                },
                            ]}>
                            JOIN AS
                        </ThemedText>
                        <View
                            style={[
                                styles.roleCard,
                                {
                                    backgroundColor: withAlpha(colors.accent, 0x15 / 0xff),
                                    borderColor: colors.accent,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.roleDot,
                                    { backgroundColor: colors.accent },
                                ]}>
                                <View
                                    style={[
                                        styles.roleDotInner,
                                        { backgroundColor: colors.onAccent },
                                    ]}
                                />
                            </View>
                            <View style={styles.roleCopy}>
                                <ThemedText
                                    style={[styles.roleTitle, { color: colors.text }]}>
                                    {role.title}
                                </ThemedText>
                                <ThemedText
                                    style={[styles.roleSub, { color: colors.inkFaint }]}>
                                    {role.sub}
                                </ThemedText>
                            </View>
                        </View>
                        <ThemedText
                            style={[
                                styles.roleHint,
                                { color: colors.inkFaint },
                            ]}>
                            {preview.inviter_name.split(/\s+/)[0]} picked your role when
                            sending the invite. You can&apos;t change it here.
                        </ThemedText>
                    </View>

                    {/* Privacy note */}
                    <View style={styles.privacyRow}>
                        <Feather
                            name="shield"
                            size={13}
                            color={colors.inkFaint}
                            style={styles.privacyIcon}
                        />
                        <ThemedText
                            style={[styles.privacyText, { color: colors.inkFaint }]}>
                            Your personal calendar stays private. Only the times you
                            mark as &ldquo;busy&rdquo; will be shared with co-parents —
                            never titles, locations, or attendees.
                        </ThemedText>
                    </View>
                </ScrollView>

                {/* Sticky CTA */}
                <View
                    style={[
                        styles.ctaBar,
                        {
                            backgroundColor: colors.background,
                            borderTopColor: colors.hair,
                        },
                    ]}>
                    <Pressable
                        onPress={handleAccept}
                        disabled={accepting}
                        accessibilityRole="button"
                        accessibilityLabel="Accept invitation"
                        style={({ pressed }) => [
                            styles.acceptBtn,
                            { backgroundColor: colors.accent },
                            pressed && !accepting && styles.pressed,
                            accepting && { opacity: 0.7 },
                        ]}>
                        <ThemedText
                            style={[styles.acceptBtnText, { color: colors.onAccent }]}>
                            {accepting ? 'Joining…' : 'Accept invitation'}
                        </ThemedText>
                        {!accepting ? (
                            <Feather
                                name="arrow-right"
                                size={14}
                                color={colors.onAccent}
                            />
                        ) : null}
                    </Pressable>
                    <Pressable
                        onPress={handleDecline}
                        disabled={accepting}
                        accessibilityRole="button"
                        accessibilityLabel="Decline invitation"
                        style={({ pressed }) => [
                            styles.declineBtn,
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.declineBtnText,
                                { color: colors.textSecondary },
                            ]}>
                            Decline invitation
                        </ThemedText>
                    </Pressable>
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
//
// `summarizeNames` renders the parents/caregivers line as
//   "Alex, Riley · plus Casey & Devon"
// when there are >2 names, condensed to fit on a single body line. The
// inviter (always first in our array) gets weight-600 so the reader's
// eye lands on them first.
function summarizeNames(names: string[]): string {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    if (names.length === 3) return `${names[0]}, ${names[1]} · plus ${names[2]}`;
    return `${names[0]}, ${names[1]} · plus ${names.length - 2} more`;
}

function CenteredMessage({
    title,
    body,
    cta,
    onCta,
    colors,
}: {
    title: string;
    body: string;
    cta: string;
    onCta: () => void;
    colors: Palette;
}) {
    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.centeredWrap}>
                    <ThemedText style={[styles.centeredTitle, { color: colors.text }]}>
                        {title}
                    </ThemedText>
                    <ThemedText
                        style={[styles.centeredBody, { color: colors.textSecondary }]}>
                        {body}
                    </ThemedText>
                    <Pressable
                        onPress={onCta}
                        accessibilityRole="button"
                        accessibilityLabel={cta}
                        style={({ pressed }) => [
                            styles.linkBtn,
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText style={{ color: colors.accent, fontWeight: '600' }}>
                            {cta}
                        </ThemedText>
                    </Pressable>
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },

    // ── Top bar
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.three,
        paddingVertical: 8,
    },
    topSpacer: { width: 32 },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },

    scroll: {
        paddingBottom: 140,
    },

    // ── Hero
    hero: {
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingTop: 12,
        paddingBottom: 24,
        gap: 6,
    },
    invitedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 14,
    },
    invitedPillText: {
        fontSize: 11,
        letterSpacing: 0.6,
    },
    avatarWrap: {
        width: 96,
        height: 96,
        marginBottom: 18,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarRing: {
        position: 'absolute',
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 2,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '700',
        letterSpacing: -1,
    },
    invitedBy: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 4,
    },
    householdName: {
        fontSize: 28,
        fontWeight: '600',
        letterSpacing: -1,
        lineHeight: 32,
        textAlign: 'center',
    },
    metaLine: {
        fontSize: 11,
        letterSpacing: -0.2,
        marginTop: 6,
    },

    // ── Family preview card
    familyCard: {
        marginHorizontal: Spacing.three,
        marginBottom: 18,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    familyCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    familyCardMeta: { fontSize: 10, letterSpacing: 0.3 },
    sectionLabel: {
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    familySubBlock: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 8,
    },
    familySubBlockSpacer: { paddingTop: 0 },
    familySubLabel: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    familyStackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    familyStackText: {
        fontSize: 12,
        lineHeight: 18,
        flex: 1,
    },

    // ── Role section
    roleSection: {
        paddingBottom: 18,
        gap: 8,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginHorizontal: Spacing.three,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    roleDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
        flexShrink: 0,
    },
    roleDotInner: { width: 8, height: 8, borderRadius: 4 },
    roleCopy: { flex: 1, minWidth: 0, gap: 2 },
    roleTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
    roleSub: { fontSize: 11.5, lineHeight: 16 },
    roleHint: {
        paddingHorizontal: Spacing.three + 8,
        fontSize: 11,
        lineHeight: 16,
    },

    // ── Privacy
    privacyRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        paddingHorizontal: Spacing.three + 8,
        paddingBottom: 18,
    },
    privacyIcon: { marginTop: 1, flexShrink: 0 },
    privacyText: { fontSize: 11.5, lineHeight: 17, flex: 1 },

    // ── CTA bar
    ctaBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: Spacing.three,
        paddingTop: 12,
        paddingBottom: 30,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    acceptBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    acceptBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
    declineBtn: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    declineBtnText: { fontSize: 12.5, fontWeight: '500', letterSpacing: -0.1 },

    // ── Signed-out splash
    signedOutWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.four,
        gap: Spacing.two,
    },
    signedOutTitle: {
        fontSize: 22,
        fontWeight: '600',
        letterSpacing: -0.7,
        textAlign: 'center',
    },
    signedOutSub: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        marginBottom: Spacing.three,
        maxWidth: 320,
    },
    googleButton: {
        marginTop: Spacing.two,
        minWidth: 240,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.three,
    },
    googleText: { fontWeight: '600', fontSize: 14.5, letterSpacing: -0.2 },

    // ── Centered fallback message
    centeredWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.four,
        gap: Spacing.two,
    },
    centeredTitle: {
        fontSize: 20,
        fontWeight: '600',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    centeredBody: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        maxWidth: 320,
        marginBottom: Spacing.three,
    },
    linkBtn: { padding: Spacing.two },

    // ── Touch feedback
    pressed: { opacity: 0.7 },
});
