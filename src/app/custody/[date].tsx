import { format, parseISO } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { custodianProfileIdOnDate } from '@/lib/custody';
import {
    deleteCustodyOverride,
    getCustodyOverridesForRange,
    upsertCustodyOverride,
    type HouseholdMember,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

function ScreenMessage({
    title,
    body,
    onBack,
}: {
    title: string;
    body: string;
    onBack: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeCenter} edges={['top']}>
                <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                    {title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                    {body}
                </ThemedText>
                <Pressable onPress={onBack} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
                    <ThemedText style={{ color: colors.accent, fontWeight: '600' }}>Go back</ThemedText>
                </Pressable>
            </SafeAreaView>
        </ThemedView>
    );
}

export default function CustodyOverrideScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ date?: string | string[] }>();
    const dateStr = Array.isArray(params.date) ? params.date[0] : params.date;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { schedule, isLoading: scheduleLoading } = useCustodySchedule(household?.id);

    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [originalOverrideExists, setOriginalOverrideExists] = useState(false);
    const [loadingOverride, setLoadingOverride] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pull the existing override (if any) and pre-fill the form with it; otherwise pre-fill with the pattern default.
    useEffect(() => {
        let cancelled = false;
        if (!household || !dateStr || !schedule) {
            setLoadingOverride(false);
            return;
        }
        setLoadingOverride(true);
        setError(null);
        (async () => {
            try {
                const overrides = await getCustodyOverridesForRange(household.id, dateStr, dateStr);
                if (cancelled) return;
                const existing = overrides[0] ?? null;
                if (existing) {
                    setSelectedProfileId(existing.custodian_profile_id);
                    setNote(existing.note ?? '');
                    setOriginalOverrideExists(true);
                } else {
                    const d = parseISO(dateStr);
                    setSelectedProfileId(custodianProfileIdOnDate(schedule, d));
                    setNote('');
                    setOriginalOverrideExists(false);
                }
            } catch (err) {
                if (!cancelled) setError(errorMessage(err));
            } finally {
                if (!cancelled) setLoadingOverride(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [household, dateStr, schedule]);

    const colorMap = useMemo(() => memberColorMap(members), [members]);

    if (authLoading || householdsLoading || membersLoading || scheduleLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (!dateStr) {
        return (
            <ScreenMessage
                title="No date"
                body="This URL is missing a date."
                onBack={() => router.replace('/')}
            />
        );
    }
    if (!schedule) {
        return (
            <ScreenMessage
                title="No custody schedule"
                body="Set up a custody schedule in Settings first, then you can override individual days."
                onBack={() => router.back()}
            />
        );
    }

    const parsedDate = parseISO(dateStr);
    if (Number.isNaN(parsedDate.getTime())) {
        return (
            <ScreenMessage
                title="Invalid date"
                body={`"${dateStr}" isn't a valid date.`}
                onBack={() => router.replace('/')}
            />
        );
    }

    if (loadingOverride) return <LoadingScreen />;

    const patternDefault = custodianProfileIdOnDate(schedule, parsedDate);

    const parentA: HouseholdMember | undefined =
        members?.find((m) => m.profile_id === schedule.parent_a_profile_id);
    const parentB: HouseholdMember | undefined =
        members?.find((m) => m.profile_id === schedule.parent_b_profile_id);
    const parents = [parentA, parentB].filter(
        (m): m is HouseholdMember => !!m,
    );

    const handleSave = async () => {
        if (!selectedProfileId) return;
        setSaving(true);
        setError(null);
        try {
            // If the user selected the pattern default AND the note is empty AND no existing
            // override, treat Save as a no-op (don't clutter the table). Otherwise upsert.
            if (
                selectedProfileId === patternDefault &&
                note.trim().length === 0 &&
                !originalOverrideExists
            ) {
                router.back();
                return;
            }
            await upsertCustodyOverride(household.id, dateStr, selectedProfileId, note);
            router.back();
        } catch (err) {
            console.error('upsertCustodyOverride failed', err);
            setError(errorMessage(err));
            setSaving(false);
        }
    };

    const handleReset = async () => {
        const doReset = async () => {
            setSaving(true);
            setError(null);
            try {
                await deleteCustodyOverride(household.id, dateStr);
                router.back();
            } catch (err) {
                console.error('deleteCustodyOverride failed', err);
                setError(errorMessage(err));
                setSaving(false);
            }
        };
        if (Platform.OS === 'web') {
            const ok =
                typeof window !== 'undefined' && window.confirm('Reset this day to the pattern default?');
            if (ok) await doReset();
        } else {
            Alert.alert(
                'Reset to pattern?',
                'This day will follow the regular schedule pattern again.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: doReset },
                ],
            );
        }
    };

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        minHeight: 44,
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.headerBar}>
                    <Pressable
                        onPress={() => router.back()}
                        disabled={saving}
                        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold">Custody</ThemedText>
                    <Pressable
                        onPress={handleSave}
                        disabled={saving || !selectedProfileId}
                        style={({ pressed }) => [styles.headerBtn, pressed && !saving && styles.pressed]}>
                        <ThemedText
                            style={{
                                color: !selectedProfileId ? colors.textSecondary : colors.accent,
                                fontWeight: '600',
                            }}>
                            {saving ? 'Saving…' : 'Save'}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={[styles.dayCard, { backgroundColor: colors.backgroundElement }]}>
                        <ThemedText type="subtitle">
                            {format(parsedDate, 'EEEE')}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary">
                            {format(parsedDate, 'MMMM d, yyyy')}
                        </ThemedText>
                        {originalOverrideExists ? (
                            <ThemedText type="small" style={{ color: colors.accent }}>
                                ↻ This day is currently overridden.
                            </ThemedText>
                        ) : null}
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Custodian</ThemedText>
                        <View style={styles.chipRow}>
                            {parents.map((m) => {
                                const selected = selectedProfileId === m.profile_id;
                                const c = colorForResponsible(m.profile_id, colorMap);
                                const isDefault = patternDefault === m.profile_id;
                                return (
                                    <Pressable
                                        key={m.profile_id}
                                        onPress={() => setSelectedProfileId(m.profile_id)}
                                        disabled={saving}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                borderColor: c,
                                                backgroundColor: selected ? c : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <View style={[styles.chipDot, { backgroundColor: c }]} />
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: selected ? '#fff' : colors.text,
                                                fontWeight: '500',
                                            }}>
                                            {m.display_name}
                                            {isDefault ? ' · default' : ''}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Note (optional)</ThemedText>
                        <TextInput
                            value={note}
                            onChangeText={setNote}
                            placeholder="Why this change? e.g. travel, swap, vacation"
                            placeholderTextColor={colors.textSecondary}
                            style={[
                                inputStyle,
                                { textAlignVertical: 'top', minHeight: 80, paddingTop: Spacing.two },
                            ]}
                            multiline
                            editable={!saving}
                        />
                    </View>

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {originalOverrideExists ? (
                        <Pressable
                            onPress={handleReset}
                            disabled={saving}
                            style={({ pressed }) => [
                                styles.resetBtn,
                                pressed && !saving && styles.pressed,
                            ]}>
                            <ThemedText style={styles.resetText}>Reset to pattern</ThemedText>
                        </Pressable>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    safeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    headerBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
    scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
    dayCard: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
    field: { gap: Spacing.two },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    errorText: { color: BrandColors.error },
    resetBtn: {
        marginTop: Spacing.three,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: '#F5DBD4',
        alignItems: 'center',
    },
    resetText: { color: BrandColors.error, fontWeight: '600' },
    linkBtn: { padding: Spacing.two },
    pressed: { opacity: 0.7 },
});
