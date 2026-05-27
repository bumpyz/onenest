// CIRow — contact-info row with a leading glyph (phone / mail / map),
// mono right-aligned value, and a mono caps right label. Used in
// CreateContact's "Contact info" section.
//
// Design source: `screens-creation.jsx::CIRow` (~line 396).
//
// Layout: 12/14 padding, 24px glyph column, mono value (flex grows),
// caps mono label hugged to the right. Hairline divider below unless
// `last`.

import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type FeatherName = ComponentProps<typeof Feather>['name'];

type Props = {
    icon: FeatherName;
    /** Caps mono label on the right (e.g. "PHONE", "EMAIL"). */
    label: string;
    value: string;
    onChangeText: (next: string) => void;
    placeholder?: string;
    /** Render the value mono — used for phone numbers / emails where
     *  monospace reads better. Sans for free-text values (Address). */
    mono?: boolean;
    keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
    last?: boolean;
    editable?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    /** Optional override of `FontAwesome`'s name token. Kept around so
     *  future icon swaps don't need to touch every caller. */
    iconColor?: string;
};

export function CIRow({
    icon,
    label,
    value,
    onChangeText,
    placeholder,
    mono = true,
    keyboardType = 'default',
    last = false,
    editable = true,
    autoCapitalize = 'none',
    iconColor,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View style={styles.iconCol}>
                <Feather
                    name={icon}
                    size={14}
                    color={iconColor ?? colors.inkSec}
                />
            </View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.inkFaint}
                editable={editable}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                style={[
                    styles.input,
                    {
                        color: colors.text,
                        fontFamily: mono
                            ? FontFamily.monoMedium
                            : FontFamily.sansRegular,
                    },
                ]}
            />
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: colors.inkFaint,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                {label}
            </ThemedText>
        </View>
    );
}

// Re-export the Feather icon-name token so callers can type-narrow the
// `icon` prop without importing @expo/vector-icons directly.
export type CIRowIconName = FeatherName;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    iconCol: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    input: {
        flex: 1,
        fontSize: 13,
        letterSpacing: -0.2,
        paddingVertical: 0,
        fontWeight: '500',
    },
    label: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        flexShrink: 0,
    },
});
