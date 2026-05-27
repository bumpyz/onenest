// DashedAddChip — the "+ Add" affordance used across creation flows
// (`+ Pick lists`, `+ Add allergy`, `+ Caregiver`, etc.).
//
// Design source: `screens-creation.jsx::DashedAddChip` + cross-cutting
// rule "+ Add/+ Pick… chips are dashed, mono, inkMuted".
//
// Visual: pill (radius 999), dashed hairline border in inkFaint, mono
// 11 inkMuted text, 9/4 padding.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
};

export function DashedAddChip({ label, onPress, disabled = false }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const body = (
        <View
            style={[
                styles.chip,
                {
                    borderColor: colors.inkFaint,
                },
            ]}>
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: colors.inkFaint,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {label}
            </ThemedText>
        </View>
    );

    if (!onPress) return body;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [pressed && !disabled && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        // RN's `borderStyle: 'dashed'` works on iOS but is unreliable
        // on Android prior to RN 0.74. Newer versions render this
        // correctly; if Android renders solid, we can wrap in a
        // SVG-based dashed-border fallback per platform.
        borderStyle: 'dashed',
        borderWidth: StyleSheet.hairlineWidth,
        backgroundColor: 'transparent',
    },
    label: {
        fontSize: 11,
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
