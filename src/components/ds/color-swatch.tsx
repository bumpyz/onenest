// ColorSwatch — 36×36 rounded color tile with a white-check selected
// state. Used in the Color sections of AddChild and CreateList; also
// usable anywhere a single-color picker is needed.
//
// Design source: `screens-creation.jsx::ColorSwatch`.
//
// Visual: 10px corner radius, hairline border in unselected state, a
// pair of stacked shadows in selected state simulating a 2-stop halo
// ring (innermost = bg color, outermost = swatch color). White check
// glyph centered on selected.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    color: string;
    selected: boolean;
    onPress?: () => void;
    /** Accessibility label override. Defaults to the hex color. */
    label?: string;
    disabled?: boolean;
};

export function ColorSwatch({
    color,
    selected,
    onPress,
    label,
    disabled = false,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const a11yLabel = label ?? `Color ${color}`;

    const body = (
        <View
            style={[
                styles.outer,
                selected
                    ? {
                          // Two-stop halo: inner ring = bg (separator),
                          // outer ring = swatch color (highlight).
                          borderColor: color,
                          borderWidth: 2,
                          padding: 1,
                          backgroundColor: colors.background,
                      }
                    : null,
            ]}>
            <View
                style={[
                    styles.swatch,
                    {
                        backgroundColor: color,
                        borderColor: selected ? 'transparent' : colors.hair,
                        borderWidth: selected ? 0 : StyleSheet.hairlineWidth,
                    },
                ]}>
                {selected ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                ) : null}
            </View>
        </View>
    );

    if (!onPress) return body;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [pressed && !disabled && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    outer: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swatch: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
});
