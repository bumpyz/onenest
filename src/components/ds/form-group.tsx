// FormGroup — rounded-12 hairline-bordered card used to group form rows
// or read-mode meta rows under a FormSectionLabel.
//
// Design source: `screens-extra-2.jsx::FormGroup` + the same
// vocabulary in `screens-extra.jsx::EDRow` containers. Used app-wide
// for the WHEN / WHO / WHERE / ATTACH section bodies on EventCreate
// AND for the Who / For / Location / etc. SGroup bodies on EventDetail.
//
// Lifted out of `event-form.tsx` so the read view + form share one
// container. Distinct from SGroup (which owns its own header label) —
// FormGroup is JUST the card body, so callers can compose section
// headers + accessory actions ("+ ATTACH ANOTHER", "EDIT →", etc.) in
// the parent layout without fighting the group's padding.
//
// Card: backgroundElement bg, hairline border, radius 12, padding 12
// (Spacing.three), gap defaults to 12 between children.

import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function FormGroup({
    children,
    gap,
    flush = false,
}: {
    children: React.ReactNode;
    /** Override the default 12px gap between children. Pass 0 for flush
     *  rows (e.g. SRow groups that draw their own hairline dividers). */
    gap?: number;
    /** Drop the card's internal padding entirely so FormRow consumers
     *  can render full-width hairline-separated rows. Used by the v2
     *  creation flows where each FormRow owns its own 13/14 padding —
     *  the canonical spec's FormGroup has no internal padding. */
    flush?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.group,
                flush ? styles.flush : styles.padded,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                    gap: flush ? 0 : (gap ?? Spacing.three),
                },
            ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    group: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    padded: {
        padding: Spacing.three,
    },
    flush: {
        padding: 0,
    },
});
