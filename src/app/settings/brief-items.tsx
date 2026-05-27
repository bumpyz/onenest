// /settings/brief-items — caregiver hand-off brief editor (Phase G, #489).
//
// The parents in a separated household tell the app what they want the
// caregiver to hand back at the end of their shift (medication notes,
// pickup time changes, school notes, etc.). The list lives on
// `households.default_brief_items` (migration 0050). On every hand-off
// day the strip auto-generates one caregiver_brief task per item from
// this list, assigned to the on-duty caregiver, due at the handoff
// time. The caregiver checks them off as they hand the kids back; the
// strip's countdown chip flips alert-tinted while any remain open
// within ~2h of the handoff.
//
// Editor scope (this screen):
//   • List existing brief items
//   • Add a new item (single-line text)
//   • Remove an item
//   • Reorder is deferred (the order on the strip is by creation;
//     reordering would be a follow-up if users ask)
//
// Caregivers can't edit this list (it's the parents' definition of
// what they want communicated). Caregivers see a read-only version on
// their own brief view once Phase G follow-up lands. For now, the
// route bounces caregivers to /family.

import { Feather } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
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
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import {
    getHouseholdBriefItems,
    updateHouseholdBriefItems,
    type BriefItem,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function BriefItemsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    const [items, setItems] = useState<BriefItem[]>([]);
    const [draft, setDraft] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch on mount + refetch on focus (matches /settings/locations
    // pattern so toggling back from any push reflects edits made
    // elsewhere — currently only this screen writes the list, but the
    // pattern stays consistent).
    const fetchItems = useCallback(async () => {
        if (!household?.id) return;
        try {
            const rows = await getHouseholdBriefItems(household.id);
            setItems(rows);
            setLoaded(true);
        } catch (err) {
            setError(errorMessage(err));
            setLoaded(true);
        }
    }, [household?.id]);
    useEffect(() => {
        void fetchItems();
    }, [fetchItems]);
    useFocusEffect(
        useCallback(() => {
            void fetchItems();
        }, [fetchItems]),
    );

    if (
        authLoading ||
        householdsLoading ||
        roleLoading ||
        (household && !loaded)
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (isCaregiver) return <Redirect href="/family" />;

    const persist = async (next: BriefItem[]) => {
        if (!household?.id) return;
        setSaving(true);
        setError(null);
        try {
            await updateHouseholdBriefItems(household.id, next);
            setItems(next);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const onAdd = async () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        // Cap at 12 items so the auto-generator doesn't overwhelm the
        // caregiver's Today list with 30+ rows on a single hand-off
        // day. Soft cap — alert + reject when exceeded rather than
        // throw a generic error.
        if (items.length >= 12) {
            Alert.alert(
                'Limit reached',
                'You can keep up to 12 brief items. Remove one to add a new entry.',
            );
            return;
        }
        // Dedupe — the unique partial index in 0051 keys on
        // (household, due_at, title), so duplicate titles would race
        // and one would silently lose. Reject up-front so the user
        // sees the dedupe rather than wondering why their second
        // "Medication reminder" never generated a task.
        if (items.some((it) => it.label === trimmed)) {
            Alert.alert(
                'Already in the list',
                'That brief item already exists.',
            );
            return;
        }
        const next = [...items, { label: trimmed }];
        setDraft('');
        await persist(next);
    };

    const onRemove = (idx: number) => {
        Alert.alert(
            'Remove brief item?',
            `Caregivers won't see "${items[idx]?.label}" on future hand-offs. Existing brief tasks already generated stay until they're completed.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        const next = items.filter((_, i) => i !== idx);
                        void persist(next);
                    },
                },
            ],
        );
    };

    return (
        <ThemedView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <SafeAreaView style={styles.safe} edges={['top']}>
                    {/* Top bar — back + title. No "+" button; the editor
                        below has its own inline add row. */}
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
                                    backgroundColor:
                                        colors.backgroundElement,
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
                            Hand-off brief
                        </ThemedText>
                        <View style={styles.topBarIconBtn} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scroll}>
                        <ThemedText
                            style={[
                                styles.intro,
                                { color: colors.inkSec },
                            ]}>
                            Items the caregiver hands back at each
                            hand-off. Each item becomes a checkable
                            task on hand-off days.
                        </ThemedText>

                        {/* List of existing items */}
                        {items.length === 0 ? (
                            <View
                                style={[
                                    styles.empty,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small">
                                    No brief items yet.
                                </ThemedText>
                            </View>
                        ) : (
                            <View
                                style={[
                                    styles.itemsCard,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {items.map((it, idx) => (
                                    <View
                                        key={`${it.label}-${idx}`}
                                        style={[
                                            styles.itemRow,
                                            idx > 0 && {
                                                borderTopColor:
                                                    colors.hair,
                                                borderTopWidth:
                                                    StyleSheet.hairlineWidth,
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.itemLabel,
                                                { color: colors.text },
                                            ]}>
                                            {it.label}
                                        </ThemedText>
                                        <Pressable
                                            onPress={() => onRemove(idx)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Remove ${it.label}`}
                                            disabled={saving}
                                            style={({ pressed }) => [
                                                styles.removeBtn,
                                                pressed &&
                                                    !saving &&
                                                    styles.pressed,
                                            ]}>
                                            <Feather
                                                name="x"
                                                size={14}
                                                color={colors.inkFaint}
                                            />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Inline add row — single-line text + button.
                            Stays at the bottom so adding doesn't make
                            the list jump around. */}
                        <View style={styles.addRow}>
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                placeholder="Add a brief item…"
                                placeholderTextColor={colors.inkFaint}
                                onSubmitEditing={onAdd}
                                returnKeyType="done"
                                editable={!saving}
                                style={[
                                    styles.addInput,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                        color: colors.text,
                                    },
                                ]}
                            />
                            <Pressable
                                onPress={onAdd}
                                disabled={
                                    saving || draft.trim().length === 0
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Add brief item"
                                style={({ pressed }) => [
                                    styles.addBtn,
                                    {
                                        backgroundColor: colors.accent,
                                    },
                                    (saving ||
                                        draft.trim().length === 0) && {
                                        opacity: 0.4,
                                    },
                                    pressed && !saving && styles.pressed,
                                ]}>
                                <Feather
                                    name="plus"
                                    size={14}
                                    color={colors.onAccent}
                                />
                            </Pressable>
                        </View>

                        {error ? (
                            <ThemedText
                                style={[
                                    styles.error,
                                    { color: colors.warn },
                                ]}>
                                {error}
                            </ThemedText>
                        ) : null}

                        <ThemedText
                            style={[
                                styles.footer,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            BRIEF TASKS AUTO-GENERATE ON HAND-OFF DAYS
                        </ThemedText>
                    </ScrollView>
                </SafeAreaView>
            </KeyboardAvoidingView>
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
    intro: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 14,
    },

    empty: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        padding: Spacing.three,
        alignItems: 'center',
    },

    itemsCard: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    itemLabel: {
        flex: 1,
        fontSize: 14,
        letterSpacing: -0.1,
    },
    removeBtn: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },

    addRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addInput: {
        flex: 1,
        height: 40,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    error: {
        marginTop: 10,
        fontSize: 12,
    },

    footer: {
        marginTop: 24,
        fontSize: 10,
        letterSpacing: 0.3,
        textAlign: 'center',
    },
});
