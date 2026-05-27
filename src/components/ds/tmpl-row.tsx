// TmplRow — template radio row used in CreateList's "Start from"
// section. Shows a title + subtitle + optional badge + radio bubble.
// Selected row gets a soft accent tint.
//
// Design source: `screens-creation.jsx::TmplRow` (~line 573).
//
// Layout: 13/14 padding, hairline divider unless `last`, accent tint
// when selected, optional caps mono badge ("POPULAR") in accent next
// to the title.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { RadioBubble } from '@/components/task/radio-bubble';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    title: string;
    sub?: string;
    /** Optional caps mono badge — e.g. "POPULAR". */
    badge?: string;
    selected: boolean;
    last?: boolean;
    onPress?: () => void;
    disabled?: boolean;
};

export function TmplRow({
    title,
    sub,
    badge,
    selected,
    last = false,
    onPress,
    disabled = false,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const body = (
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
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <ThemedText
                        style={[styles.title, { color: colors.text }]}>
                        {title}
                    </ThemedText>
                    {badge ? (
                        <View
                            style={[
                                styles.badge,
                                {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0x18 / 255,
                                    ),
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.badgeText,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {badge}
                            </ThemedText>
                        </View>
                    ) : null}
                </View>
                {sub ? (
                    <ThemedText
                        style={[
                            styles.sub,
                            { color: colors.inkFaint },
                        ]}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            <RadioBubble
                selected={selected}
                accentColor={colors.accent}
                onAccentColor={colors.onAccent}
                inactiveColor={colors.inkFaint}
            />
        </View>
    );

    if (!onPress) return body;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={sub ? `${title}, ${sub}` : title}
            accessibilityState={{ checked: selected, disabled }}
            style={({ pressed }) => [pressed && !disabled && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    title: {
        fontSize: 13.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    badge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sub: {
        fontSize: 11,
        lineHeight: 16,
        marginTop: 1,
    },
    pressed: { opacity: 0.7 },
});
