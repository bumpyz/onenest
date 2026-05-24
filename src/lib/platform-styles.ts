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

/**
 * QA-023: safely apply alpha to any CSS color string. Previous call sites
 * used `colors.background + 'D9'` which works for 7-char `#RRGGBB` and
 * silently produces broken strings for `#RGB` shorthand, `rgb(...)`,
 * `rgba(...)`, or named colors. This helper normalizes the most common
 * input shapes to an `rgba(r, g, b, a)` output that RN + RN Web both
 * accept consistently.
 *
 * Supported inputs:
 *   - `#RRGGBB` and `#RGB` hex (alpha overrides any existing 8/4-char alpha)
 *   - `rgb(r, g, b)` and `rgba(r, g, b, a)` (alpha replaces, doesn't multiply)
 *   - Any other string is returned unchanged with a console warning — better
 *     than emitting a garbled value that silently fails CSS validation.
 *
 * `alpha` is clamped to [0, 1].
 */
export function withAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    // Hex form.
    if (color.startsWith('#')) {
        let hex = color.slice(1);
        // Expand 3/4-char shorthand to 6/8.
        if (hex.length === 3 || hex.length === 4) {
            hex = hex
                .split('')
                .map((c) => c + c)
                .join('');
        }
        // Drop existing alpha bytes if present so we control the final alpha.
        if (hex.length === 8) hex = hex.slice(0, 6);
        if (hex.length !== 6) {
            // Unrecognized hex length — return original to avoid silent breakage.
            console.warn(`withAlpha: unexpected hex shape "${color}"`);
            return color;
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) {
            console.warn(`withAlpha: bad hex digits "${color}"`);
            return color;
        }
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    // rgb()/rgba() — extract numeric channels and rebuild with our alpha.
    const m = color.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
        return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
    }
    // Named colors or anything else — best effort: warn and return original.
    console.warn(`withAlpha: unhandled color "${color}"`);
    return color;
}
