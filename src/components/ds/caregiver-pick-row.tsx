// CaregiverPickRow — single-select row used in NewOverride's "With
// whom" SGroup. Same shape as KidCheckRow but with a circular radio
// indicator (instead of square checkbox) so users read "pick one" at
// a glance. Supports an optional EXT pill for external co-parents and
// a muted state for the parent who's the default for the chosen date
// range (so the user understands selecting them is a no-op).
//
// Design source: screens-custody.jsx CaregiverPick (~line 1523).

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MemberAvatar } from './member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function CaregiverPickRow({
    name,
    color,
    sub,
    selected,
    muted,
    external,
    last,
    onPress,
}: {
    name: string;
    color: string;
    sub: string;
    selected?: boolean;
    /** Renders the whole row dimmed — for the parent who's already the
     *  default for the chosen date range (selecting them is a no-op). */
    muted?: boolean;
    /** Renders an "EXT" mono pill next to the name for external
     *  co-parents. Mirrors the Members-list EXT tag (#404). */
    external?: boolean;
    last?: boolean;
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    return (
        <Pressable
            onPress={onPress}
            disabled={muted}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ selected: !!selected, disabled: !!muted }}
            style={({ pressed }) => [
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                selected && {
                    backgroundColor: withAlpha(colors.accent, 0x0e / 255),
                },
                muted && { opacity: 0.55 },
                pressed && !muted && styles.pressed,
            ]}>
            <MemberAvatar name={name} color={color} size="lg" />
            <View style={styles.body}>
                <View style={styles.nameRow}>
                    <ThemedText
                        style={[styles.name, { color: colors.text }]}
                        numberOfLines={1}>
                        {name}
                    </ThemedText>
                    {external ? (
                        <View
                            style={[
                                styles.extPill,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.extPillText,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                EXT
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
            {/* Circular radio — pairs with KidCheckRow's square
                checkbox in the same screen to signal single vs
                multi-select. */}
            <View
                style={[
                    styles.radio,
                    {
                        borderColor: selected ? colors.accent : colors.inkFaint,
                        backgroundColor: selected
                            ? colors.accent
                            : 'transparent',
                    },
                ]}>
                {selected ? (
                    <Feather name="check" size={11} color={colors.onAccent} />
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
    extPill: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        borderWidth: StyleSheet.hairlineWidth,
    },
    extPillText: {
        fontSize: 9,
        letterSpacing: 0.3,
    },
    sub: {
        fontSize: 10.5,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    pressed: { opacity: 0.7 },
});
