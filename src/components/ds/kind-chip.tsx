// KindChip — icon + label pill used in the NewOverride editor's
// "What's happening" SGroup. Six kinds map to design 06.3's chip
// strip (Family trip / Birthday / Work travel / Anniversary / Just
// swapping / Other).
//
// Design source: screens-custody.jsx KindChip (~line 1395).
//
// Selected = accent-tinted bg + accent border + accent label.
// Unselected = inset bg + hair border + inkSec label.
// Icon is rendered at the label's color so the chip reads as one unit.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

// Maps the design's custom inline SVG names to Feather equivalents.
// 'cake' has no Feather counterpart; 'gift' is the closest semantic
// (birthday/event pile).
const ICON_MAP: Record<
    string,
    React.ComponentProps<typeof Feather>['name']
> = {
    trip: 'map',
    cake: 'gift',
    briefcase: 'briefcase',
    heart: 'heart',
    swap: 'repeat',
    dots: 'more-horizontal',
};

export type KindChipIcon = keyof typeof ICON_MAP;

export function KindChip({
    label,
    icon,
    selected,
    onPress,
}: {
    label: string;
    icon: KindChipIcon;
    selected?: boolean;
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const tint = selected ? colors.accent : colors.inkSec;
    const bg = selected
        ? withAlpha(colors.accent, 0x14 / 255)
        : colors.backgroundInset;
    const border = selected ? colors.accent : colors.hair;
    const labelColor = selected ? colors.text : colors.inkSec;

    const inner = (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: bg,
                    borderColor: border,
                    // Selected gets a slightly thicker border, matching
                    // the design's 1.2 vs 0.5px treatment.
                    borderWidth: selected ? 1.2 : StyleSheet.hairlineWidth,
                },
            ]}>
            <Feather name={ICON_MAP[icon]} size={14} color={tint} />
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: labelColor,
                        fontWeight: selected ? '600' : '500',
                    },
                ]}>
                {label}
            </ThemedText>
        </View>
    );

    if (!onPress) return inner;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: !!selected }}
            style={({ pressed }) => [pressed && styles.pressed]}>
            {inner}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 999,
    },
    label: {
        fontSize: 12.5,
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
