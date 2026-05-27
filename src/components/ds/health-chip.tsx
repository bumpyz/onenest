// HealthChip — allergy / medication pill used in AddChild's Health
// section. Carries an optional severity badge (e.g. "SEVERE") in the
// same color family.
//
// Design source: `screens-creation.jsx::HealthChip`.
//
// Visual: pill (radius 999) with `color + 22` background and
// `color + 66` hairline; 6px color dot on the left; 12 / 600 ink label.
// When `severity` is set, appends a mono caps badge with `color + 55`
// border and card-bg fill.

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    color: string;
    label: string;
    /** Optional severity ("SEVERE", "MILD"). Renders as a mono caps
     *  badge to the right of the label. */
    severity?: string;
};

export function HealthChip({ color, label, severity }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: withAlpha(color, 0x22 / 255),
                    borderColor: withAlpha(color, 0x66 / 255),
                },
            ]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <ThemedText style={[styles.label, { color: colors.text }]}>
                {label}
            </ThemedText>
            {severity ? (
                <View
                    style={[
                        styles.severity,
                        {
                            backgroundColor: colors.backgroundElement,
                            borderColor: withAlpha(color, 0x55 / 255),
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.severityText,
                            {
                                color,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        {severity}
                    </ThemedText>
                </View>
            ) : null}
        </View>
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
        borderWidth: StyleSheet.hairlineWidth,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    severity: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        borderWidth: StyleSheet.hairlineWidth,
    },
    severityText: {
        fontSize: 8.5,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
