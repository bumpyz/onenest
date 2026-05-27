// ListTagChip — colored-dot pill used in CreateTask's "In lists"
// section and anywhere list membership is picked.
//
// Design source: `screens-creation.jsx::ListTagChip`.
//
// Visual: pill (radius 999) with `color + 22` background and
// `color + 66` hairline when selected; card bg + neutral hairline when
// unselected. 6px color dot on the left, 12 / 600 label. When
// selected, a small ink checkmark renders at the right.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    color: string;
    label: string;
    selected: boolean;
    onPress?: () => void;
    disabled?: boolean;
};

export function ListTagChip({
    color,
    label,
    selected,
    onPress,
    disabled = false,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const body = (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: selected
                        ? withAlpha(color, 0x22 / 255)
                        : colors.backgroundElement,
                    borderColor: selected
                        ? withAlpha(color, 0x66 / 255)
                        : colors.hair,
                    borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
                },
            ]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: selected ? colors.text : colors.inkSec,
                    },
                ]}>
                {label}
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
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [pressed && !disabled && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 8,
        paddingRight: 9,
        paddingVertical: 4,
        borderRadius: 999,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
