// Phone number live-formatting for input fields.
//
// We're not running libphonenumber-js (~150KB of locale data) for a quick-dial
// directory. The goal is purely cosmetic — make a US number look like one as
// the user types — without breaking international entries.
//
// Strategy: if the user starts with `+`, they're entering an international
// number and we get out of the way (preserve their input verbatim). Otherwise
// we treat the input as US digits and format progressively into the canonical
// `(NXX) NXX-XXXX` layout as they type.
//
// The tel: URI handler used at dial time strips non-digits regardless, so
// formatting here is purely visual — storage + dial paths see whatever the
// user landed on. That means we can be opinionated about display without
// risking incorrect dial behavior.

/**
 * Live-format a phone input string into a US-friendly display form.
 *
 * Behavior:
 *   - Leading `+`: international mode. Return the input unchanged so users
 *     can type whatever country-specific format they want (`+44 20 7946 0958`,
 *     `+33 1 23 45 67 89`, etc.).
 *   - Otherwise: strip non-digits and reformat into the US progressive
 *     pattern. Reformats on every keystroke so the value is always canonical.
 *
 * Patterns (US, non-international):
 *   1–3 digits       → `123`
 *   4–6 digits       → `(123) 4`, `(123) 45`, `(123) 456`
 *   7–10 digits      → `(123) 456-7890`
 *   11 digits w/ 1   → `+1 (234) 567-8901`  (assume country code)
 *   12+ digits       → just the grouped digits (rare; user is probably
 *                       entering an international number without the leading
 *                       `+`, so don't lie about the format).
 *
 * Cursor positioning is not preserved — RN TextInput puts the caret at the
 * end after a controlled-value change, which matches user expectations when
 * typing a phone number left-to-right. Mid-string edits will jump the caret;
 * we accept that as a tradeoff for simpler code.
 */
export function formatPhoneInput(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return '';

    // International escape hatch — user knows what they want.
    if (trimmed.startsWith('+')) {
        // Strip nothing — keep the spaces / dashes / parens they typed.
        return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    if (digits.length <= 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    // 11+ without a leading 1, or 12+ — bail to plain digits rather than
    // forcing an incorrect-looking layout.
    return digits;
}
