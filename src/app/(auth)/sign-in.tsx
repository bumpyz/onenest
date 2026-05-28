// Sign-in — first-touch screen (Phase 9 redesign, #296).
//
// Design source: docs/design-handoffs/onenest-spec-v3/
//   design_handoff_calendar_conflicts/screens-extra-2.jsx::SignIn (line 7).
//
// Layout, top to bottom:
//   1. Accent gradient hero (320px) with brand mark + house silhouettes
//   2. Lower card (rounded top, starts at y=300) with:
//      • "Welcome back" 22/600 title + sub copy
//      • Continue with Google (primary — ink fill, accent-tinted glyph on dark)
//      • Continue with Apple (secondary — card bg, hairline border)
//      • Continue with email (disabled — "COMING SOON" mono tag)
//      • Mono caps "HAVE AN INVITE?" divider
//      • "Open invite link" helper card (icon tile + title + sub + chevron)
//      • Privacy footer at the bottom
//
// Email auth isn't wired today — the spec shows the third button so we
// render it disabled with a "COMING SOON" badge rather than hiding it,
// per the answer in chat (#296). That preserves the design's three-tier
// visual layout AND honestly communicates the gap.
//
// The "Open invite link" helper card surfaces an instruction sheet rather
// than trying to do a clipboard-paste flow — we don't have a way to
// validate a token without the URL the OS deep-link layer hands us, so
// the card explains "tap your invite link from email or text to open it
// directly here" and the user backs out.

import { Feather } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { isAppleAuthAvailable, signInWithApple, signInWithGoogle } from '@/lib/auth';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function SignInScreen() {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const dark = scheme === 'dark';

    const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
    const [appleAvailable, setAppleAvailable] = useState(false);

    useEffect(() => {
        isAppleAuthAvailable().then(setAppleAvailable);
    }, []);

    const handleError = (provider: string, error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        // Apple sign-in throws ERR_REQUEST_CANCELED when the user dismisses the
        // sheet; ignore it. Same for "canceled" on the Google web flow.
        if (message.includes('ERR_REQUEST_CANCELED') || message.includes('canceled')) {
            return;
        }
        if (Platform.OS === 'web') {
            console.error(`${provider} sign-in failed`, error);
            return;
        }
        Alert.alert(`${provider} sign-in failed`, message);
    };

    const onApple = async () => {
        setBusy('apple');
        try {
            await signInWithApple();
        } catch (error) {
            handleError('Apple', error);
        } finally {
            setBusy(null);
        }
    };

    const onGoogle = async () => {
        setBusy('google');
        try {
            await signInWithGoogle();
        } catch (error) {
            handleError('Google', error);
        } finally {
            setBusy(null);
        }
    };

    const onInviteHelper = () => {
        const title = 'Open your invite link';
        const body =
            'Tap the invite link from the email or text message you received. It will open here directly and let you join the household.';
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') window.alert(`${title}\n\n${body}`);
        } else {
            Alert.alert(title, body, [{ text: 'Got it', style: 'default' }]);
        }
    };

    return (
        <ThemedView style={styles.container}>
            {/* Accent hero band — 320px tall, top-anchored gradient with
                soft house silhouettes layered over. Lower card overlaps
                the bottom 20px so the gradient bleeds INTO the card edge
                rather than tile-stacking under it (matches the design
                source's layered look). */}
            <LinearGradient
                colors={[
                    colors.accent,
                    colors.accent,
                    withAlpha(colors.accent, dark ? 0x88 / 0xff : 0xaa / 0xff),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.4, 1]}
                style={styles.heroBand}>
                {/* Decorative house silhouettes from the design source were
                    cut in this pass — react-native-svg isn't a dep and the
                    codebase deliberately avoids it (see priority-flag.tsx
                    comment). The gradient band reads as a brand-y hero on
                    its own without the outlines. */}
                <SafeAreaView style={styles.heroSafe} edges={['top']}>
                    <View style={styles.brandWrap}>
                        <View style={styles.brandTile}>
                            {/* Feather "home" stands in for the design's
                                custom stroke-only house path. Same shape
                                language, no SVG dep. */}
                            <Feather name="home" size={34} color="#FFFFFF" />
                        </View>
                        <ThemedText style={styles.brandWordmark}>OneNest</ThemedText>
                        <ThemedText style={styles.brandTagline}>
                            The shared calendar for every family shape.
                        </ThemedText>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* Lower card — rounded top corners, sits over the bottom 20px
                of the hero band per the design. ScrollView so a short
                viewport (e.g. iPhone SE) doesn't clip the privacy
                footer. */}
            <View
                style={[
                    styles.lowerCard,
                    { backgroundColor: colors.background },
                ]}>
                <ScrollView
                    contentContainerStyle={styles.lowerScroll}
                    keyboardShouldPersistTaps="handled">
                    <ThemedText style={[styles.welcomeTitle, { color: colors.text }]}>
                        Welcome back
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.welcomeSub,
                            { color: colors.textSecondary },
                        ]}>
                        Sign in to your household. End-to-end encrypted. Co-parents
                        see only what you choose to share.
                    </ThemedText>

                    {/* Google — primary. Uses the ink color as fill so the
                        button reads as the dominant action; Apple + email
                        are visual hairlines below. The leading glyph is a
                        plain "G" letter chip in Google blue — the multi-
                        color G logo would require react-native-svg which
                        isn't a dep; a monogram in brand color reads as
                        unambiguously Google without the dependency. */}
                    <SignInButton
                        label={busy === 'google' ? 'Signing in…' : 'Continue with Google'}
                        icon={<GoogleMonogram />}
                        primary
                        disabled={busy !== null}
                        onPress={onGoogle}
                        colors={colors}
                    />

                    {/* Apple — only render when the native button is
                        actually available (iOS 13+ / macOS). On Android +
                        web we hide it; Google + email cover those
                        platforms. */}
                    {appleAvailable ? (
                        <View style={styles.appleNativeWrap}>
                            <AppleAuthentication.AppleAuthenticationButton
                                buttonType={
                                    AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                                }
                                buttonStyle={
                                    dark
                                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                                }
                                cornerRadius={12}
                                style={styles.appleNative}
                                onPress={onApple}
                            />
                        </View>
                    ) : null}

                    {/* Email — disabled with "COMING SOON" badge. Renders
                        regardless of platform so the visual rhythm of the
                        spec is preserved. */}
                    <SignInButton
                        label="Continue with email"
                        icon={
                            <Feather name="mail" size={18} color={colors.text} />
                        }
                        disabled
                        comingSoon
                        onPress={() => undefined}
                        colors={colors}
                    />

                    {/* Mono caps divider — "HAVE AN INVITE?" sits between
                        sign-in providers and the invite helper card. */}
                    <View style={styles.dividerRow}>
                        <View
                            style={[styles.dividerLine, { backgroundColor: colors.hair }]}
                        />
                        <ThemedText
                            style={[
                                styles.dividerLabel,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            HAVE AN INVITE?
                        </ThemedText>
                        <View
                            style={[styles.dividerLine, { backgroundColor: colors.hair }]}
                        />
                    </View>

                    {/* Invite helper card — accent-tinted glyph tile + copy
                        + chevron. Tap opens an alert explaining the deep-
                        link flow (we don't have a clipboard-paste path). */}
                    <Pressable
                        onPress={onInviteHelper}
                        accessibilityRole="button"
                        accessibilityLabel="How to open an invite link"
                        style={({ pressed }) => [
                            styles.inviteCard,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <View
                            style={[
                                styles.inviteIconTile,
                                {
                                    backgroundColor: withAlpha(colors.accent, 0x15 / 0xff),
                                },
                            ]}>
                            <Feather name="link-2" size={16} color={colors.accent} />
                        </View>
                        <View style={styles.inviteCopy}>
                            <ThemedText
                                style={[styles.inviteTitle, { color: colors.text }]}>
                                Open invite link
                            </ThemedText>
                            <ThemedText
                                style={[
                                    styles.inviteSub,
                                    { color: colors.inkFaint },
                                ]}>
                                From an email or text message
                            </ThemedText>
                        </View>
                        <Feather
                            name="chevron-right"
                            size={14}
                            color={colors.inkFaint}
                        />
                    </Pressable>

                    {/* Privacy footer — sits below the helper card on the
                        scroll's natural floor. On tall viewports it ends
                        up at the bottom of the content; on short ones the
                        ScrollView keeps it reachable. */}
                    <ThemedText
                        style={[styles.privacyText, { color: colors.inkFaint }]}>
                        By continuing you agree to our{' '}
                        <ThemedText
                            style={[styles.privacyLink, { color: colors.text }]}>
                            Terms
                        </ThemedText>{' '}
                        and{' '}
                        <ThemedText
                            style={[styles.privacyLink, { color: colors.text }]}>
                            Privacy Policy
                        </ThemedText>
                        .
                    </ThemedText>
                </ScrollView>
            </View>
        </ThemedView>
    );
}

// ─── Google monogram ───────────────────────────────────────────────────────
// White square chip with a Google-blue "G" — reads as unambiguously Google
// without requiring react-native-svg for the full multi-color logo.
function GoogleMonogram() {
    return (
        <View style={styles.googleChip}>
            <ThemedText style={styles.googleChipText}>G</ThemedText>
        </View>
    );
}

// ─── SignInButton primitive ────────────────────────────────────────────────
// Three vocab variants: primary (ink fill, contrast text), secondary (card
// bg + hairline border), disabled (card bg, inkFaint text, "COMING SOON"
// mono badge inline). Lives here as a local primitive — only this screen
// uses this shape today.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

function SignInButton({
    label,
    icon,
    primary,
    disabled,
    comingSoon,
    onPress,
    colors,
}: {
    label: string;
    icon: React.ReactNode;
    primary?: boolean;
    disabled?: boolean;
    comingSoon?: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: !!disabled }}
            style={({ pressed }) => [
                styles.signInBtn,
                primary
                    ? { backgroundColor: colors.text }
                    : {
                          backgroundColor: colors.backgroundElement,
                          borderColor: colors.hair,
                          borderWidth: StyleSheet.hairlineWidth,
                      },
                disabled && { opacity: 0.55 },
                pressed && !disabled && styles.pressed,
            ]}>
            {icon}
            <ThemedText
                style={[
                    styles.signInBtnText,
                    primary
                        ? { color: colors.onAccent }
                        : { color: colors.text },
                ]}>
                {label}
            </ThemedText>
            {comingSoon ? (
                <View
                    style={[
                        styles.comingSoonBadge,
                        {
                            backgroundColor: colors.backgroundInset,
                            borderColor: colors.hair,
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.comingSoonText,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        SOON
                    </ThemedText>
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Hero band
    heroBand: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 320,
        overflow: 'hidden',
    },
    heroSafe: { flex: 1 },
    brandWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingTop: Spacing.three,
    },
    brandTile: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.13)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.33)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandWordmark: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -1.2,
        lineHeight: 32,
    },
    brandTagline: {
        fontSize: 13.5,
        color: 'rgba(255,255,255,0.80)',
        textAlign: 'center',
        letterSpacing: -0.1,
        maxWidth: 260,
        lineHeight: 19,
    },

    // ── Lower card
    lowerCard: {
        position: 'absolute',
        top: 300,
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    lowerScroll: {
        paddingHorizontal: Spacing.four,
        paddingTop: 36,
        paddingBottom: Spacing.six,
    },
    welcomeTitle: {
        fontSize: 22,
        fontWeight: '600',
        letterSpacing: -0.7,
        marginBottom: 6,
    },
    welcomeSub: {
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 28,
    },

    // ── Sign-in buttons
    signInBtn: {
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 10,
        paddingHorizontal: Spacing.three,
    },
    googleChip: {
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleChipText: {
        color: '#4285F4',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 16,
    },
    signInBtnText: {
        fontSize: 14.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    appleNativeWrap: { marginBottom: 10 },
    appleNative: { height: 50, width: '100%' },
    comingSoonBadge: {
        position: 'absolute',
        right: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
    },
    comingSoonText: {
        fontSize: 9,
        letterSpacing: 0.4,
    },

    // ── Divider
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 24,
        marginBottom: 18,
    },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // ── Invite helper card
    inviteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    inviteIconTile: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    inviteCopy: { flex: 1, minWidth: 0 },
    inviteTitle: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    inviteSub: { fontSize: 11, marginTop: 1 },

    // ── Privacy footer
    privacyText: {
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 17,
        marginTop: 32,
        paddingHorizontal: 8,
    },
    privacyLink: { fontWeight: '500' },

    pressed: { opacity: 0.7 },
});
