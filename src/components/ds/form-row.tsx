// FormRow — single label / value row used inside a flush FormGroup
// card. Mono right-aligned value, optional chevron, hairline divider
// between rows.
//
// Design source: `screens-extra-2.jsx::FormRow` + spec
// "5 · Form group cards".
//
// Typography:
//   label  — 14 / 500 / -0.2 in ink
//   value  — passed as a string (renders mono right-aligned) or as a
//            node (caller controls styling — used for FormSwitch /
//            badges / multi-line values).
//
// Padding: 13 vertical / 14 horizontal. Hairline divider below unless
// `last` is set.
//
// Tap behavior:
//   onPress + chevron → "opens a picker" affordance (used by Birthday,
//     Pronouns, School, Pediatrician, etc.). Wraps the row in a
//     Pressable.
//   no onPress → static display row (Visibility's "Not applicable"
//     read-only fields, FormSwitch rows).

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    label: string;
    /** String value renders mono right-aligned; node value renders verbatim. */
    value?: React.ReactNode;
    chevron?: boolean;
    /** Hides the bottom hairline — set on the final row of a group. */
    last?: boolean;
    /** Treat the value as muted/placeholder copy (used for "None", "Not
     *  set" affordances). Tints to inkMuted instead of ink. */
    muted?: boolean;
    /** Tints the string value in accent (used for "+ Pick from
     *  contacts" call-to-action rows). Has no effect on node values. */
    accent?: boolean;
    onPress?: () => void;
    disabled?: boolean;
};

export function FormRow({
    label,
    value,
    chevron = false,
    last = false,
    muted = false,
    accent = false,
    onPress,
    disabled = false,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const valueNode =
        typeof value === 'string' ? (
            <ThemedText
                style={[
                    styles.valueText,
                    {
                        color: accent
                            ? colors.accent
                            : muted
                              ? colors.inkFaint
                              : colors.text,
                        fontFamily: FontFamily.monoMedium,
                        fontWeight: accent ? '600' : '500',
                    },
                ]}>
                {value}
            </ThemedText>
        ) : (
            value
        );

    const body = (
        <View
            style={[
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <ThemedText style={[styles.label, { color: colors.text }]}>
                {label}
            </ThemedText>
            {valueNode ? <View>{valueNode}</View> : null}
            {chevron ? (
                <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.inkFaint}
                    style={styles.chev}
                />
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
            style={({ pressed }) => [pressed && !disabled && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    label: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    valueText: {
        fontSize: 13,
        letterSpacing: -0.3,
    },
    chev: { flexShrink: 0 },
    pressed: { opacity: 0.7 },
});
