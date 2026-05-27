// HairlineDivider — the 0.5px line every grouped-row card in the new design
// uses to separate rows. Pulls from the palette's `hair` token (ink at 8%
// alpha in light, white at 8% in dark), and uses RN's `StyleSheet.hairlineWidth`
// so the line stays crisp on every density.
//
// Use inside cards to separate rows ("Name | Family type | Members" in
// Settings). Don't use between top-level cards — those are separated by
// page-color gaps, not lines.

import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    /** Use the softer `hairS` token for nested separations where a full
     *  hairline would be visually heavy. Default uses `hair`. */
    soft?: boolean;
    /** Horizontal inset from each edge of the parent. Used to indent the
     *  divider so it doesn't bleed into the card's leading icon column
     *  (Settings uses ~16px inset; row content starts ~14px in). */
    insetLeft?: number;
    insetRight?: number;
};

export function HairlineDivider({ soft = false, insetLeft = 0, insetRight = 0 }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.line,
                {
                    backgroundColor: soft ? colors.hairS : colors.hair,
                    marginLeft: insetLeft,
                    marginRight: insetRight,
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    line: {
        height: StyleSheet.hairlineWidth,
    },
});
