// UX-010: visual hint that a horizontally-scrolling chip strip has more content
// offscreen. We hide native scroll indicators on the chip strips (they're ugly,
// take vertical space, and don't appear at all on iOS without a touch); a small
// right-edge chevron is much lighter and reads instantly.
//
// Usage pattern:
//
//   const overflow = useHorizontalOverflow();
//   return (
//     <View style={{ position: 'relative' }}>
//       <ScrollView
//         horizontal
//         onContentSizeChange={overflow.onContentSizeChange}
//         onLayout={overflow.onLayout}
//         onScroll={overflow.onScroll}
//         scrollEventThrottle={32}
//       >
//         {children}
//       </ScrollView>
//       <ScrollOverflowChevron visible={overflow.showRightIndicator} side="right" />
//     </View>
//   );
//
// The parent must be position:relative for the absolute-positioned chevron to
// land on the right edge of the ScrollView's visible area. The chip strips
// already wrap their ScrollView in a View (or are inside one), so this is
// typically free.

import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

/** Tolerance (px) below which we don't render the indicator. Keeps it from
 *  flickering when content is exactly at the container edge — common with
 *  chips that happen to fit the viewport by a few pixels. */
const OVERFLOW_TOLERANCE = 4;

export type HorizontalOverflowState = {
    onContentSizeChange: (width: number, _height: number) => void;
    onLayout: (e: { nativeEvent: { layout: { width: number } } }) => void;
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    showRightIndicator: boolean;
    /** UX-021: also indicate "scrolled past the start" so users know they can
     *  scroll left. False when scrollX is at the origin. */
    showLeftIndicator: boolean;
};

/**
 * Tracks containerWidth + contentWidth + scrollX for a horizontal ScrollView and
 * computes whether content extends beyond what's currently visible to the right.
 * Wire the returned handlers into the ScrollView's own props so the parent owns
 * its scroll state — this hook is intentionally additive, not a controlled
 * wrapper, so existing chip-strip logic (drag-to-reorder, ref-tracking, etc.)
 * stays untouched.
 */
export function useHorizontalOverflow(): HorizontalOverflowState {
    const [containerWidth, setContainerWidth] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [scrollX, setScrollX] = useState(0);

    const onContentSizeChange = useCallback((width: number) => {
        setContentWidth(width);
    }, []);
    const onLayout = useCallback(
        (e: { nativeEvent: { layout: { width: number } } }) => {
            setContainerWidth(e.nativeEvent.layout.width);
        },
        [],
    );
    const onScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            setScrollX(e.nativeEvent.contentOffset.x);
        },
        [],
    );

    // Right indicator visible when there's meaningful content past the current
    // viewport. Once the user scrolls all the way to the right end, hide it —
    // there's nothing more to discover that way.
    const showRightIndicator =
        contentWidth > containerWidth + OVERFLOW_TOLERANCE &&
        scrollX + containerWidth < contentWidth - OVERFLOW_TOLERANCE;
    // UX-021: same idea for the left edge. Visible whenever the user has
    // scrolled past the origin by a meaningful amount.
    const showLeftIndicator = scrollX > OVERFLOW_TOLERANCE;

    return {
        onContentSizeChange,
        onLayout,
        onScroll,
        showRightIndicator,
        showLeftIndicator,
    };
}

/**
 * Visual hint rendered as an absolutely-positioned chevron at one edge of a
 * horizontally-scrolling container. Render inside the same position:relative
 * parent that holds your ScrollView so the chevron pins to the visible right
 * (or left) edge — NOT the content edge.
 *
 * pointerEvents="none" so taps fall through to the ScrollView underneath.
 */
export function ScrollOverflowChevron({
    visible,
    side = 'right',
}: {
    visible: boolean;
    side?: 'left' | 'right';
}) {
    // UX-015: the indicator's background now matches the surrounding page
    // background (light cream in light theme, deep slate in dark) so the chevron
    // blends with the strip instead of popping as a milky-white square. With
    // ~85% opacity it still subtly fades the chip beneath, but reads as "edge
    // of the scrollable area" rather than a competing UI element.
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    if (!visible) return null;
    return (
        <View
            style={[
                styles.indicator,
                side === 'right' ? styles.right : styles.left,
                // QA-023: safe alpha composition. Was `colors.background + 'D9'`,
                // which silently breaks for any palette value that isn't 7-char
                // `#RRGGBB`. withAlpha normalizes hex / rgb / rgba inputs.
                { backgroundColor: withAlpha(colors.background, 0.85) },
                // RN deprecated the `pointerEvents` prop in favor of the style
                // value. Keeping it on style means taps still fall through to
                // the underlying ScrollView.
                { pointerEvents: 'none' },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <Feather
                name={side === 'right' ? 'chevron-right' : 'chevron-left'}
                size={18}
                color={colors.textSecondary}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    indicator: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
        // Background now applied at render time via the theme. Static style
        // only carries geometry.
    },
    right: { right: 0 },
    left: { left: 0 },
});
