// StatusPill — small mono-caps pill used in hero regions to flag urgency
// or category (DUE TODAY, OVERDUE, HIGH PRIORITY, DONE, FAVORITE, …).
//
// Design source: direction-c-pro.jsx ~1216-1232 — `padding: '3px 9px'`,
// `borderRadius: 999`, background `color + '22'` (≈13% alpha), text in
// the same color, mono `10.5/600/-0.1`. Used by TaskDetail today; will
// be picked up by EventDetail, ChildDetail, ContactDetail (which has its
// own slightly-different CategoryPill that this is poised to replace).

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';

export function StatusPill({
    color,
    label,
}: {
    /** Solid color used for both text and background tint. */
    color: string;
    /** Display string. Rendered as-is — caller decides UPPERCASE vs sentence
     *  case (most call sites upper-case for design parity). */
    label: string;
}) {
    return (
        <View
            style={[
                styles.pill,
                // Exact byte-parity with the design's `color + '22'` hex
                // alpha (0x22 / 255 = 0.1333…). Using the literal divide
                // rather than 0.13 so future contrast audits match what
                // the design renders pixel-for-pixel.
                { backgroundColor: withAlpha(color, 0x22 / 255) },
            ]}>
            <ThemedText
                style={[
                    styles.text,
                    { color, fontFamily: FontFamily.monoSemiBold },
                ]}>
                {label}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
    },
    text: {
        fontSize: 10.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
});
