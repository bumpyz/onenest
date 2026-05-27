// Visual identifier for a child: colored circle with their first initial inside.
// Used in the Settings children list, the event form (per-event association coming
// next), and Home / Calendar event blocks.
//
// Why initial + color (vs just color, just initial, or icon): the badge has to read
// instantly at small sizes alongside the parent-color block on an event. Color alone
// fails when two siblings have similar palette neighbors; initial alone fails when
// you're scanning a dense week view. Initial + distinct-from-parents pastel palette
// gives unambiguous identification at any size.

import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { FontFamily } from '@/constants/theme';

type Size = 'sm' | 'md' | 'lg';

type Props = {
    /** The child's display_name; we render only the first character (uppercase). */
    name: string;
    /** Hex #RRGGBB color from migration 0020's palette. */
    color: string;
    /** sm = 16px (calendar block), md = 24px (Home day list), lg = 36px (Settings row). */
    size?: Size;
    style?: StyleProp<ViewStyle>;
};

const DIMENSIONS: Record<Size, { box: number; font: number }> = {
    sm: { box: 16, font: 10 },
    md: { box: 24, font: 12 },
    lg: { box: 36, font: 16 },
};

export function ChildBadge({ name, color, size = 'md', style }: Props) {
    const dims = DIMENSIONS[size];
    const initial = (name.trim().charAt(0) || '?').toUpperCase();
    return (
        <View
            style={[
                styles.badge,
                {
                    width: dims.box,
                    height: dims.box,
                    borderRadius: dims.box / 2,
                    backgroundColor: color,
                },
                style,
            ]}
            // Native a11y hint so screen readers announce "child: Anna" rather than just "A".
            accessibilityRole="image"
            accessibilityLabel={`Child: ${name}`}>
            <Text style={[styles.initial, { fontSize: dims.font } as TextStyle]}>
                {initial}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    initial: {
        // Dark text on the pastel backgrounds reads more reliably than white at small
        // sizes. Stays legible on every CHILDREN_PALETTE color.
        color: '#1A1A1A',
        // fontFamily explicit — raw <Text> doesn't inherit Geist, so without
        // this the initial falls back to the platform system sans (SF Pro /
        // Roboto / system-ui). ChildBadge sits on every event row + calendar
        // block so this is the highest-traffic Geist-leak in the app.
        fontFamily: FontFamily.sansBold,
        fontWeight: '700',
        // Letter-spacing tightens the single character so it visually centers in the circle.
        letterSpacing: 0,
    },
});
