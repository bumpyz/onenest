// Appearance — Phase 6.7.4 sub-route + Phase 6.7 UX review rewrite.
//
// The first cut of this screen rendered Theme/Accent/Density as plain nav
// rows + a single radio column for theme. The UX review called that out
// as CRITICAL: the design (docs/design-handoffs/settings-subroutes-v2/
// screens-settings.jsx::AppearanceScreen line 850-1020) calls for:
//   1) a live PREVIEW card at the top showing a sample event that re-themes
//      with the current selection
//   2) a horizontal row of three ThemeOption cards (light / dark / system)
//      instead of stacked rows with radio bubbles
//   3) an Accent SGroup that has BOTH a palette-swatch row (4 wrappable
//      cards) AND a per-element accent row, with the palette name as a
//      mono accessory on the group header
//   4) Density as an inline segmented control, not a chevron nav row that
//      pops an alert
//
// This file is the rewrite. Only theme preference is actually wired (via
// useThemePreference); palette + per-element accent + density are visual
// scaffolds that match the design but don't persist anything yet — the
// palette refactor (Phase 1B follow-up) is when those would land.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
    useAppColorScheme,
    useThemePreference,
    type ThemePreference,
} from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

const THEME_OPTIONS: ReadonlyArray<{
    id: ThemePreference;
    label: string;
    sub: string;
    icon: React.ComponentProps<typeof Feather>['name'];
}> = [
    { id: 'light', label: 'Light', sub: 'Always light', icon: 'sun' },
    { id: 'dark', label: 'Dark', sub: 'Always dark', icon: 'moon' },
    { id: 'system', label: 'System', sub: 'Match device', icon: 'smartphone' },
];

// Palette options for the swatch row. Names match the design handoff —
// `Mist Forest` is what the app currently uses. The other three are visual
// previews until the palette refactor lands.
const PALETTE_OPTIONS: ReadonlyArray<{
    id: string;
    name: string;
    primary: string;
    secondary: string;
}> = [
    { id: 'mist-forest', name: 'Mist Forest', primary: '#2D8B6E', secondary: '#A0CFB8' },
    { id: 'slate-coral', name: 'Slate Coral', primary: '#E5613D', secondary: '#F2A98B' },
    { id: 'bell-navy', name: 'Bell Navy', primary: '#E8A04F', secondary: '#1F2940' },
    { id: 'charcoal', name: 'Charcoal', primary: '#FF7B52', secondary: '#15171B' },
];

// Per-element accent tiles. First one matches the active accent so a
// glance tells you what's selected; the others are previews.
const PER_ELEMENT_ACCENTS: ReadonlyArray<string> = [
    '#2D8B6E', // active (Mist Forest accent)
    '#E5613D',
    '#E8A04F',
    '#5667D4',
    '#8369A8',
    '#C5392E',
];

// Local copy of useAsyncStorageBool — used to make the toggles "sticky"
// even before the prefs surface ships. See main settings.tsx for the
// original; inlined here so this sub-route stays self-contained.
//
// Phase 6.7 pass-2 QA fix: both hooks guard against the user-tap-during-
// hydration race. If the user mutates the value before AsyncStorage's
// getItem promise resolves, the hydrator must NOT overwrite their input.
// The `mutated` ref flips on first setAndPersist call and the hydration
// callback bails when it sees it set.
function useAsyncStorageBool(
    key: string,
    defaultValue: boolean,
): [boolean, (next: boolean) => void] {
    const [value, setValue] = useState(defaultValue);
    const mutatedRef = useRef(false);
    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(key)
            .then((raw) => {
                if (cancelled || raw === null || mutatedRef.current) return;
                setValue(raw === 'true');
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [key]);
    const setAndPersist = useCallback(
        (next: boolean) => {
            mutatedRef.current = true;
            setValue(next);
            AsyncStorage.setItem(key, next ? 'true' : 'false').catch(() => {});
        },
        [key],
    );
    return [value, setAndPersist];
}

// String variant — same shape, same race guard. Used for density and the
// palette / per-element accent selections.
function useAsyncStorageString(
    key: string,
    defaultValue: string,
): [string, (next: string) => void] {
    const [value, setValue] = useState(defaultValue);
    const mutatedRef = useRef(false);
    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(key)
            .then((raw) => {
                if (cancelled || raw === null || mutatedRef.current) return;
                setValue(raw);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [key]);
    const setAndPersist = useCallback(
        (next: string) => {
            mutatedRef.current = true;
            setValue(next);
            AsyncStorage.setItem(key, next).catch(() => {});
        },
        [key],
    );
    return [value, setAndPersist];
}

export default function AppearanceSettingsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const { preference: themePreference, setPreference: setThemePreference } =
        useThemePreference();

    const { session, isLoading: authLoading } = useAuth();

    // Palette + accent selections — visual only until the palette refactor
    // lands (see #287 in the original task list, the palette tokens work).
    const [selectedPaletteId, setSelectedPaletteId] = useAsyncStorageString(
        'onenest:settings:appearance:palette',
        'mist-forest',
    );
    // Phase 6.7 pass-2 QA fix: seed from PER_ELEMENT_ACCENTS[0] (the
    // canonical Mist Forest light accent) instead of `colors.accent`.
    // The latter resolves to the dark-mode accent (#3FC198) when the user
    // first opens this screen in dark mode, and that hex isn't in the
    // accent tile list — so no swatch would read as selected until tap.
    const [selectedPerElementAccent, setSelectedPerElementAccent] = useAsyncStorageString(
        'onenest:settings:appearance:per-element-accent',
        PER_ELEMENT_ACCENTS[0],
    );

    const [density, setDensity] = useAsyncStorageString(
        'onenest:settings:appearance:density',
        'comfortable',
    );
    const [reduceMotion, setReduceMotion] = useAsyncStorageBool(
        'onenest:settings:appearance:reduce-motion',
        false,
    );
    const [monoMetadata, setMonoMetadata] = useAsyncStorageBool(
        'onenest:settings:appearance:mono-metadata',
        true,
    );

    if (authLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;

    const activePalette =
        PALETTE_OPTIONS.find((p) => p.id === selectedPaletteId) ?? PALETTE_OPTIONS[0];

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={[styles.topBar, { borderBottomColor: colors.hair }]}>
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
                        Appearance
                    </ThemedText>
                    <View style={styles.topBarIconBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Preview card — the centerpiece of the screen. Shows a
                        sample event that re-themes with the current accent +
                        scheme. Uses the same hex constants the real event
                        renderer would, with the active accent (`colors.accent`)
                        as the leading bar and NOW pill. Per the design
                        (screens-settings.jsx:861-902). */}
                    <View
                        style={[
                            styles.previewCard,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <ThemedText
                            style={[
                                styles.previewLabel,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            PREVIEW
                        </ThemedText>
                        {/* Phase 6.7 pass-2 UX fix: bar + NOW pill + OPEN chip
                            all derive from the user's per-element accent
                            selection (not the live theme accent), so tapping
                            a swatch below re-themes the preview. */}
                        <View
                            style={[
                                styles.previewEventCard,
                                {
                                    backgroundColor: colors.backgroundInset,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <View style={styles.previewEventRow}>
                                <View
                                    style={[
                                        styles.previewEventBar,
                                        { backgroundColor: selectedPerElementAccent },
                                    ]}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <ThemedText
                                        type="smallBold"
                                        style={{ color: colors.text }}>
                                        Soph&apos;s piano lesson
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.previewEventMeta,
                                            {
                                                color: colors.textSecondary,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}>
                                        Wed · 16:00 · with Mrs. Anderson
                                    </ThemedText>
                                </View>
                                <View
                                    style={[
                                        styles.previewNowPill,
                                        { backgroundColor: selectedPerElementAccent },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.previewNowPillText,
                                            {
                                                color: colors.onAccent,
                                                fontFamily: FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        NOW
                                    </ThemedText>
                                </View>
                            </View>
                            <View
                                style={[
                                    styles.previewEventFooter,
                                    { borderTopColor: colors.hair },
                                ]}>
                                {/* Soph stub avatar — using a child palette color
                                    (warm sand / soft wheat) so the preview reads
                                    as "for a kid" without needing real data. */}
                                <View
                                    style={[
                                        styles.previewChildBadge,
                                        { backgroundColor: '#DDC9A1' },
                                    ]}>
                                    <ThemedText style={styles.previewChildBadgeText}>
                                        S
                                    </ThemedText>
                                </View>
                                <ThemedText
                                    type="small"
                                    style={{ color: colors.inkSec, flex: 1 }}>
                                    For Soph
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.previewOpenChip,
                                        {
                                            color: selectedPerElementAccent,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    OPEN →
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {/* Theme — horizontal row of three ThemeOption cards
                        (light / dark / system). Per design (line 906-913).
                        Phase 6.7 pass-2 fix: each option is its own bordered
                        card, so wrapping them in an outer `styles.card`
                        produced a double-bordered row. Render the row
                        directly with the section padding instead. */}
                    <View>
                        <View style={styles.sectionHeader}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                THEME
                            </ThemedText>
                        </View>
                        <View style={styles.themeRowBare}>
                            <View style={styles.themeRow}>
                                {THEME_OPTIONS.map((opt) => {
                                    const selected = themePreference === opt.id;
                                    return (
                                        <Pressable
                                            key={opt.id}
                                            onPress={() => setThemePreference(opt.id)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={opt.label}
                                            style={({ pressed }) => [
                                                styles.themeOption,
                                                {
                                                    borderColor: selected
                                                        ? colors.accent
                                                        : colors.hair,
                                                    borderWidth: selected
                                                        ? 1.5
                                                        : StyleSheet.hairlineWidth,
                                                    backgroundColor: selected
                                                        ? `${colors.accent}0e`
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <Feather
                                                name={opt.icon}
                                                size={18}
                                                color={selected ? colors.accent : colors.inkSec}
                                            />
                                            <ThemedText
                                                type="smallBold"
                                                style={{
                                                    color: selected ? colors.accent : colors.text,
                                                    marginTop: 6,
                                                }}>
                                                {opt.label}
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    styles.themeOptionSub,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily: FontFamily.monoMedium,
                                                    },
                                                ]}>
                                                {opt.sub}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    {/* Accent — palette swatch row + per-element accent row.
                        Group header carries the active palette name as a
                        mono accessory on the right (per design line 919-923).
                        Palette + per-element accent BOTH carry a COMING
                        SOON badge: their picks persist to AsyncStorage but
                        the theme provider only reads Mist Forest tokens
                        today (the multi-palette refactor is task #400). The
                        badge sets the right expectation — without it, a
                        user clicks Slate Coral and reasonably expects the
                        app to re-tint. */}
                    <View>
                        <View style={[styles.sectionHeader, styles.sectionHeaderRow]}>
                            <View style={styles.sectionHeaderLeft}>
                                <ThemedText
                                    style={[
                                        styles.sectionLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ACCENT
                                </ThemedText>
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
                                            styles.comingSoonBadgeText,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily: FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        COMING SOON
                                    </ThemedText>
                                </View>
                            </View>
                            <ThemedText
                                style={[
                                    styles.sectionAccessory,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                {activePalette.name.toUpperCase()}
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            {/* Palette swatch row — 4 wrappable cards, 2 per row */}
                            <View style={styles.paletteSwatchRow}>
                                {PALETTE_OPTIONS.map((opt) => {
                                    const selected = opt.id === selectedPaletteId;
                                    return (
                                        <Pressable
                                            key={opt.id}
                                            onPress={() => setSelectedPaletteId(opt.id)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={`${opt.name} palette`}
                                            style={({ pressed }) => [
                                                styles.paletteSwatch,
                                                {
                                                    borderColor: selected
                                                        ? colors.accent
                                                        : colors.hair,
                                                    borderWidth: selected
                                                        ? 1.5
                                                        : StyleSheet.hairlineWidth,
                                                    backgroundColor: selected
                                                        ? `${colors.accent}0e`
                                                        : colors.backgroundInset,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <View style={styles.paletteSwatchCircles}>
                                                <View
                                                    style={[
                                                        styles.paletteSwatchCircle,
                                                        {
                                                            backgroundColor: opt.primary,
                                                            borderColor: colors.backgroundElement,
                                                            zIndex: 2,
                                                        },
                                                    ]}
                                                />
                                                <View
                                                    style={[
                                                        styles.paletteSwatchCircle,
                                                        styles.paletteSwatchCircleOverlap,
                                                        {
                                                            backgroundColor: opt.secondary,
                                                            borderColor: colors.backgroundElement,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                            <ThemedText
                                                type="smallBold"
                                                numberOfLines={1}
                                                style={{ flex: 1, color: colors.text }}>
                                                {opt.name}
                                            </ThemedText>
                                            {selected ? (
                                                <View
                                                    style={[
                                                        styles.paletteSwatchCheck,
                                                        { backgroundColor: colors.accent },
                                                    ]}>
                                                    <Feather
                                                        name="check"
                                                        size={9}
                                                        color={colors.onAccent}
                                                    />
                                                </View>
                                            ) : null}
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {/* Per-element accent label + row.
                                COMING SOON badge sits inline with the
                                section label so users see at a glance
                                that taps here don't yet take effect —
                                the picker writes to AsyncStorage but
                                the theme provider doesn't consume the
                                override until #401 lands. Without the
                                badge the picker reads as a broken
                                control. */}
                            <View style={styles.perElementHeader}>
                                <ThemedText
                                    style={[
                                        styles.perElementLabel,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    PER-ELEMENT ACCENT
                                </ThemedText>
                                <View
                                    style={[
                                        styles.comingSoonBadge,
                                        {
                                            backgroundColor:
                                                colors.backgroundInset,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.comingSoonBadgeText,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        COMING SOON
                                    </ThemedText>
                                </View>
                            </View>
                            <View
                                style={styles.perElementRow}
                                accessibilityRole="radiogroup"
                                accessibilityLabel="Per-element accent color">
                                {PER_ELEMENT_ACCENTS.map((c) => {
                                    const selected =
                                        selectedPerElementAccent.toLowerCase() === c.toLowerCase();
                                    return (
                                        <Pressable
                                            key={c}
                                            onPress={() => setSelectedPerElementAccent(c)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={`Accent color ${c}`}
                                            style={({ pressed }) => [
                                                styles.perElementSwatch,
                                                {
                                                    backgroundColor: c,
                                                    borderColor: selected
                                                        ? colors.text
                                                        : 'transparent',
                                                    borderWidth: selected ? 2 : 0,
                                                },
                                                pressed && styles.pressed,
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    {/* Density — inline segmented control + extras toggles.
                        Per design (line 949-969) the density picker is an
                        in-place segmented control, not a chevron nav. */}
                    <View>
                        <View style={styles.sectionHeader}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                DENSITY
                            </ThemedText>
                            <ThemedText
                                themeColor="textSecondary"
                                type="small"
                                style={styles.sectionSub}>
                                Comfortable spaces out rows for easy tapping; Compact
                                fits more on screen.
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.densitySegmentedShell,
                                    {
                                        backgroundColor: colors.backgroundInset,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {(
                                    [
                                        { id: 'comfortable', label: 'Comfortable', sub: 'Default' },
                                        { id: 'compact', label: 'Compact', sub: '-20% height' },
                                    ] as const
                                ).map((opt) => {
                                    const selected = density === opt.id;
                                    return (
                                        <Pressable
                                            key={opt.id}
                                            onPress={() => setDensity(opt.id)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={`${opt.label} density`}
                                            style={({ pressed }) => [
                                                styles.densitySegment,
                                                selected && {
                                                    backgroundColor: colors.backgroundElement,
                                                    borderColor: colors.hair,
                                                    borderWidth: StyleSheet.hairlineWidth,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="smallBold"
                                                style={{
                                                    color: selected
                                                        ? colors.text
                                                        : colors.textSecondary,
                                                }}>
                                                {opt.label}
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    styles.densitySegmentSub,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily: FontFamily.monoMedium,
                                                    },
                                                ]}>
                                                {opt.sub}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <ToggleRow
                                label="Reduce motion"
                                sub="Disable transitions and parallax across the app"
                                value={reduceMotion}
                                onChange={setReduceMotion}
                                colors={colors}
                                first
                            />
                            <ToggleRow
                                label="Show monospace metadata"
                                sub="Times, IDs and counters in Geist Mono (recommended)"
                                value={monoMetadata}
                                onChange={setMonoMetadata}
                                colors={colors}
                                last
                            />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

function ToggleRow({
    label,
    sub,
    value,
    onChange,
    colors,
    last,
    first,
}: {
    label: string;
    sub?: string;
    value: boolean;
    onChange: (next: boolean) => void;
    colors: Palette;
    last?: boolean;
    /** Set when the row sits directly below a non-row element (e.g. the
     *  density segmented shell) — paints a single top hairline so the row
     *  reads as part of the same card, then borderBottom handles the
     *  divider rhythm from there. */
    first?: boolean;
}) {
    return (
        <View
            style={[
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                first && {
                    borderTopColor: colors.hair,
                    borderTopWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>
                    {label}
                </ThemedText>
                {sub ? (
                    <ThemedText themeColor="textSecondary" type="small">
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: colors.inkFaint, true: colors.accent }}
                thumbColor="#FFFFFF"
                accessibilityLabel={label}
            />
        </View>
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
        paddingTop: 10,
        paddingBottom: 10,
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
    topBarTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },

    scroll: { padding: Spacing.four, gap: Spacing.four },

    // ── Section headers
    sectionHeader: {
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.two,
        gap: 4,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.two,
    },
    // Inline label + COMING SOON badge cluster. align-items: baseline so
    // the badge sits next to the caps label without dropping below it.
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    sectionAccessory: {
        fontSize: 10,
        letterSpacing: 0.3,
    },
    sectionSub: { lineHeight: 16 },

    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // ── Preview card
    previewCard: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 10,
    },
    previewLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    previewEventCard: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 12,
        gap: 8,
    },
    previewEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    previewEventBar: {
        width: 4,
        height: 30,
        borderRadius: 2,
    },
    previewEventMeta: { fontSize: 10.5, letterSpacing: -0.2 },
    previewNowPill: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
    },
    previewNowPillText: { fontSize: 9, letterSpacing: 0.4, fontWeight: '700' },
    previewEventFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    previewChildBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewChildBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    previewOpenChip: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },

    // ── Theme row (3 horizontal cards). Each card already paints its own
    //    border, so the row sits bare under the section header (no outer
    //    card shell to avoid the pass-2 double-border issue).
    themeRowBare: { paddingHorizontal: Spacing.four },
    themeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    themeOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    themeOptionSub: { fontSize: 9, letterSpacing: -0.1, marginTop: 2 },

    // ── Palette swatch row
    paletteSwatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: Spacing.three,
        gap: 10,
    },
    paletteSwatch: {
        // 2-per-row at 402px-class viewport; fall back gracefully on narrower.
        flexBasis: '47%',
        flexGrow: 1,
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 10,
    },
    paletteSwatchCircles: {
        flexDirection: 'row',
        position: 'relative',
        height: 22,
        width: 36,
    },
    paletteSwatchCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
    },
    paletteSwatchCircleOverlap: {
        marginLeft: -8,
    },
    paletteSwatchCheck: {
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Per-element accent
    perElementHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: Spacing.three,
        paddingTop: Spacing.two,
    },
    perElementLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    // COMING SOON badge — small hairline pill annotating affordances
    // whose backend isn't wired yet (per-element accent, density extras).
    // Sits inline with section labels so users perceive the picker as
    // forward-looking rather than broken.
    comingSoonBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    comingSoonBadgeText: {
        fontSize: 9,
        letterSpacing: 0.4,
    },
    perElementRow: {
        flexDirection: 'row',
        gap: 8,
        padding: Spacing.three,
        flexWrap: 'wrap',
    },
    perElementSwatch: {
        width: 32,
        height: 32,
        // Phase 6.7 pass-2 UX fix: design treats per-element accent tiles
        // as rounded squares (borderRadius 8), not circles. Circular tiles
        // read as "color swatch" but the design language for accents is
        // squarer to differentiate from member identity dots.
        borderRadius: 8,
    },

    // ── Density segmented control
    densitySegmentedShell: {
        flexDirection: 'row',
        gap: 6,
        padding: 3,
        margin: Spacing.three,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    densitySegment: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 8,
        gap: 2,
    },
    densitySegmentSub: { fontSize: 9, letterSpacing: -0.1 },

    // ── Generic toggle row
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },

    pressed: { opacity: 0.7 },
});
