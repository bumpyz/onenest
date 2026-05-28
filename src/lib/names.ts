// Tiny helpers for display-name presentation.
//
// Chips, pills, badges, and other compact surfaces across the app
// render only the first word of a member's display_name. This is the
// design convention (mirrors how the canvases set every chip to
// "Alex" / "Riley" not "Alex Henderson") and avoids two-line wrap on
// already-tight surfaces.
//
// Roster lists, settings rows, and notification body copy still use
// the full display_name — those have enough space and the extra
// context helps disambiguate similar names.

/**
 * Returns the first word of a display name, e.g. "Alex Henderson" → "Alex".
 *
 * Falls back to "?" when the input is null/empty so chips never render
 * with a blank label. Splits on any run of whitespace so trailing spaces
 * or multiple spaces don't sneak through.
 *
 * Per design convention we deliberately don't surface "Me" / "You" for
 * the current user inside chips. The chip's color + position already
 * convey ownership; using the actual first name keeps the vocabulary
 * consistent (every chip reads as a person, not a relationship). To
 * surface a "(you)" tag the caller should render it separately.
 */
export function firstNameOf(name: string | null | undefined): string {
    if (!name) return '?';
    const trimmed = name.trim();
    if (trimmed.length === 0) return '?';
    const first = trimmed.split(/\s+/)[0];
    return first && first.length > 0 ? first : trimmed;
}
