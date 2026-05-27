// Household editor — Phase 6.6.4 sub-route.
//
// Extracted from the legacy "Household" SettingsSection. Hosts the
// household name display (read-only — rename UI doesn't exist yet) and
// the Family type chip picker. Members list is shown for reference but
// editing membership lives elsewhere (the Invite affordance creates new
// members, removal happens via... actually not at all right now —
// preserving the existing read-only display).
//
// Reached from the Household SGroup summary's Name + Family type rows
// on the main Settings page (wired in 6.6.7).

import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { updateHouseholdType, type HouseholdType } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { HOUSEHOLD_TYPE_OPTIONS, labelForHouseholdType } from '@/lib/household-types';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function HouseholdSettingsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading, refetch: refetchHouseholds } =
        useHouseholds();
    const household = households?.[0];
    const householdType: HouseholdType = household?.household_type ?? 'separated';
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    const [editingType, setEditingType] = useState(false);
    const [savingType, setSavingType] = useState(false);
    const [typeError, setTypeError] = useState<string | null>(null);

    const onChangeHouseholdType = async (next: HouseholdType) => {
        if (!household || next === householdType) {
            setEditingType(false);
            return;
        }
        setSavingType(true);
        setTypeError(null);
        try {
            await updateHouseholdType(household.id, next);
            await refetchHouseholds();
            setEditingType(false);
        } catch (err) {
            console.error('updateHouseholdType failed', err);
            setTypeError(errorMessage(err));
        } finally {
            setSavingType(false);
        }
    };

    if (authLoading || householdsLoading || membersLoading || roleLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    const colorMap = memberColorMap(members ?? []);

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
                        Household
                    </ThemedText>
                    <View style={styles.topBarIconBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Name + Family type card */}
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {/* Name row — read-only for now. Tapping does nothing;
                            a rename modal is a future polish item (the original
                            screen never offered one either). */}
                        <View
                            style={[
                                styles.row,
                                { borderBottomColor: colors.hair, borderBottomWidth: StyleSheet.hairlineWidth },
                            ]}>
                            <ThemedText
                                type="smallBold"
                                style={{ flex: 1, color: colors.text }}>
                                Name
                            </ThemedText>
                            <ThemedText
                                style={[styles.rowRight, { color: colors.textSecondary }]}>
                                {household.name}
                            </ThemedText>
                        </View>

                        {/* Family type row + inline picker. Tap "Change" to
                            expand the 3-option picker; tap an option to save. */}
                        {editingType ? (
                            <View style={styles.typeColumn}>
                                <ThemedText themeColor="textSecondary" type="small">
                                    Who&apos;s in this household?
                                </ThemedText>
                                {HOUSEHOLD_TYPE_OPTIONS.map((opt) => {
                                    const selected = householdType === opt.id;
                                    return (
                                        <Pressable
                                            key={opt.id}
                                            onPress={() => onChangeHouseholdType(opt.id)}
                                            disabled={savingType}
                                            style={({ pressed }) => [
                                                styles.typeOption,
                                                {
                                                    borderColor: selected
                                                        ? colors.accent
                                                        : colors.backgroundSelected,
                                                    backgroundColor: selected
                                                        ? `${colors.accent}11`
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText type="smallBold">{opt.label}</ThemedText>
                                            <ThemedText
                                                themeColor="textSecondary"
                                                type="small">
                                                {opt.description}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                                <View style={styles.actionRow}>
                                    <Pressable
                                        onPress={() => setEditingType(false)}
                                        disabled={savingType}
                                        style={({ pressed }) => [
                                            styles.secondaryBtn,
                                            { borderColor: colors.backgroundSelected },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: colors.accent,
                                                fontWeight: '500',
                                            }}>
                                            {savingType ? 'Saving…' : 'Done'}
                                        </ThemedText>
                                    </Pressable>
                                </View>
                                {typeError ? (
                                    <ThemedText
                                        type="small"
                                        style={{ color: BrandColors.error }}>
                                        {typeError}
                                    </ThemedText>
                                ) : null}
                            </View>
                        ) : (
                            <View style={styles.row}>
                                <ThemedText
                                    type="smallBold"
                                    style={{ flex: 1, color: colors.text }}>
                                    Family type
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.rowRight,
                                        { color: colors.textSecondary },
                                    ]}>
                                    {labelForHouseholdType(householdType)}
                                </ThemedText>
                                {!isCaregiver ? (
                                    <Pressable
                                        onPress={() => setEditingType(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Change family type"
                                        style={({ pressed }) => [
                                            styles.changeBtn,
                                            { borderColor: colors.backgroundSelected },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: colors.accent,
                                                fontWeight: '500',
                                            }}>
                                            Change
                                        </ThemedText>
                                    </Pressable>
                                ) : null}
                            </View>
                        )}
                    </View>

                    {/* Members card — read-only list of household members. */}
                    {members && members.length > 0 ? (
                        <View>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                MEMBERS · {members.length}
                            </ThemedText>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {members.map((m, idx) => {
                                    const color = colorForResponsible(m.profile_id, colorMap);
                                    return (
                                        <View
                                            key={m.profile_id}
                                            style={[
                                                styles.memberRow,
                                                idx > 0 && {
                                                    borderTopWidth: StyleSheet.hairlineWidth,
                                                    borderTopColor: colors.hair,
                                                },
                                            ]}>
                                            <View
                                                style={[
                                                    styles.memberDot,
                                                    { backgroundColor: color },
                                                ]}
                                            />
                                            <ThemedText
                                                type="smallBold"
                                                style={{ flex: 1, color: colors.text }}>
                                                {user?.id === m.profile_id
                                                    ? `${m.display_name} (you)`
                                                    : m.display_name}
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    styles.memberRole,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily: FontFamily.monoMedium,
                                                    },
                                                ]}>
                                                {m.role.toUpperCase()}
                                            </ThemedText>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}
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

    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    rowRight: { fontSize: 13, fontWeight: '500' },
    changeBtn: {
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.two,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },

    // Family type inline picker
    typeColumn: {
        gap: Spacing.two,
        padding: Spacing.three,
    },
    typeOption: {
        gap: 2,
        borderWidth: 1,
        borderRadius: Spacing.two,
        padding: Spacing.three,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.two,
    },
    secondaryBtn: {
        paddingVertical: Spacing.one + 2,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },

    // Members
    sectionLabel: {
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.two,
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    memberDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    memberRole: { fontSize: 10, letterSpacing: 0.3 },

    pressed: { opacity: 0.7 },
});
