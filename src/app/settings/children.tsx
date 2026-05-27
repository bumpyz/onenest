// Children list — Phase 6.6.5 sub-route.
//
// Extracted from the legacy "Children" SettingsSection. Same data + same
// row rendering pattern; only the chrome moved. Add/edit lands at the
// existing /child/new + /child/[id] routes — neither needed to change.

import { format, parseISO } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function ChildrenSettingsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const {
        children,
        isLoading: childrenLoading,
        refetch: refetchChildren,
    } = useChildren(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    useFocusEffect(
        useCallback(() => {
            refetchChildren();
        }, [refetchChildren]),
    );

    if (authLoading || householdsLoading || roleLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers don't manage the children roster (the original Settings
    // hid the section behind a role gate). Bounce them back to the hub.
    if (isCaregiver) return <Redirect href="/family" />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View
                    style={[styles.topBar, { borderBottomColor: colors.hair }]}>
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
                    <ThemedText style={[styles.topBarTitle, { color: colors.text }]}>
                        Children
                    </ThemedText>
                    <Pressable
                        onPress={() => router.push('/child/new')}
                        accessibilityRole="button"
                        accessibilityLabel="Add child"
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
                    {childrenLoading && !children ? (
                        <View style={styles.empty}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Loading…
                            </ThemedText>
                        </View>
                    ) : !children || children.length === 0 ? (
                        <View style={styles.empty}>
                            <ThemedText
                                themeColor="textSecondary"
                                style={styles.center}>
                                No children added yet.
                            </ThemedText>
                            <ThemedText
                                themeColor="textSecondary"
                                type="small"
                                style={styles.center}>
                                Tap + above to add a kid. Used to tag events and filter
                                the calendar by child.
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
                            {children.map((c, idx) => (
                                <Pressable
                                    key={c.id}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/child/[id]',
                                            params: { id: c.id },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit ${c.display_name}`}
                                    style={({ pressed }) => [
                                        styles.row,
                                        idx > 0 && {
                                            borderTopWidth: StyleSheet.hairlineWidth,
                                            borderTopColor: colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ChildBadge
                                        name={c.display_name}
                                        color={c.color}
                                        size="lg"
                                    />
                                    <View style={styles.rowBody}>
                                        <ThemedText
                                            type="smallBold"
                                            numberOfLines={1}
                                            style={{ color: colors.text }}>
                                            {c.display_name}
                                        </ThemedText>
                                        {c.birthdate ? (
                                            <ThemedText
                                                themeColor="textSecondary"
                                                type="small">
                                                {/* parseISO (not new Date) so a date-only
                                                    string like "2014-01-11" is treated as
                                                    local midnight, not UTC — preserves the
                                                    pre-Phase-7 fix. */}
                                                Born{' '}
                                                {format(
                                                    parseISO(c.birthdate),
                                                    'MMM d, yyyy',
                                                )}
                                            </ThemedText>
                                        ) : null}
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
    topBarTitle: { ...Typography.titleSecondary, fontSize: 22 },

    scroll: { padding: Spacing.four, gap: Spacing.three },

    empty: { padding: Spacing.six, alignItems: 'center', gap: Spacing.two },
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

    pressed: { opacity: 0.7 },
});
