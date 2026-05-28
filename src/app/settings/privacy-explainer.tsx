// /settings/privacy-explainer — read-only privacy model explainer (#390).
//
// Destination for the "LEARN MORE →" chip on /settings/members. Walks
// through the four visibility tiers in the OneNest privacy model so
// users understand who sees what BEFORE they invite a co-parent or
// caregiver. The wording mirrors the help card on /settings/members
// but expands each line with context + an example.
//
// This is a help/docs page — no interactive surfaces, no edit
// affordances. Designed as a static read so adding a new viewer tier
// (external co-parent landed in #398) requires touching exactly one
// place. When real legal pages ship (#388), the bottom of this page
// should link to the full Privacy Policy.

import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Tier = {
    role: string;
    headline: string;
    sees: string[];
    privacy: string[];
};

const TIERS: Tier[] = [
    {
        role: 'CO-PARENT',
        headline: 'Full household visibility.',
        sees: [
            'Every event, task, list, and contact in the household.',
            'Every kid in the household and their schools, allergies, etc.',
            'The custody schedule and any one-off overrides.',
            "Other co-parents' busy blocks (just the time slot — not the event details — from their paired external calendar).",
        ],
        privacy: [
            "Cannot see the contents of co-parents' personal external calendar events (only busy / free).",
            'Cannot see kids who live in other households outside this one.',
        ],
    },
    {
        role: 'CAREGIVER',
        headline: 'Only what they need to do the job.',
        sees: [
            'Tasks assigned to them.',
            'Events they were tagged on as a helper.',
            "Hand-off brief items for the days they're on duty.",
            'The current custody schedule (read-only).',
        ],
        privacy: [
            'Cannot see tasks or events they were not assigned to.',
            "Cannot see other adults' personal calendar contents or busy blocks.",
            "Cannot manage members, custody patterns, or kids' profile details.",
        ],
    },
    {
        role: 'EXTERNAL CO-PARENT',
        headline: 'Just the kids you share with them.',
        sees: [
            "The custody schedule, but only for the kid(s) you've linked them to.",
            'Hand-offs involving their linked kid(s).',
            "Their own paired calendar's busy blocks against the kid's schedule (for conflict awareness).",
        ],
        privacy: [
            'Cannot see your other kids who live in this household.',
            'Cannot see events, tasks, or contacts that do not involve their linked kid(s).',
            "Cannot see the household's swap-request thread or pending swaps.",
            "Cannot change the household's custody pattern or add overrides.",
        ],
    },
];

export default function PrivacyExplainerScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const { session, isLoading: authLoading } = useAuth();

    if (authLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar — back + title. No right-side affordance:
                    this is a docs page, nothing to add or save. */}
                <View
                    style={[
                        styles.topBar,
                        { borderBottomColor: colors.hair },
                    ]}>
                    <Pressable
                        onPress={() => router.back()}
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
                        <Feather
                            name="chevron-left"
                            size={14}
                            color={colors.text}
                        />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.topBarTitle,
                            { color: colors.text },
                        ]}>
                        Privacy
                    </ThemedText>
                    <View style={styles.topBarIconBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    <ThemedText
                        type="title"
                        style={{ color: colors.text, marginBottom: 4 }}>
                        Who sees what
                    </ThemedText>
                    <ThemedText
                        type="small"
                        style={{
                            color: colors.textSecondary,
                            lineHeight: 19,
                            marginBottom: Spacing.four,
                        }}>
                        OneNest gives different people in your household
                        different levels of visibility. Here's the
                        breakdown so you can invite confidently.
                    </ThemedText>

                    {TIERS.map((t, idx) => (
                        <View
                            key={t.role}
                            style={[
                                styles.tierCard,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                    marginTop: idx === 0 ? 0 : 14,
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.tierRole,
                                    {
                                        color: colors.inkSec,
                                        fontFamily:
                                            FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {t.role}
                            </ThemedText>
                            <ThemedText
                                type="smallBold"
                                style={{
                                    color: colors.text,
                                    marginTop: 2,
                                    marginBottom: 10,
                                }}>
                                {t.headline}
                            </ThemedText>

                            <ThemedText
                                style={[
                                    styles.sectionHead,
                                    {
                                        color: colors.inkSec,
                                        fontFamily:
                                            FontFamily.monoSemiBold,
                                    },
                                ]}>
                                SEES
                            </ThemedText>
                            {t.sees.map((line) => (
                                <ThemedText
                                    key={line}
                                    type="small"
                                    style={[
                                        styles.bullet,
                                        { color: colors.text },
                                    ]}>
                                    {`•  ${line}`}
                                </ThemedText>
                            ))}

                            <ThemedText
                                style={[
                                    styles.sectionHead,
                                    {
                                        color: colors.inkSec,
                                        fontFamily:
                                            FontFamily.monoSemiBold,
                                        marginTop: 10,
                                    },
                                ]}>
                                CANNOT SEE
                            </ThemedText>
                            {t.privacy.map((line) => (
                                <ThemedText
                                    key={line}
                                    type="small"
                                    style={[
                                        styles.bullet,
                                        { color: colors.textSecondary },
                                    ]}>
                                    {`•  ${line}`}
                                </ThemedText>
                            ))}
                        </View>
                    ))}

                    {/* Paired-calendar callout — overlaps every tier
                        but deserves a beat of its own since the
                        privacy model around external calendars is the
                        most surprising piece for new users. */}
                    <View
                        style={[
                            styles.tierCard,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                                marginTop: 14,
                            },
                        ]}>
                        <ThemedText
                            style={[
                                styles.tierRole,
                                {
                                    color: colors.inkSec,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            PAIRED EXTERNAL CALENDARS
                        </ThemedText>
                        <ThemedText
                            type="smallBold"
                            style={{
                                color: colors.text,
                                marginTop: 2,
                                marginBottom: 10,
                            }}>
                            Your Google / Microsoft calendar stays
                            private.
                        </ThemedText>
                        <ThemedText
                            type="small"
                            style={{
                                color: colors.textSecondary,
                                lineHeight: 19,
                            }}>
                            When you pair an external calendar in
                            Settings, OneNest reads it on your device so
                            it can warn you about conflicts with
                            household events. Other adults in your
                            household see your busy time slots only —
                            never event titles, locations, notes, or
                            attendees. They cannot open the events. We
                            don't store the event contents on our
                            servers.
                        </ThemedText>
                    </View>

                    {/* Footer hint — once the legal pages ship (#388),
                        wire this to the Privacy Policy. */}
                    <ThemedText
                        style={[
                            styles.footer,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        FULL PRIVACY POLICY COMING SOON
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    pressed: { opacity: 0.7 },

    scroll: {
        padding: Spacing.three,
        paddingBottom: Spacing.four,
    },

    tierCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: Spacing.three,
    },
    tierRole: {
        fontSize: 10,
        letterSpacing: 0.4,
    },
    sectionHead: {
        fontSize: 9.5,
        letterSpacing: 0.4,
        marginBottom: 4,
    },
    bullet: {
        lineHeight: 19,
        marginBottom: 2,
    },

    footer: {
        marginTop: 24,
        fontSize: 10,
        letterSpacing: 0.3,
        textAlign: 'center',
    },
});
