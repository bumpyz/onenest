/**
 * Theme tokens. Warm slate palette — cream backgrounds, sage cards, slate-blue accents.
 * The accent (#6F7FA5) and error (#B85D52) live as constants below since they're brand
 * colors that read the same in light and dark mode; only background/text shift between modes.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

import { CARD_SHADOW, FAB_SHADOW } from '@/lib/platform-styles';

// Brand constants — used directly in styles where a fixed hue is desired regardless of mode.
export const BrandColors = {
    accent: '#6F7FA5',          // slate blue — primary CTAs, FAB, "today" highlights
    accentMuted: '#8FA3AF',     // dusty blue-gray — secondary actions
    error: '#B85D52',           // warm terracotta — destructive actions, errors
    errorBackground: '#F3D9D3', // pale terracotta — error chip background
    onAccent: '#FFFFFF',        // text/icon on top of accent
} as const;

export const Colors = {
    light: {
        text: '#2A2E3A',              // deep warm slate, not pure black
        background: '#F4EFE2',         // warm cream page background
        backgroundElement: '#E6EBDC',  // pale sage — cards, elevated surfaces
        backgroundSelected: '#D6DCC9', // slightly darker sage — selected/today tint
        textSecondary: '#6F7FA5',      // slate blue — secondary text + member dots
        // UX-034: foreground color for content sitting on a known-pastel surface
        // (children palette chips, member-color filled chips, etc.). Intentionally
        // theme-agnostic: pastel surfaces are pastel in both themes, so the
        // contrasting text must stay dark in both. Reference this token everywhere
        // a chip puts text on a child/member color background rather than
        // hardcoding `#2A2E3A` at the call site.
        textOnPastel: '#2A2E3A',
    },
    dark: {
        text: '#EBE5D5',               // warm cream — matches the light bg color
        background: '#1F232E',          // deep slate
        backgroundElement: '#2A2F3D',   // raised slate
        backgroundSelected: '#363C4C',  // selected slate
        textSecondary: '#A8B5C5',       // muted dusty blue
        // UX-034: see light-theme comment. Pastel chip bg → same dark foreground
        // both themes.
        textOnPastel: '#2A2E3A',
    },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
    ios: {
        sans: 'system-ui',
        serif: 'ui-serif',
        rounded: 'ui-rounded',
        mono: 'ui-monospace',
    },
    default: {
        sans: 'normal',
        serif: 'serif',
        rounded: 'normal',
        mono: 'monospace',
    },
    web: {
        sans: 'var(--font-display)',
        serif: 'var(--font-serif)',
        rounded: 'var(--font-rounded)',
        mono: 'var(--font-mono)',
    },
});

export const Spacing = {
    half: 2,
    one: 4,
    two: 8,
    three: 16,
    four: 24,
    five: 32,
    six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// ─── Surface tokens ─────────────────────────────────────────────────────────
//
// The visual vocabulary every card-like surface in the app should pull from.
// Before this existed, every screen invented its own card geometry — Home's
// summaryCard used Spacing.two radius, WelcomeCard used Spacing.three, Settings
// .card used Spacing.two, and padding was a coin flip between Spacing.three and
// Spacing.four. The result was a UI that read as "consistent-ish" but kept
// generating consistency findings each pass. Codify the vocabulary once.
//
// Three tiers, named for the mental model rather than the depth:
//   • page   → the document itself (the background under everything else)
//   • card   → primary surface lifted off the page (day cards, settings cards)
//   • inset  → secondary surface nested INSIDE a card (event rows inside a
//              day card, etc.). No shadow — leans on the parent card's shadow
//              and uses the page color to read as "deeper" than the card.
//
// `fill` is a key into Colors[scheme], not a literal hex. Resolve at the call
// site so theme switching works:
//
//     const surface = Surfaces.card;
//     <View style={[
//         { backgroundColor: colors[surface.fill], borderRadius: surface.radius,
//           padding: surface.padding },
//         surface.shadow,
//     ]}>
//
// Don't add a fourth tier without a real use case. Three covers the
// page → card → nested-element hierarchy that maps to how users actually parse
// the screens. A fourth would push us toward Material-style elevation theatre.

type SurfaceFill = 'background' | 'backgroundElement' | 'backgroundSelected';

export type SurfaceToken = {
    /** Corner radius in pixels. */
    radius: number;
    /** Inner padding in pixels. Apply uniformly unless the consumer needs to
     *  override (e.g. a card with a colored leading rail uses asymmetric pad). */
    padding: number;
    /** Color key into Colors[scheme]. Resolve via colors[fill] at render. */
    fill: SurfaceFill;
    /** Platform-aware shadow style; spread into the view's style array. */
    shadow: ViewStyle | undefined;
};

export const Surfaces = {
    page: {
        radius: 0,
        padding: Spacing.four,
        fill: 'background',
        shadow: undefined,
    },
    card: {
        radius: 12,
        padding: 16,
        fill: 'backgroundElement',
        shadow: CARD_SHADOW,
    },
    inset: {
        radius: 8,
        padding: 12,
        // Page color inside a card surface → reads as a "well" / inset, not
        // a stacked second card. This is the trick that makes nested rows
        // (event rows inside a day card) feel deeper than their container
        // without needing another shadow.
        fill: 'background',
        shadow: undefined,
    },
} as const satisfies Record<string, SurfaceToken>;

// ─── Elevation tokens ───────────────────────────────────────────────────────
//
// Three steps. Use the named constant, not the underlying shadow:
//   • flat     → no shadow. For nested cards-in-cards (the inset surface).
//   • resting  → primary cards lifted off the page (Surfaces.card uses this).
//   • floating → FAB, popovers, anything that hovers above all content.
//
// If you're tempted to invent a fourth step, you're probably building a
// component that should be one of the existing three. Re-read the comment on
// Surfaces above.

export const Elevation = {
    flat: undefined,
    resting: CARD_SHADOW,
    floating: FAB_SHADOW,
} as const;
