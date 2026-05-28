// PresetChip — small mono pill used to seed the date range with a
// quick preset (Today / Tomorrow / This weekend / Next weekend /
// Custom…). Sits beneath the DateRangeBoxes in NewOverride's When
// SGroup.
//
// Design source: screens-custody.jsx PresetChip (~line 1470).
//
// Three visual states:
//   • Default: hair border, transparent bg, inkSec label
//   • Selected: accent border + bg tint, accent label
//   • Muted: dashed border, inkFaint label — for the "Custom…" preset
//     when the editor wants to route to a date picker rather than
//     seed a fixed range

import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function PresetChip({
    label,
    selected,
    muted,
    onPress,
}: {
    label: string;
    selected?: boolean;
    /** Renders the chip with a dashed border + faint label. Use for
     *  the "Custom…" affordance that opens a picker rather than
     *  selecting a fixed preset. */
    muted?: boolean;
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const borderColor = selected ? colors.accent : colors.hair;
    const bg = selected
        ? withAlpha(colors.accent, 0x14 / 255)
        : 'transparent';
    const labelColor = muted
        ? colors.inkFaint
        : selected
          ? colors.accent
          : colors.inkSec;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: !!selected }}
            style={({ pressed }) => [
                styles.chip,
                {
                    backgroundColor: bg,
                    borderColor,
                    borderStyle: muted ? 'dashed' : 'solid',
                },
                pressed && styles.pressed,
            ]}>
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: labelColor,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {label}
            </ThemedText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    label: {
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
