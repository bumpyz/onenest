// Create household — first-run onboarding (Phase 9 redesign, #296).
//
// Design source: docs/design-handoffs/onenest-spec-v3/
//   design_handoff_calendar_conflicts/screens-extra.jsx::Onboarding
//   (line 660) + FamilyOption (line 824).
//
// Layout, top to bottom:
//   1. Top stepper row — back-button slot (empty for now, no prior screen),
//      pill stepper (single active dot for now), "STEP 1" mono caps right
//      label. Future multi-step onboarding lights up additional dots.
//   2. Hero — 56px accent-tinted house-icon tile, 30/600 title
//      "Let's set up your household.", body-copy sub.
//   3. "WHAT SHOULD WE CALL IT?" mono caps label + accent-bordered name
//      input with focus glow.
//   4. "FAMILY TYPE" mono caps label + three FamilyOption cards (icon
//      tile + title + sub + radio bullet, accent-tinted selected state).
//   5. Helper tip — info circle + "You can invite a co-parent on the
//      next step…"
//   6. Sticky bottom CTA — "Skip" (text) + "Continue →" (accent pill,
//      flex-grows; disabled until name + type are both set).
//
// Children are NOT added inline on this screen — the previous version
// had an "add a child" sub-list that didn't match the design's single-
// focus step pattern. Kids land via Family Hub → Add child after the
// household exists. createHousehold(name, type, []) reflects that.

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { createHousehold, type HouseholdType } from '@/lib/db';
import { HOUSEHOLD_TYPE_OPTIONS } from '@/lib/household-types';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

const NAME_MAX_LENGTH = 60;

export default function CreateHouseholdScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [householdName, setHouseholdName] = useState('');
    const [householdType, setHouseholdType] = useState<HouseholdType | null>(null);
    const [nameFocused, setNameFocused] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const trimmedName = householdName.trim();
    const canSubmit =
        trimmedName.length > 0 && householdType !== null && !submitting;

    const onSubmit = async () => {
        if (!canSubmit || !householdType) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await createHousehold(trimmedName, householdType, []);
            // (app)/_layout will refetch households on remount and render
            // the tabs.
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

    return (
        <ThemedView style={styles.container}>
            {/* iOS soft keyboard otherwise covers the type-picker rows when
                the name input is focused. Android uses windowSoftInputMode
                (Expo default); web ignores the wrap. Same pattern used on
                event-form / child-form (audit #330 CRITICAL #2). */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <SafeAreaView style={styles.safe} edges={['top']}>
                    {/* Stepper row — left/right slots match the spec's 3-
                        column layout. Future multi-step onboarding flips
                        the back-button slot to a real button and lights
                        up further dots. */}
                    <View style={styles.topRow}>
                        <View style={styles.topSlot} />
                        <View style={styles.stepperDots}>
                            <View
                                style={[
                                    styles.stepperDotActive,
                                    { backgroundColor: colors.accent },
                                ]}
                            />
                        </View>
                        <ThemedText
                            style={[
                                styles.stepCounter,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            STEP 1
                        </ThemedText>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}>
                        {/* Hero */}
                        <View style={styles.hero}>
                            <View
                                style={[
                                    styles.heroTile,
                                    {
                                        backgroundColor: withAlpha(colors.accent, 0x22 / 0xff),
                                    },
                                ]}>
                                {/* Feather "home" stands in for the design's
                                    custom stroke house path — react-native-svg
                                    isn't a dep (see priority-flag.tsx). */}
                                <Feather name="home" size={28} color={colors.accent} />
                            </View>
                            <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
                                Let&apos;s set up your{'\n'}household.
                            </ThemedText>
                            <ThemedText
                                style={[
                                    styles.heroSub,
                                    { color: colors.textSecondary },
                                ]}>
                                A few details so events, custody, and tasks know who
                                they belong to.
                            </ThemedText>
                        </View>

                        {/* Name field — accent-bordered, focus glow */}
                        <View style={styles.nameSection}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                WHAT SHOULD WE CALL IT?
                            </ThemedText>
                            <View
                                style={[
                                    styles.nameWrap,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.accent,
                                        // Soft accent glow when focused — mirrors
                                        // the spec's box-shadow halo. RN doesn't
                                        // expose multi-stop shadows on Android, so
                                        // we approximate with a ring (Web + iOS
                                        // get the real shadow via the View prop).
                                        shadowColor: colors.accent,
                                        shadowOpacity: nameFocused ? 0.22 : 0,
                                        shadowRadius: nameFocused ? 8 : 0,
                                        shadowOffset: { width: 0, height: 0 },
                                    },
                                ]}>
                                <TextInput
                                    value={householdName}
                                    onChangeText={(t) => {
                                        setHouseholdName(t);
                                        if (submitError) setSubmitError(null);
                                    }}
                                    onFocus={() => setNameFocused(true)}
                                    onBlur={() => setNameFocused(false)}
                                    placeholder="The Chen-Park family"
                                    placeholderTextColor={colors.inkFaint}
                                    autoCapitalize="words"
                                    autoComplete="off"
                                    autoCorrect={false}
                                    autoFocus
                                    maxLength={NAME_MAX_LENGTH + 8}
                                    editable={!submitting}
                                    returnKeyType="next"
                                    style={[
                                        styles.nameInput,
                                        {
                                            color: colors.text,
                                        },
                                        // RN-Web strips the default browser focus
                                        // outline so the field reads as part of
                                        // the bordered shell.
                                        Platform.OS === 'web'
                                            ? ({ outlineStyle: 'none' } as object)
                                            : null,
                                    ]}
                                />
                            </View>
                            <ThemedText
                                style={[
                                    styles.nameHelper,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                You can change this anytime in Settings.
                            </ThemedText>
                        </View>

                        {/* Type picker */}
                        <View style={styles.typeSection}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                FAMILY TYPE
                            </ThemedText>
                            {HOUSEHOLD_TYPE_OPTIONS.map((opt) => {
                                const selected = householdType === opt.id;
                                return (
                                    <FamilyOption
                                        key={opt.id}
                                        iconKind={opt.iconKind}
                                        title={opt.label}
                                        sub={opt.description}
                                        selected={selected}
                                        disabled={submitting}
                                        onPress={() => setHouseholdType(opt.id)}
                                        colors={colors}
                                    />
                                );
                            })}
                        </View>

                        {/* Helper tip */}
                        <View style={styles.helperRow}>
                            <Feather
                                name="info"
                                size={13}
                                color={colors.inkFaint}
                                style={styles.helperIcon}
                            />
                            <ThemedText
                                style={[styles.helperText, { color: colors.inkFaint }]}>
                                You can invite a co-parent on the next step. They&apos;ll
                                get a private email link.
                            </ThemedText>
                        </View>

                        {submitError ? (
                            <ThemedText
                                style={[styles.errorText, { color: BrandColors.error }]}>
                                {submitError}
                            </ThemedText>
                        ) : null}
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
                        {/* Skip — text-only, returns user to "home" which
                            will bounce back here since they don't have a
                            household yet. Effectively a no-op today but
                            preserved as an affordance per the design;
                            future onboarding may let users dismiss and
                            land on a read-only "join existing household"
                            CTA. */}
                        <Pressable
                            onPress={() => router.replace('/')}
                            disabled={submitting}
                            accessibilityRole="button"
                            accessibilityLabel="Skip"
                            style={({ pressed }) => [
                                styles.skipBtn,
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.skipBtnText,
                                    { color: colors.textSecondary },
                                ]}>
                                Skip
                            </ThemedText>
                        </Pressable>
                        <Pressable
                            onPress={onSubmit}
                            disabled={!canSubmit}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            style={({ pressed }) => [
                                styles.continueBtn,
                                {
                                    backgroundColor: canSubmit
                                        ? colors.accent
                                        : colors.backgroundSelected,
                                },
                                pressed && canSubmit && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.continueBtnText,
                                    {
                                        color: canSubmit
                                            ? colors.onAccent
                                            : colors.textSecondary,
                                    },
                                ]}>
                                {submitting ? 'Creating…' : 'Continue'}
                            </ThemedText>
                            {canSubmit && !submitting ? (
                                <Feather
                                    name="arrow-right"
                                    size={14}
                                    color={colors.onAccent}
                                />
                            ) : null}
                        </Pressable>
                    </View>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

// ─── FamilyOption ──────────────────────────────────────────────────────────
//
// Icon-tile + title/sub + radio bullet card. Selected state tints the
// background with accent@15 + bumps the border to 1.5 + accent fill on
// the bullet. Lives inline because no other screen needs this shape.
function FamilyOption({
    iconKind,
    title,
    sub,
    selected,
    disabled,
    onPress,
    colors,
}: {
    iconKind: 'single' | 'couple' | 'separated';
    title: string;
    sub: string;
    selected: boolean;
    disabled?: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    const iconColor = selected ? colors.accent : colors.inkSec;
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            accessibilityLabel={title}
            style={({ pressed }) => [
                styles.familyOption,
                {
                    backgroundColor: selected
                        ? withAlpha(colors.accent, 0x15 / 0xff)
                        : colors.backgroundElement,
                    borderColor: selected ? colors.accent : colors.hair,
                    borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                },
                pressed && !disabled && styles.pressed,
                disabled && { opacity: 0.6 },
            ]}>
            <View
                style={[
                    styles.familyOptionIconTile,
                    {
                        backgroundColor: selected
                            ? withAlpha(colors.accent, 0x22 / 0xff)
                            : colors.backgroundInset,
                    },
                ]}>
                <FamilyOptionIcon kind={iconKind} color={iconColor} />
            </View>
            <View style={styles.familyOptionCopy}>
                <ThemedText
                    style={[styles.familyOptionTitle, { color: colors.text }]}>
                    {title}
                </ThemedText>
                <ThemedText
                    style={[styles.familyOptionSub, { color: colors.inkFaint }]}>
                    {sub}
                </ThemedText>
            </View>
            <View
                style={[
                    styles.familyOptionRadio,
                    {
                        borderColor: selected ? colors.accent : colors.inkFaint,
                        backgroundColor: selected ? colors.accent : 'transparent',
                    },
                ]}>
                {selected ? (
                    <Feather name="check" size={11} color={colors.onAccent} />
                ) : null}
            </View>
        </Pressable>
    );
}

// Icon glyphs for the three family-type options — using Feather rather
// than the design's hand-traced stroke paths because react-native-svg
// isn't a dep (see priority-flag.tsx comment). The mapping keeps the
// distinct silhouette per option:
//   separated → "users" (two figures, side by side)
//   couple    → "home" (single house with people implied inside)
//   single    → "user" (one figure)
function FamilyOptionIcon({
    kind,
    color,
}: {
    kind: 'single' | 'couple' | 'separated';
    color: string;
}) {
    const name =
        kind === 'separated' ? 'users' : kind === 'couple' ? 'home' : 'user';
    return <Feather name={name} size={20} color={color} />;
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },

    // ── Top bar / stepper
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 18,
    },
    topSlot: { width: 32, height: 32 },
    stepperDots: {
        flexDirection: 'row',
        gap: 4,
    },
    // Single dot for now — design canvas uses a row of 5 dots with the
    // active one widened to 22px. When we add more steps, replicate the
    // multi-dot map here and grow the active dot.
    stepperDotActive: { width: 22, height: 6, borderRadius: 3 },
    stepCounter: { fontSize: 10, letterSpacing: -0.2 },

    scroll: { paddingBottom: 130 },

    // ── Hero
    hero: {
        paddingHorizontal: 28,
        paddingTop: 14,
        paddingBottom: 24,
    },
    heroTile: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    heroTitle: {
        fontSize: 30,
        fontWeight: '600',
        letterSpacing: -1.1,
        lineHeight: 33,
        marginBottom: 8,
    },
    heroSub: { fontSize: 14, lineHeight: 22 },

    // ── Section header
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        paddingHorizontal: 8,
        paddingBottom: 6,
    },

    // ── Name field
    nameSection: {
        paddingHorizontal: Spacing.three,
        paddingBottom: 14,
    },
    nameWrap: {
        borderRadius: 12,
        borderWidth: 1.5,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameInput: {
        flex: 1,
        fontSize: 17,
        fontWeight: '500',
        letterSpacing: -0.3,
        padding: 0,
    },
    nameHelper: {
        fontSize: 10,
        letterSpacing: -0.2,
        paddingHorizontal: 8,
        paddingTop: 6,
    },

    // ── Type picker
    typeSection: {
        paddingHorizontal: Spacing.three,
        paddingTop: 12,
        paddingBottom: 16,
    },
    familyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    familyOptionIconTile: {
        width: 36,
        height: 36,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    familyOptionCopy: { flex: 1, minWidth: 0 },
    familyOptionTitle: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    familyOptionSub: { fontSize: 12, marginTop: 1 },
    familyOptionRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },

    // ── Helper + error
    helperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: Spacing.three + 8,
        paddingBottom: 12,
    },
    helperIcon: { flexShrink: 0 },
    helperText: { fontSize: 11.5, lineHeight: 18, flex: 1 },
    errorText: {
        paddingHorizontal: Spacing.three + 8,
        fontSize: 12,
        lineHeight: 18,
    },

    // ── Sticky CTA
    ctaBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: Spacing.three,
        paddingTop: 12,
        paddingBottom: 30,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    skipBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipBtnText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    continueBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
    },
    continueBtnText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    // ── Touch feedback
    pressed: { opacity: 0.7 },
});
