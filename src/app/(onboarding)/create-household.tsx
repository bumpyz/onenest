import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { createHousehold, type HouseholdType } from '@/lib/db';
import { HOUSEHOLD_TYPE_OPTIONS } from '@/lib/household-types';
import { useAppColorScheme } from '@/providers/theme-provider';

type ChildDraft = {
    key: string;
    name: string;
};

let childKeyCounter = 0;
const nextChildKey = () => `child-${childKeyCounter++}`;

export default function CreateHouseholdScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [householdName, setHouseholdName] = useState('');
    const [householdType, setHouseholdType] = useState<HouseholdType | null>(null);
    const [children, setChildren] = useState<ChildDraft[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const addChild = () =>
        setChildren((prev) => [...prev, { key: nextChildKey(), name: '' }]);
    const updateChild = (key: string, name: string) =>
        setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, name } : c)));
    const removeChild = (key: string) =>
        setChildren((prev) => prev.filter((c) => c.key !== key));

    const canSubmit = householdName.trim().length > 0 && householdType !== null && !submitting;

    const onSubmit = async () => {
        if (!canSubmit || !householdType) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const validChildren = children
                .filter((c) => c.name.trim().length > 0)
                .map((c) => ({ displayName: c.name.trim() }));
            await createHousehold(householdName.trim(), householdType, validChildren);
            // (app)/_layout will refetch households on remount and render the tabs.
            router.replace('/');
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                setSubmitError(message);
            } else {
                Alert.alert("Couldn't create household", message);
            }
            setSubmitting(false);
        }
    };

    const inputStyle = [
        styles.input,
        { color: colors.text, borderColor: colors.backgroundSelected },
    ];

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    <View style={styles.header}>
                        <ThemedText type="title">Welcome to OneNest</ThemedText>
                        <ThemedText themeColor="textSecondary">
                            Let&apos;s set up your household.
                        </ThemedText>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Who's in this household?</ThemedText>
                        <View style={styles.typeColumn}>
                            {HOUSEHOLD_TYPE_OPTIONS.map((opt) => {
                                const selected = householdType === opt.id;
                                return (
                                    <Pressable
                                        key={opt.id}
                                        onPress={() => setHouseholdType(opt.id)}
                                        disabled={submitting}
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
                                        <ThemedText themeColor="textSecondary" type="small">
                                            {opt.description}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Household name</ThemedText>
                        <TextInput
                            value={householdName}
                            onChangeText={setHouseholdName}
                            placeholder="e.g. The Smiths"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoCapitalize="words"
                            autoComplete="off"
                            returnKeyType="next"
                            editable={!submitting}
                        />
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <ThemedText type="smallBold">Children (optional)</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                You can add them later from Settings.
                            </ThemedText>
                        </View>

                        {children.map((child) => (
                            <View key={child.key} style={styles.childRow}>
                                <TextInput
                                    value={child.name}
                                    onChangeText={(t) => updateChild(child.key, t)}
                                    placeholder="Child's name"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[inputStyle, styles.childInput]}
                                    autoCapitalize="words"
                                    autoComplete="off"
                                    editable={!submitting}
                                />
                                <Pressable
                                    onPress={() => removeChild(child.key)}
                                    disabled={submitting}
                                    style={({ pressed }) => [
                                        styles.removeButton,
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText themeColor="textSecondary">Remove</ThemedText>
                                </Pressable>
                            </View>
                        ))}

                        <Pressable
                            onPress={addChild}
                            disabled={submitting}
                            style={({ pressed }) => [
                                styles.addChildButton,
                                { borderColor: colors.backgroundSelected },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText themeColor="textSecondary">+ Add a child</ThemedText>
                        </Pressable>
                    </View>

                    {submitError ? (
                        <ThemedText themeColor="textSecondary" type="small" style={styles.errorText}>
                            {submitError}
                        </ThemedText>
                    ) : null}
                </ScrollView>

                <Pressable
                    onPress={onSubmit}
                    disabled={!canSubmit}
                    style={({ pressed }) => [
                        styles.submit,
                        {
                            backgroundColor: canSubmit ? colors.accent : colors.backgroundSelected,
                        },
                        pressed && canSubmit && styles.pressed,
                    ]}>
                    <ThemedText
                        style={[
                            styles.submitText,
                            !canSubmit && { color: colors.textSecondary },
                        ]}>
                        {submitting ? 'Creating…' : 'Continue'}
                    </ThemedText>
                </Pressable>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1, padding: Spacing.four },
    scroll: { gap: Spacing.four, paddingBottom: Spacing.four },
    header: { gap: Spacing.two, marginTop: Spacing.three },
    field: { gap: Spacing.two },
    section: { gap: Spacing.three },
    sectionHeader: { gap: Spacing.half },
    input: {
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
    },
    typeColumn: { gap: Spacing.two },
    typeOption: {
        gap: 2,
        borderWidth: 1,
        borderRadius: Spacing.two,
        padding: Spacing.three,
    },
    childRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
    childInput: { flex: 1 },
    removeButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
    addChildButton: {
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    errorText: { color: BrandColors.error },
    submit: {
        height: 48,
        borderRadius: Spacing.three,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: { color: '#fff', fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
