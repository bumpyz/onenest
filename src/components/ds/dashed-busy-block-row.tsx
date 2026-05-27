// DashedBusyBlockRow — dashed-border row that appears below the 7-day
// bar on the external co-parent strip (#398) when the viewer has busy
// blocks on their paired calendar this week. Dashed signals "this is
// your data, not the household's" so it doesn't visually conflate with
// the household's custody bars above.
//
// Tappable when an onPress is provided — opens the paired calendar's
// busy-block list (existing surface).
//
// Design source: screens-custody-variants.jsx::KidStripDefault busyOverlay
// block (~line 388). Reused by the external strip variant; could be
// generalized later if we surface paired-calendar context elsewhere.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function DashedBusyBlockRow({
    count,
    onPress,
}: {
    /** Busy-block count for the current week. Caller computes this from
     *  the existing useMyExternalEvents hook. Zero hides the row at the
     *  caller — this component assumes count >= 1. */
    count: number;
    /** Optional tap handler. Opens the paired calendar's busy-block
     *  list. Hidden affordance when not provided (pure read-only row). */
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Pluralize honestly. Avoids the "1 busy blocks" awkwardness while
    // keeping the mono caps tone consistent.
    const label =
        count === 1
            ? '1 busy block on your paired calendar this week'
            : `${count} busy blocks on your paired calendar this week`;

    const inner = (
        <View
            style={[
                styles.row,
                {
                    // Border color and stroke pattern match the design's
                    // 0.5px dashed inkFaint. Web renders the dashed
                    // border natively; native falls back to a solid
                    // hairline (RN doesn't support dashed borders
                    // cross-platform — known limitation).
                    borderColor: colors.inkFaint,
                },
            ]}>
            {/* Feather's "square" outline at small scale stands in for
                the design's dashed-square SVG. The row's own dashed
                border carries the "this is your data, not the
                household's" cue; this glyph is a small visual marker
                only. Cleanest swap to avoid pulling react-native-svg
                in for one icon. */}
            <Feather name="square" size={10} color={colors.inkSec} />
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: colors.inkSec,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}
                numberOfLines={1}>
                {label}
            </ThemedText>
        </View>
    );

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={({ pressed }) => [pressed && styles.pressed]}>
                {inner}
            </Pressable>
        );
    }
    return inner;
}

const styles = StyleSheet.create({
    row: {
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        // RN limitation: borderStyle: 'dashed' renders on web + Android
        // but flickers on iOS for borders thinner than 1px. Accept it
        // — at 0.5px the dashed pattern is mostly visual noise anyway;
        // the dashed glyph on the left carries the "external data"
        // signal even if the border falls back to solid on iOS.
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'transparent',
    },
    label: {
        fontSize: 9.5,
        letterSpacing: -0.1,
        flex: 1,
    },
    pressed: { opacity: 0.7 },
});
