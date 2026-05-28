/**
 * Theme tokens — P3 Mist Forest (light) + P4-F Charcoal Forest (dark).
 *
 * This is the matched palette pair from the redesign handoff. The light theme
 * sits on a cool gray page with a sage undertone (#ECEFEC), white cards, and
 * forest-green accent (#2D8B6E). The dark theme is near-black (#15171B) with
 * a brightened forest accent (#3FC198) — the green has to lift on near-black
 * surfaces or it reads muted, so the accent literally changes between modes.
 *
 * Token shape stays back-compatible with the previous theme contract — same
 * keys (text, background, backgroundElement, backgroundInset, backgroundSelected,
 * textSecondary, textOnPastel) so every existing consumer keeps compiling.
 * New tokens (hair, inkSec, inkFaint, accentSoft, sheet, onSheet, warn) are
 * additive and used by the new components shipping in later redesign phases.
 *
 * The accent moves between themes — `Colors.light.accent` vs `Colors.dark.accent`
 * — so new code should reach into `colors[scheme].accent` rather than the
 * static `BrandColors`. BrandColors stays exported for back-compat: every
 * existing call site that pinned to the old navy accent will now show the
 * light-mode forest accent (#2D8B6E). Subsequent migration phases convert
 * those to theme-aware lookups.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

import { CARD_SHADOW, FAB_SHADOW } from '@/lib/platform-styles';

// ─── Brand constants ────────────────────────────────────────────────────────
//
// Static accent + error tokens. Light-mode Mist Forest values. New screens
// should prefer `Colors[scheme].accent` so the accent brightens in dark mode
// per the handoff spec — but the dozens of existing static `BrandColors.accent`
// references stay readable here without an invasive refactor.
export const BrandColors = {
    accent: '#2D8B6E',          // forest green — primary CTAs, FAB, active chips, today marker
    accentMuted: '#828B85',     // muted gray — secondary actions
    error: '#C04A38',           // alert red — destructive actions, errors
    errorBackground: '#F3D9D2', // pale tint of alert — chip backgrounds
    onAccent: '#FFFFFF',        // text/icon on top of accent (light mode)
} as const;

// ─── Theme palettes ─────────────────────────────────────────────────────────
//
// Each palette ships every token a screen could need: surface stack
// (bg / card / inset), ink ramp (text / textSecondary / inkSec / inkFaint),
// hairline borders (hair / hairS at two alpha levels), accent + soft tint +
// onAccent text, alert + soft tint, warn (conflict / overdue), and the
// elevated dark surface (sheet) used for the AI / banner overlays.
//
// Member-color tokens (alex / riley / etc. from the handoff) are intentionally
// NOT here — those live per-row in the database (members.color, children.color),
// and the brightening rule for dark mode ("member colors brighten ~15%") is
// applied at render via a helper in lib/colors.ts. Storing them in theme
// would lock the app to the handoff's example household.

export const Colors = {
    light: {
        // ── P3 Mist Forest ──
        // Body text at ~12:1 against the page bg (well past WCAG AAA).
        text: '#161C18',                // ink — body text
        textSecondary: '#828B85',       // inkMuted — meta, secondary labels
        inkSec: '#4E5750',              // sits between text and textSecondary
        inkFaint: '#BCC4BE',            // chevrons, faintest meta
        background: '#ECEFEC',          // page — cool gray with sage undertone
        backgroundElement: '#FFFFFF',   // card — primary surface
        backgroundInset: '#F3F5F2',     // inset — nested chips, secondary cards
        backgroundSelected: '#CCE5DC',  // accentSoft — pale forest tint for today / selected
        // UX-034: text color on pastel backgrounds (children chips, member-color filled
        // chips). Stays dark in both themes since the pastels are pastel in both.
        textOnPastel: '#161C18',
        // ── New design-system tokens ──
        hair: 'rgba(22,28,24,0.08)',    // hairline borders — 0.5px solid at 8% ink
        hairS: 'rgba(22,28,24,0.04)',   // softer hairline — for nested separations
        accent: '#2D8B6E',              // forest green
        accentSoft: '#CCE5DC',          // pale forest tint
        onAccent: '#FFFFFF',            // white text on forest accent
        alert: '#C04A38',               // destructive red
        alertSoft: '#F3D9D2',           // pale red tint
        warn: '#D8902C',                // conflict / overdue amber
        // Dedicated token for the "both parents present" / 'AB' shared-day
        // state (#379). Renders on CustodyWeekBar segments to communicate
        // togetherness without picking a single parent's identity color.
        // Light: same pale forest tint accentSoft uses (reads well on white).
        // Dark: a deliberately brighter neutral, NOT accentSoft — the original
        // accentSoft `#1F2A26` was too close to backgroundElement `#1F2128`
        // (≈1.5:1 contrast, below WCAG 3:1 for UI elements) so AB days
        // collapsed visually into the card. Audit MEDIUM post-fix finding.
        shared: '#CCE5DC',
        sheet: '#161C18',               // elevated dark surface (AI sheet, banners)
        onSheet: '#FFFFFF',
    },
    dark: {
        // ── P4-F Charcoal Forest ──
        text: '#F0F0F2',
        textSecondary: '#A8AAB2',
        inkSec: '#A8AAB2',
        inkFaint: '#4A4C55',
        background: '#15171B',          // near-black
        backgroundElement: '#1F2128',   // lifted near-black card
        backgroundInset: '#272A33',     // mid-tone inset for nested elements
        backgroundSelected: '#1F2A26',  // dark forest tint for selected
        textOnPastel: '#161C18',        // pastel chips stay pastel in both themes
        // ── New design-system tokens ──
        hair: 'rgba(255,255,255,0.08)',
        hairS: 'rgba(255,255,255,0.04)',
        // Critical dark-mode rule: accent BRIGHTENS in dark so it pops on
        // near-black (#2D8B6E → #3FC198). onAccent flips to dark text since
        // the bright green carries dark glyphs at higher contrast.
        accent: '#3FC198',
        accentSoft: '#1F2A26',
        onAccent: '#0B1310',
        alert: '#FF5C4E',
        alertSoft: '#3A2222',
        warn: '#E8A33C',
        // Brighter neutral (vs. accentSoft `#1F2A26` which was too close to
        // backgroundElement `#1F2128`). Lifts AB bar segments off the card
        // meaningfully — ~3.2:1 contrast against the card, clearing WCAG 3:1.
        shared: '#3A4045',
        sheet: '#0B0C0F',               // even darker than bg
        onSheet: '#FFFFFF',
    },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ─── Typography ─────────────────────────────────────────────────────────────
//
// Redesign uses Geist (sans) + Geist Mono (numerals + meta labels). Both
// bundles load via expo-font in `src/app/_layout.tsx` — see the `useFonts({
// 'Geist-Regular': ..., 'GeistMono-SemiBold': ..., ... })` block. Each weight
// is registered as its own family name because RN can't pick a weight from a
// single family the way CSS does — `fontFamily: 'Geist-SemiBold'` addresses
// the file directly.
//
// Use the `Typography` preset object below in new components. Style objects
// like `Typography.titleHero` carry the exact font family + size + spacing
// the design calls for, so consumers don't need to remember the type scale.
//
// The mono token is referenced by every timestamp, count, badge, and section
// header in the new design — caps + tracking + monospace = Linear / Things-
// tier "this is meta, not body" signal.

/** Raw font-family names. Use the `Typography` presets below in screen code
 *  unless you need a custom combination. */
export const FontFamily = {
    sansRegular: 'Geist-Regular',
    sansMedium: 'Geist-Medium',
    sansSemiBold: 'Geist-SemiBold',
    sansBold: 'Geist-Bold',
    monoRegular: 'GeistMono-Regular',
    monoMedium: 'GeistMono-Medium',
    monoSemiBold: 'GeistMono-SemiBold',
} as const;

/** Legacy `Fonts` shape — kept for back-compat with existing code that
 *  references `Fonts.sans` / `Fonts.mono`. New code should reach for
 *  `Typography` (or `FontFamily` for a specific weight). The web variant
 *  uses the Geist family directly so RN-Web can use fontWeight cascading
 *  if it ever needs to. */
export const Fonts = Platform.select({
    ios: {
        sans: FontFamily.sansRegular,
        serif: 'ui-serif',
        rounded: 'ui-rounded',
        mono: FontFamily.monoRegular,
    },
    default: {
        sans: FontFamily.sansRegular,
        serif: 'serif',
        rounded: 'normal',
        mono: FontFamily.monoRegular,
    },
    web: {
        sans: '"Geist", "Geist-Regular", -apple-system, "Helvetica Neue", system-ui, sans-serif',
        serif: 'var(--font-serif)',
        rounded: 'var(--font-rounded)',
        mono: '"Geist Mono", "GeistMono-Regular", ui-monospace, "SF Mono", monospace',
    },
});

/** Type-scale presets pulled directly from the design handoff. Each preset is
 *  a self-contained style object — spread it into a Text component's style
 *  array and the font family + size + weight + tracking are all set. */
export const Typography = {
    /** 32 / 600 / -1.2 — hero greeting on Home ("Good morning, Alex."). Per
     *  the handoff's exact spec; was 30/-1.0 in an earlier iteration. */
    titleHero: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 32,
        letterSpacing: -1.2,
    },
    /** 22 / 600 / -0.6 — secondary titles (Lists / Settings / Family / Calendar) */
    titleSecondary: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 22,
        letterSpacing: -0.6,
    },
    /** 15 / 600 / -0.2 — primary row label, action button text */
    rowLabel: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 15,
        letterSpacing: -0.2,
    },
    /** 13.5 / 500 / -0.2 — body text inside rows */
    body: {
        fontFamily: FontFamily.sansMedium,
        fontSize: 13.5,
        letterSpacing: -0.2,
    },
    /** 12.5 / 500 — sub-text, captions */
    bodySm: {
        fontFamily: FontFamily.sansMedium,
        fontSize: 12.5,
    },
    /** 11 / 600 / 0.4 / uppercase — caps SANS section headers ("OVERDUE",
     *  "TODAY · TUE 26", "PEOPLE · 4"). Important: design uses **sans** here,
     *  not mono. Mono is reserved for numerals + tag-like meta (counts strips,
     *  timestamps, kbd shortcuts, EXT/LIVE/STALE tags). Section header
     *  copy is normal text styled with caps + tracking, which is a sans
     *  pattern. */
    sectionHeader: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase' as const,
    },
    /** 13 / 600 — primary mono numerals (event start times, counts) */
    mono: {
        fontFamily: FontFamily.monoSemiBold,
        fontSize: 13,
    },
    /** 11 / 500 — secondary mono numerals (event end times, secondary counts) */
    monoSm: {
        fontFamily: FontFamily.monoMedium,
        fontSize: 11,
    },
    /** 9 / 500 — micro-mono for badges and tightly-packed meta */
    monoXs: {
        fontFamily: FontFamily.monoRegular,
        fontSize: 9,
    },
    /** 10 / 600 / 0.4 / uppercase — mono caps sub-labels inside form
     *  sections ("RESPONSIBLE", "FOR CHILD(REN)", "TITLE", DATE / TIME
     *  inside DateTimePickerSheet, ASSIGNED TO / IN LISTS inside
     *  EventTaskSection). Distinct from `sectionHeader` (11pt **sans**) —
     *  this is the *inside-a-card* sub-label vocabulary that uses mono
     *  for that tabular feel. */
    monoCaps: {
        fontFamily: FontFamily.monoSemiBold,
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase' as const,
    },
} as const;

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
// Visual vocabulary every card-like surface pulls from. Three tiers:
//   • page   → document background (under everything else)
//   • card   → primary surface lifted off the page
//   • inset  → nested surface inside a card (event rows in a day card, etc.)
//
// Surfaces.card.fill is a key into Colors[scheme] — resolved at the call site
// so theme switching works automatically.
//
// Don't add a fourth tier without a real use case. Three covers the page →
// card → nested-element hierarchy that matches how users parse the screens.

type SurfaceFill =
    | 'background'
    | 'backgroundElement'
    | 'backgroundInset'
    | 'backgroundSelected';

export type SurfaceToken = {
    /** Corner radius in pixels. */
    radius: number;
    /** Inner padding in pixels. */
    padding: number;
    /** Color key into Colors[scheme]. Resolve via colors[fill] at render. */
    fill: SurfaceFill;
    /** Platform-aware shadow style. */
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
        padding: 14,                    // 14 per the redesign's 4-based scale (was 16)
        fill: 'backgroundElement',
        shadow: CARD_SHADOW,
    },
    inset: {
        radius: 8,
        padding: 12,
        fill: 'backgroundInset',
        shadow: undefined,
    },
} as const satisfies Record<string, SurfaceToken>;

// ─── Elevation tokens ───────────────────────────────────────────────────────
//
// Three steps. The redesign uses shadows sparingly — most lift comes from
// surface tone, not blur. Dark mode usually has shadow:undefined since the
// near-black surfaces already imply depth.

export const Elevation = {
    flat: undefined,
    resting: CARD_SHADOW,
    floating: FAB_SHADOW,
} as const;
