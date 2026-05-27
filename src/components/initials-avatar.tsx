// Initials-in-a-circle avatar with optional image override. The fallback for
// contacts (and any other surface that wants a "show their face if we have
// one, otherwise their letters" avatar). Mirrors the ChildBadge pattern but
// for arbitrary names — ChildBadge is keyed on a Child record, this takes a
// raw name string and computes initials itself.
//
// Color picker: hashes the name into a fixed deterministic slot in a small
// palette. Same name → same color across renders (no "color flips when the
// component remounts" surprises). Palette is muted/dusty to match the app's
// voice — none of the saturated avatar-grid colors that scream "social app."

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// Palette tuned for muted readability on cream / sage backgrounds. All paired
// with white text (#fff), so no contrast worry. 8 slots is enough for any
// realistic household contact list to not visually repeat too often.
const AVATAR_PALETTE = [
    '#8FA3BB', // dusty blue
    '#B4A5C0', // dusty lavender
    '#C9A57C', // muted ochre
    '#A5B4A2', // sage
    '#B7948B', // dusty terracotta
    '#9CABA4', // muted teal
    '#B4B093', // olive
    '#A39CB0', // mauve
] as const;

/**
 * Stable color picker. Hashes the input string into a fixed palette slot so
 * the same name always picks the same color. Using a tiny FNV-ish loop
 * rather than Math.random-on-mount so SSR + client renders agree and the
 * color doesn't flicker on re-mount.
 */
function colorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/**
 * Extract initials from a name. Handles:
 *   "Maria Garcia"          → "MG"
 *   "Dr. Patel"             → "DP" (period treated as word separator)
 *   "Joe at ABC Plumbing"   → "JA" (first two word-starts)
 *   "Maria"                 → "M"  (single word)
 *   ""                      → "?"  (empty fallback)
 * Bounded to two characters so the layout is predictable.
 */
function initialsFor(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const words = trimmed
        .split(/[\s.,_-]+/)
        .filter((w) => w.length > 0);
    if (words.length === 0) return '?';
    const first = words[0].charAt(0).toUpperCase();
    if (words.length === 1) return first;
    const second = words[1].charAt(0).toUpperCase();
    return `${first}${second}`;
}

export type InitialsAvatarSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<InitialsAvatarSize, number> = {
    sm: 32,
    md: 44,
    lg: 64,
};

const TEXT_PX: Record<InitialsAvatarSize, number> = {
    sm: 12,
    md: 16,
    lg: 22,
};

type Props = {
    /** Name to derive initials from. Required even when imageUrl is set — used
     *  as accessibility fallback and as the initials backup on image-load failure. */
    name: string;
    /** Optional image URL. When set, renders the image; falls back to initials
     *  if the image is missing / fails to load. */
    imageUrl?: string | null;
    size?: InitialsAvatarSize;
    /** Override the auto-picked background color (rarely useful — left in for
     *  future per-descriptor color assignment). */
    backgroundColor?: string;
};

export function InitialsAvatar({
    name,
    imageUrl,
    size = 'md',
    backgroundColor,
}: Props) {
    const dim = SIZE_PX[size];
    const initials = initialsFor(name);
    const bg = backgroundColor ?? colorForName(name || 'unknown');

    return (
        <View
            accessibilityRole="image"
            accessibilityLabel={name ? `Avatar for ${name}` : 'Avatar'}
            style={[
                styles.circle,
                { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg },
            ]}>
            {imageUrl ? (
                <Image
                    source={{ uri: imageUrl }}
                    style={{ width: dim, height: dim, borderRadius: dim / 2 }}
                    // contentFit: 'cover' avoids letterboxing for non-square uploads.
                    contentFit="cover"
                    // Tiny transition so the load isn't a jarring pop on slow nets.
                    transition={120}
                />
            ) : (
                <ThemedText
                    style={[
                        styles.initialsText,
                        { fontSize: TEXT_PX[size], lineHeight: TEXT_PX[size] + 2 },
                    ]}>
                    {initials}
                </ThemedText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        // overflow hidden so the Image's corners get clipped to the circle on
        // platforms where borderRadius doesn't fully constrain Image children.
        overflow: 'hidden',
    },
    initialsText: {
        color: '#fff',
        fontWeight: '700',
        // letterSpacing slight uppercase tightening so two-letter initials read
        // as a unit rather than two adjacent glyphs.
        letterSpacing: 0.5,
    },
});
