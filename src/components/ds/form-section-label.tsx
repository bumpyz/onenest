// FormSectionLabel — caps-mono section label above a FormGroup card.
//
// Design source: `screens-extra-2.jsx::FormSectionLabel` + the same
// pattern in `screens-extra.jsx::EDSectionLabel`. Used by EventCreate /
// EventEdit / EventDetail to introduce each grouped card (WHEN / WHO /
// WHERE / ATTACH / NOTES etc.).
//
// Lifted out of `event-form.tsx` so EventDetail (read view) and
// EventCreate (form) share one source. Visually identical to SGroup's
// inline header but standalone so the consuming screen can compose its
// own card body around it (Map preview cards, chip grids, etc.).
//
// Typography: 11 / 600 / 0.4 letter-spacing / uppercase, color inkSec.
// Padding: left 12 (Spacing.three), top 12, bottom 4 (Spacing.one).

import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function FormSectionLabel({ children }: { children: string }) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <ThemedText
            style={[styles.label, { color: colors.inkSec }]}>
            {children}
        </ThemedText>
    );
}

const styles = StyleSheet.create({
    label: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        paddingLeft: Spacing.three,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.one,
    },
});
