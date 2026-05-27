// Saved locations — Phase 6.6.2 sub-route.
//
// Extracted from the legacy "Saved locations" SettingsSection in
// (app)/settings.tsx. Same data + same row rendering pattern; only the
// chrome changed: this is a stand-alone screen with a header bar (back
// button + "Locations" title + add button) instead of being a card on
// the Settings page.
//
// Routes: tap a row → /location/[id] (existing edit screen). Tap the
// header + button → /location/new (existing create screen). Both child
// routes already exist and didn't need to change.

import { Feather } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import { useMyRole } from '@/hooks/use-my-role';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function SavedLocationsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const {
        locations,
        isLoading: locationsLoading,
        refetch: refetchLocations,
    } = useLocations(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // Refetch on focus — picks up changes made in /location/new and
    // /location/[id] when the user pops back. Same pattern Settings used.
    useFocusEffect(
        useCallback(() => {
            refetchLocations();
        }, [refetchLocations]),
    );

    if (authLoading || householdsLoading || roleLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers can read locations indirectly (via events that reference
    // them) but Settings hides the management surface from them; preserve
    // that by bouncing the route as well.
    if (isCaregiver) return <Redirect href="/family" />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar: back + title + + button. Sticky-feel hairline
                    border matches the other detail screens (Contact /
                    Event / Custody). */}
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
                        <Feather name="chevron-left" size={14} color={colors.text} />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.topBarTitle,
                            { color: colors.text },
                        ]}>
                        Locations
                    </ThemedText>
                    <Pressable
                        onPress={() => router.push('/location/new')}
                        accessibilityRole="button"
                        accessibilityLabel="Add location"
                        style={({ pressed }) => [
                            styles.topBarIconBtn,
                            {
                                backgroundColor: colors.accent,
                                borderColor: colors.accent,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="plus" size={14} color={colors.onAccent} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {locationsLoading && !locations ? (
                        <View style={styles.empty}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Loading…
                            </ThemedText>
                        </View>
                    ) : !locations || locations.length === 0 ? (
                        // Empty state. Mirrors the design's "no items" copy
                        // pattern from Lists — short, action-oriented.
                        <View style={styles.empty}>
                            <ThemedText
                                themeColor="textSecondary"
                                style={styles.center}>
                                No saved locations yet.
                            </ThemedText>
                            <ThemedText
                                themeColor="textSecondary"
                                type="small"
                                style={styles.center}>
                                Tap + above to add a place you reuse (school, park,
                                grandma's house). Or just start typing a new location
                                inside any event — it'll save here.
                            </ThemedText>
                        </View>
                    ) : (
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            {locations.map((loc, idx) => (
                                <Pressable
                                    key={loc.id}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/location/[id]',
                                            params: { id: loc.id },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit ${loc.name}`}
                                    style={({ pressed }) => [
                                        styles.row,
                                        idx > 0 && {
                                            borderTopWidth: StyleSheet.hairlineWidth,
                                            borderTopColor: colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View style={styles.rowBody}>
                                        <ThemedText
                                            type="smallBold"
                                            numberOfLines={1}
                                            style={{ color: colors.text }}>
                                            {loc.name}
                                        </ThemedText>
                                        {loc.formatted_address ? (
                                            <ThemedText
                                                style={[
                                                    styles.rowSub,
                                                    { color: colors.textSecondary },
                                                ]}
                                                numberOfLines={1}>
                                                {loc.formatted_address}
                                            </ThemedText>
                                        ) : loc.google_maps_url ? (
                                            <ThemedText
                                                style={[
                                                    styles.rowSub,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily: FontFamily.monoMedium,
                                                    },
                                                ]}
                                                numberOfLines={1}>
                                                {loc.google_maps_url}
                                            </ThemedText>
                                        ) : (
                                            <ThemedText
                                                style={[
                                                    styles.rowSub,
                                                    { color: colors.inkFaint },
                                                ]}>
                                                No address
                                            </ThemedText>
                                        )}
                                    </View>
                                    <Feather
                                        name="chevron-right"
                                        size={16}
                                        color={colors.inkFaint}
                                    />
                                </Pressable>
                            ))}
                        </View>
                    )}
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
    topBarTitle: {
        ...Typography.titleSecondary,
        // Override fontSize since the design's sub-screen title is 22 not 26.
        // Typography.titleSecondary is the right place for this in the
        // theme; keeping the override inline rather than adding a new token.
        fontSize: 22,
    },

    scroll: { padding: Spacing.four, gap: Spacing.three },

    empty: {
        padding: Spacing.six,
        alignItems: 'center',
        gap: Spacing.two,
    },
    center: { textAlign: 'center' },

    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    rowBody: { flex: 1, minWidth: 0, gap: 2 },
    rowSub: { fontSize: 12 },

    pressed: { opacity: 0.7 },
});
