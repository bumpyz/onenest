// FormSwitch — boolean toggle for FormRow value slots.
//
// Design source: `screens-extra-2.jsx::FormSwitch` + spec
// "5 · Form group cards".
//
// We use RN's native <Switch> with theme-aware track + thumb colors so
// the toggle reads as platform-native while still landing in the
// design's accent palette when on. Visually equivalent to the spec's
// 42×24 pill mock without needing a custom thumb implementation.

import { Switch } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    value: boolean;
    onValueChange: (next: boolean) => void;
    disabled?: boolean;
};

export function FormSwitch({ value, onValueChange, disabled = false }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <Switch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{
                false: colors.inkFaint,
                true: colors.accent,
            }}
            // iOS thumb is white by default; Android requires an
            // explicit thumb color to stay white across versions.
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.inkFaint}
        />
    );
}
