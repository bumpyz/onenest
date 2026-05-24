/**
 * Theme tokens. Warm slate palette — cream backgrounds, sage cards, slate-blue accents.
 * The accent (#6F7FA5) and error (#B85D52) live as constants below since they're brand
 * colors that read the same in light and dark mode; only background/text shift between modes.
 */

import '@/global.css';

import { Platform } from 'react-native';

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
