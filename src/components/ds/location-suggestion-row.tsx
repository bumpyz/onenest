// LocationSuggestionRow — the "Lincoln Park · Field 3" / "Last used 5
// days ago" row used in the EventCreate Where section. Lifted from the
// design spec's LocSuggestion (screens-extra-2.jsx:708-738) so the
// EventForm location list reads as a real picker list rather than the
// older horizontal name-only chip strip.
//
// Visual structure (top to bottom of the row):
//   • 28×28 rounded square icon tile with a pin glyph
//   • title (14/500, ink)
//   • mono sub line (10pt, inkMuted) — "Last used 5 days ago", address,
//     etc. Optional but the design always shows one.
//   • optional RECENT pill on the right — small accent caps tag
//   • optional SELECTED pill on the right (mutually exclusive with
//     RECENT for now — the design shows SAVED for the picked row;
//     callers pass whatever copy reads right for their context)
//
// Tap-to-select. `selected` adds an accent-tinted background +
// accent-colored pin icon so the row pops in a list of unselected
// siblings. Last-row callers pass `last` to suppress the bottom
// hairline divider so it doesn't double the card edge.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function LocationSuggestionRow({
    title,
    sub,
    selected,
    tagLabel,
    tagTone = 'accent',
    last,
    onPress,
}: {
    title: string;
    /** Mono-styled sub line. Pass an address ("0.4 mi away") or a usage
     *  hint ("Last used 5 days ago"). */
    sub?: string;
    /** Selected (= picked location) state. Accent-tinted bg, accent
     *  pin icon, bolder title. */
    selected?: boolean;
    /** Optional right-side mini pill. Common values: "RECENT", "SAVED". */
    tagLabel?: string;
    /** Pill tone. "accent" (default) matches the design's RECENT pill;
     *  "neutral" matches SAVED. */
    tagTone?: 'accent' | 'neutral';
    /** Suppress the bottom hairline — pass for the last row in a card. */
    last?: boolean;
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const pinColor = selected ? colors.accent : colors.inkSec;
    const tagBg = tagTone === 'accent'
        ? withAlpha(colors.accent, 0x22 / 255)
        : colors.backgroundInset;
    const tagColor = tagTone === 'accent' ? colors.accent : colors.inkFaint;

    const inner = (
        <View
            style={[
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                selected && {
                    backgroundColor: withAlpha(colors.accent, 0x0e / 255),
                },
            ]}>
            <View
                style={[
                    styles.iconTile,
                    {
                        backgroundColor: selected
                            ? withAlpha(colors.accent, 0x18 / 255)
                            : colors.backgroundInset,
                    },
                ]}>
                <Feather name="map-pin" size={14} color={pinColor} />
            </View>
            <View style={styles.body}>
                <ThemedText
                    style={[
                        styles.title,
                        {
                            color: colors.text,
                            fontWeight: selected ? '600' : '500',
                        },
                    ]}
                    numberOfLines={1}>
                    {title}
                </ThemedText>
                {sub ? (
                    <ThemedText
                        style={[
                            styles.sub,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}
                        numberOfLines={1}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            {tagLabel ? (
                <View
                    style={[
                        styles.tagPill,
                        { backgroundColor: tagBg },
                    ]}>
                    <ThemedText
                        style={[
                            styles.tagPillText,
                            {
                                color: tagColor,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        {tagLabel.toUpperCase()}
                    </ThemedText>
                </View>
            ) : null}
        </View>
    );

    if (!onPress) return inner;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ selected: !!selected }}
            style={({ pressed }) => [pressed && styles.pressed]}>
            {inner}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    // 28x28 rounded square tile — the design's pin lives inside this
    // muted-fill tile rather than floating against the row bg. Sets a
    // consistent leading width so titles align across multiple rows.
    iconTile: {
        width: 28,
        height: 28,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    body: { flex: 1, minWidth: 0 },
    title: {
        fontSize: 14,
        letterSpacing: -0.2,
    },
    sub: {
        fontSize: 10,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    tagPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
    },
    tagPillText: {
        fontSize: 9,
        letterSpacing: 0.3,
        fontWeight: '600',
    },
    pressed: { opacity: 0.7 },
});
