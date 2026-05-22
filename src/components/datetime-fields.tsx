import { TextInput, type TextInputProps } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

// Native fallback: plain TextInput with a format hint. Swap in a proper datetime
// picker (e.g. @react-native-community/datetimepicker) before shipping on iOS / Android.

type Props = {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
} & Omit<TextInputProps, 'value' | 'onChange' | 'onChangeText'>;

export function DateField({ value, onChange, ...rest }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={{
                color: colors.text,
                borderColor: colors.backgroundSelected,
                borderWidth: 1,
                borderRadius: Spacing.two,
                paddingHorizontal: Spacing.three,
                paddingVertical: Spacing.two,
                fontSize: 16,
                height: 44,
            }}
            {...rest}
        />
    );
}

type TimeProps = {
    value: string; // HH:mm (24h)
    onChange: (value: string) => void;
} & Omit<TextInputProps, 'value' | 'onChange' | 'onChangeText'>;

export function TimeField({ value, onChange, ...rest }: TimeProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="HH:MM"
            placeholderTextColor={colors.textSecondary}
            style={{
                color: colors.text,
                borderColor: colors.backgroundSelected,
                borderWidth: 1,
                borderRadius: Spacing.two,
                paddingHorizontal: Spacing.three,
                paddingVertical: Spacing.two,
                fontSize: 16,
                height: 44,
            }}
            {...rest}
        />
    );
}
