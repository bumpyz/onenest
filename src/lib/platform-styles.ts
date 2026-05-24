// Platform-aware style shims. RN's `shadow*` style props are deprecated on web in
// favor of CSS `boxShadow` — using them produces a "shadow* style props are
// deprecated. Use boxShadow." warning per Pressable per render. Inversely, RN
// native doesn't understand `boxShadow`, so we can't just use the web version
// everywhere. These helpers Platform.select the right shape so each surface
// renders without warnings AND keeps native shadow rendering.
//
// elevation (Android) is included alongside web's boxShadow / native shadow*
// because RN ignores the iOS shadow props for Android — the Material elevation
// prop is what produces the drop shadow there.

import { Platform, type ViewStyle } from 'react-native';

/** FAB-style shadow: deeper drop for an "above the page" floating button. */
export const FAB_SHADOW: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' },
    default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
}) as ViewStyle;

/** Lighter pill / menu shadow: subtle lift for popovers, chooser pills, etc. */
export const PILL_SHADOW: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' },
    default: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
}) as ViewStyle;
