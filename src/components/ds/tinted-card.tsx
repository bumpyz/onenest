// TintedCard — Surfaces.card with an optional translucent accent tint over the
// fill. Used by:
//   • Conflict ribbon on Home (warn-tinted left border, slight warn-bg over the card)
//   • Selected day in Calendar month (accent-tinted card)
//   • Child Detail hero (tinted in child's color)
//   • List Detail top region (tinted in list's color)
//
// The tint compositing rule: a translucent rectangle (12% alpha in light, 22%
// in dark per the redesign's tinted-overlay spec) sits over the card fill.
// Leading rail (4px column) is the un-translucent version of the tint color
// for a stronger identity signal — same pattern as the day-card custodian rail.

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Surfaces } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    children: ReactNode;
    /** Hex color the card should tint with. Pass the member/child/list/accent
     *  color here. Omit for an un-tinted card (equivalent to a plain Surfaces.card). */
    tint?: string;
    /** Render a 4px leading rail in the tint color. On by default when `tint`
     *  is provided. Pass false for tinted cards without a rail (e.g. month
     *  selected-day cell). */
    rail?: boolean;
    /** Override the card's outer style (margin, alignment, etc.) — DON'T touch
     *  radius / shadow / fill here, those come from Surfaces.card. */
    style?: ViewStyle;
};

export function TintedCard({ children, tint, rail = true, style }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const surface = Surfaces.card;
    const isDark = scheme === 'dark';
    // Tinted-overlay alpha — 12% in light, 22% in dark, matching the handoff's
    // "tinted backgrounds bump alpha in dark mode" rule.
    const tintAlpha = isDark ? 0.22 : 0.12;
    return (
        <View
            style={[
                styles.outer,
                {
                    backgroundColor: colors[surface.fill],
                    borderRadius: surface.radius,
                },
                surface.shadow,
                style,
            ]}>
            {tint && rail ? (
                <View
                    style={[
                        styles.rail,
                        {
                            backgroundColor: tint,
                            borderTopLeftRadius: surface.radius,
                            borderBottomLeftRadius: surface.radius,
                            pointerEvents: 'none',
                        },
                    ]}
                />
            ) : null}
            {tint ? (
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: withAlpha(tint, tintAlpha),
                            borderRadius: surface.radius,
                            pointerEvents: 'none',
                        },
                    ]}
                />
            ) : null}
            <View
                style={[
                    styles.body,
                    {
                        paddingLeft: tint && rail ? surface.padding + 4 : surface.padding,
                        paddingRight: surface.padding,
                        paddingVertical: surface.padding,
                    },
                ]}>
                {children}
            </View>
        </View>
    );
}

const RAIL_WIDTH = 4;

const styles = StyleSheet.create({
    outer: {
        overflow: 'hidden',
        position: 'relative',
    },
    rail: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: RAIL_WIDTH,
        zIndex: 1,
    },
    body: {
        position: 'relative',
        zIndex: 2,
    },
});
