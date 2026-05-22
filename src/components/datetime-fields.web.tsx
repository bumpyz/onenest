import { Colors, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

// Web variant: raw HTML <input type="date"> / <input type="time">. These have native
// platform pickers in every modern browser, so we get a real calendar / clock UI for free.

type DateProps = {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
};

export function DateField({ value, onChange }: DateProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                color: colors.text,
                background: 'transparent',
                border: `1px solid ${colors.backgroundSelected}`,
                borderRadius: Spacing.two,
                padding: `0 ${Spacing.three}px`,
                fontSize: 16,
                height: 44,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                width: '100%',
            }}
        />
    );
}

type TimeProps = {
    value: string; // HH:mm
    onChange: (value: string) => void;
};

export function TimeField({ value, onChange }: TimeProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                color: colors.text,
                background: 'transparent',
                border: `1px solid ${colors.backgroundSelected}`,
                borderRadius: Spacing.two,
                padding: `0 ${Spacing.three}px`,
                fontSize: 16,
                height: 44,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                width: '100%',
            }}
        />
    );
}
