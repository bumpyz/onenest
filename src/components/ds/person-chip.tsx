// PersonChip — small avatar+name pill used in event forms (Responsible /
// For pickers) and event read views (Who row, child chip strip).
//
// Design source: `screens-extra-2.jsx::ParentChip` (selectable form
// chip, member color tinted when selected) + `screens-extra-2.jsx::
// AnyoneChip` (dashed `?` neutral) + `screens-extra.jsx::ChildChip`
// (read-mode child chip with the same member-color tint).
//
// Three flavors mapped to props:
//   • <PersonChip name="Alex" color="#5C77B5" /> — unselected, hair
//     border, card bg.
//   • <PersonChip name="Alex" color="#5C77B5" selected /> — selected,
//     color+'22' bg, 1px color+'88' border, trailing check glyph.
//   • <AnyoneChip /> — dashed-circle `?` + "Anyone" label, always
//     unselected styling.
//
// Both render as a button when `onPress` is provided; static otherwise.
// Avatar size + chip padding mirror the design exactly (avatar 20px,
// inner padding 4/9/4/4 = `Spacing.one`-equivalent).

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function PersonChip({
    name,
    color,
    selected,
    onPress,
    avatarSize = 20,
}: {
    /** Display name — first character renders inside the avatar. */
    name: string;
    /** Per-member identity color (from `memberColorMap` /
     *  `colorForResponsible`). Tints background + border when selected. */
    color: string;
    /** True when the chip represents the current selection in a picker
     *  (or "the only assignee" in read view). Triggers the tinted
     *  background, color border, and trailing check glyph. */
    selected?: boolean;
    /** Wraps the chip in a Pressable. Without it the chip is static. */
    onPress?: () => void;
    /** Avatar diameter in px. Spec values: 20 (form picker chip),
     *  18 (read-mode child chip), 22 (responsible row). */
    avatarSize?: number;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const body = (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: selected
                        ? withAlpha(color, 0.13)
                        : colors.backgroundElement,
                    borderColor: selected
                        ? withAlpha(color, 0.53)
                        : colors.hair,
                    borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
                },
            ]}>
            <View
                style={[
                    styles.avatar,
                    {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                        backgroundColor: color,
                    },
                ]}>
                <ThemedText style={styles.avatarText}>
                    {(name?.[0] ?? '?').toUpperCase()}
                </ThemedText>
            </View>
            <ThemedText
                style={[styles.label, { color: colors.text }]}
                numberOfLines={1}>
                {name}
            </ThemedText>
            {selected ? (
                <Feather name="check" size={11} color={colors.text} />
            ) : null}
        </View>
    );
    if (!onPress) return body;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            accessibilityLabel={name}
            style={({ pressed }) => [pressed && styles.pressed]}>
            {body}
        </Pressable>
    );
}

export function AnyoneChip({
    onPress,
    selected,
}: {
    /** Wraps the chip in a Pressable. Without it the chip is static. */
    onPress?: () => void;
    /** When true, renders the dashed `?` ring in accent + label in text
     *  weight 600. Default (false) renders the muted "no-one picked"
     *  state. */
    selected?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const body = (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                    borderWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View
                style={[
                    styles.anyoneRing,
                    {
                        borderColor: selected
                            ? colors.accent
                            : colors.inkFaint,
                    },
                ]}>
                <ThemedText
                    style={[
                        styles.anyoneGlyph,
                        {
                            color: selected
                                ? colors.accent
                                : colors.inkFaint,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    ?
                </ThemedText>
            </View>
            <ThemedText
                style={[
                    styles.label,
                    { color: selected ? colors.text : colors.inkSec },
                ]}>
                Anyone
            </ThemedText>
        </View>
    );
    if (!onPress) return body;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Anyone"
            accessibilityState={{ selected: !!selected }}
            style={({ pressed }) => [pressed && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        // Asymmetric padding per design: 4px left (hugs the avatar),
        // 9px right (gap from label to chip edge), 4px vertical.
        paddingLeft: 4,
        paddingRight: 9,
        paddingVertical: 4,
        borderRadius: 999,
    },
    avatar: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    anyoneRing: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    anyoneGlyph: {
        fontSize: 9,
        fontWeight: '600',
    },
    pressed: { opacity: 0.7 },
});
