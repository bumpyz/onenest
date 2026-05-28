// KidCheckRow — multi-select kid row used in NewOverride's "Affects"
// SGroup. Each row shows the kid's avatar + name + their CURRENT
// default custody for the chosen date range, plus an optional
// "external co-parent affected" warn pill when the kid's default
// custodian is an external co-parent.
//
// Design source: screens-custody.jsx KidCheck (~line 1482).
//
// Selected = subtle accent-tinted row bg + filled accent checkbox.
// Unselected = transparent row + outlined checkbox.

import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { MemberAvatar } from './member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function KidCheckRow({
    name,
    color,
    sub,
    selected,
    externalNote,
    last,
    onPress,
}: {
    /** Kid's display name. */
    name: string;
    /** Kid's identity color (for the avatar). */
    color: string;
    /** Mono-styled sub line describing the current default custody. */
    sub: string;
    selected?: boolean;
    /** When set, renders a warn-tinted pill next to the name calling
     *  out that an external co-parent would be affected. Example:
     *  "Devon affected". */
    externalNote?: string | null;
    last?: boolean;
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="checkbox"
            accessibilityLabel={name}
            accessibilityState={{ checked: !!selected }}
            style={({ pressed }) => [
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                selected && {
                    backgroundColor: withAlpha(colors.accent, 0x08 / 255),
                },
                pressed && styles.pressed,
            ]}>
            <MemberAvatar name={name} color={color} size="lg" />
            <View style={styles.body}>
                <View style={styles.nameRow}>
                    <ThemedText
                        style={[styles.name, { color: colors.text }]}
                        numberOfLines={1}>
                        {name}
                    </ThemedText>
                    {externalNote ? (
                        <View
                            style={[
                                styles.warnPill,
                                {
                                    backgroundColor: withAlpha(
                                        colors.warn,
                                        0x18 / 255,
                                    ),
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.warnPillText,
                                    {
                                        color: colors.warn,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {externalNote.toUpperCase()}
                            </ThemedText>
                        </View>
                    ) : null}
                </View>
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
            </View>
            {/* Square checkbox — distinguishes from the radio-style
                CaregiverPickRow (which is a circle) so users read
                multi-select vs single-select at a glance. */}
            <View
                style={[
                    styles.checkbox,
                    {
                        borderColor: selected ? colors.accent : colors.inkFaint,
                        backgroundColor: selected
                            ? colors.accent
                            : 'transparent',
                    },
                ]}>
                {selected ? (
                    <Feather
                        name="check"
                        size={12}
                        color={colors.onAccent}
                        // Slight letter-spacing tweak via wrapping isn't
                        // needed; Feather's check renders centered.
                    />
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    body: { flex: 1, minWidth: 0 },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    warnPill: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    warnPillText: {
        fontSize: 9,
        letterSpacing: 0.3,
    },
    sub: {
        fontSize: 10.5,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    pressed: { opacity: 0.7 },
});
