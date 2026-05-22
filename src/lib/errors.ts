// Defensive error-to-string. Handles native Error, plain strings, and Supabase-style
// PostgrestError objects ({ message, details, hint, code }). Falls back to JSON so we
// never end up with the dreaded "[object Object]" in the UI.

export function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        const candidate =
            (typeof e.message === 'string' && e.message) ||
            (typeof e.error_description === 'string' && e.error_description) ||
            (typeof e.error === 'string' && e.error) ||
            (typeof e.details === 'string' && e.details) ||
            (typeof e.hint === 'string' && e.hint);
        if (candidate) return candidate;
        try {
            return JSON.stringify(err);
        } catch {
            return '[unknown error]';
        }
    }
    return String(err);
}
