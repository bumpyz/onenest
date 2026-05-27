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

/**
 * Blur the currently-focused DOM element on web. No-op on native.
 *
 * Use before calling `router.push` / `router.back` / opening a Modal so the
 * focused button doesn't end up inside the previous screen's aria-hidden
 * subtree (Chromium blocks aria-hidden on a focused-element ancestor and
 * warns in the console).
 *
 * Why this is needed: Expo Router + react-native-web apply aria-hidden to
 * the leaving screen during navigation, and RN-Web's Modal applies it to
 * the page behind a sheet. The button that triggered the navigation
 * retains focus from the click, and the browser refuses to hide a
 * focused-ancestor subtree from assistive tech. Blurring before the
 * mutation prevents the assertion from firing.
 */
export function blurActiveElement(): void {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const el = document.activeElement;
    if (el && typeof (el as HTMLElement).blur === 'function') {
        (el as HTMLElement).blur();
    }
}

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
 * Bottom-sheet shadow — heavy upward-cast shadow used by every modal sheet
 * (TaskDetail field-edit sheets, QuickCreateSheet, RemoveCaregiverSheet,
 * ActionSheet legacy). The shadow rises UP from the sheet's top edge
 * (negative height) to lift it off the dimmed backdrop. Single layer is
 * sufficient — backdrop dim does most of the depth signal.
 *
 * Native and web use the same depth profile; on web the negative Y
 * translates into a `0 -8px 32px rgba(0,0,0,0.18)` boxShadow.
 */
export const SHEET_SHADOW: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.18)' },
    default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.18,
        shadowRadius: 32,
        elevation: 20,
    },
}) as ViewStyle;

/**
 * Small toggle / knob shadow — for the slider knob inside the Auto-assign
 * toggle in AssignSheet, and any future on/off switch primitives. Tight
 * close shadow so the knob reads as "on top of" the track without lifting
 * the whole control off the page.
 */
export const KNOB_SHADOW: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18)' },
    default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
        elevation: 2,
    },
}) as ViewStyle;

/**
 * Heavier FAB shadow used by the Contacts pill — the design's FAB is
 * larger and weightier than the calendar / lists circular FABs, so the
 * shadow needs more drop to keep the "above the page" reading.
 */
export const HEAVY_FAB_SHADOW: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)' },
    default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6,
    },
}) as ViewStyle;

/**
 * Card-resting shadow — the default "lifted off the page" shadow for primary
 * surface cards (Home day cards, Settings cards, etc.). Tuned to clearly read
 * as "floating above the page" rather than "tinted differently from the page."
 * Two-layer composition on web: a tight close shadow gives the immediate edge
 * definition, a broader diffuse shadow gives the depth-of-lift. Native uses a
 * single bumped shadow since RN doesn't compose multiple shadow layers per
 * view (would require nesting wrappers, not worth the perf tradeoff).
 *
 * Bumped from the prior 0.06/0.08 opacity range in v2 because the page
 * background was widened to a deeper cream — cards needed more shadow weight
 * to keep reading as "above" the page rather than "embedded in" it.
 *
 * Part of the surface-token vocabulary (Elevation.resting in theme.ts).
 */
export const CARD_SHADOW: ViewStyle = Platform.select<ViewStyle>({
    web: {
        // V3: outer layer dialed back from 0.10 to 0.08. Page (#DDD3BE) now
        // carries real visual weight against cards (#EEEDEB) on its own —
        // shadow doesn't have to do all the lifting like it did when both
        // surfaces were near-white.
        boxShadow:
            '0 1px 2px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.08)',
    },
    default: {
        shadowColor: '#000',
        shadowOpacity: 0.11,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
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
