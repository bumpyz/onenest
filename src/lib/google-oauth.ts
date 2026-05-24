// Client-side kickoff for the direct Google OAuth flow (replacing the older
// supabase.auth.signInWithOAuth-based flow for calendar pairing). Architecturally a
// mirror of lib/microsoft-oauth.ts.
//
// The reason we don't reuse Supabase Auth here: that flow returns provider tokens but no
// usable refresh exchange — the refresh requires Google's client_secret which only lives
// on Supabase's servers, inaccessible to us. By running our own OAuth client + proxying
// the token endpoint through the google-oauth-proxy edge function, we own the refresh
// path and can keep sync running indefinitely after one pairing.

import * as Crypto from 'expo-crypto';

const STORAGE_VERIFIER_KEY = 'onenest:google-code-verifier';
const STORAGE_STATE_KEY = 'onenest:google-oauth-state';

export const GOOGLE_AUTHORIZATION_ENDPOINT =
    'https://accounts.google.com/o/oauth2/v2/auth';

// We need calendar.readonly to fetch events + openid/email/profile so we can identify
// the connected Google account (matches the email shown in the paired-calendars card).
export const GOOGLE_OAUTH_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.readonly',
];

function base64UrlFromBytes(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    // btoa is available in modern browsers + Hermes; expo-crypto's runtime guarantees it.
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromBase64(b64: string): string {
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCEPair(): Promise<{ verifier: string; challenge: string }> {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const verifier = base64UrlFromBytes(bytes);
    const sha = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
    );
    return { verifier, challenge: base64UrlFromBase64(sha) };
}

export function getGoogleRedirectUri(): string {
    if (typeof window === 'undefined') {
        // Native build would use a custom scheme. For now we only support web.
        return 'onenest://oauth/google';
    }
    return `${window.location.origin}/oauth/google`;
}

/**
 * Web-only kickoff. Generates a PKCE pair + CSRF state, stashes them in sessionStorage
 * (the callback route reads them back), then full-window-redirects to Google's authorize
 * endpoint. The callback lives at /oauth/google.
 *
 * access_type=offline + prompt=consent forces Google to emit a refresh_token on every
 * pairing — without these, repeat connects from the same account may come back with
 * only an access_token. The first-time consent UI is unavoidable; subsequent reconnects
 * after a revoke will also re-show consent.
 */
export async function startGoogleOAuth(clientId: string): Promise<void> {
    if (typeof window === 'undefined') {
        throw new Error('Google OAuth is web-only in this MVP.');
    }
    const { verifier, challenge } = await generatePKCEPair();
    const stateBytes = await Crypto.getRandomBytesAsync(16);
    const state = base64UrlFromBytes(stateBytes);

    window.sessionStorage.setItem(STORAGE_VERIFIER_KEY, verifier);
    window.sessionStorage.setItem(STORAGE_STATE_KEY, state);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: getGoogleRedirectUri(),
        scope: GOOGLE_OAUTH_SCOPES.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
    });

    window.location.href = `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

export function consumeGoogleOAuthState(): { verifier: string; state: string } | null {
    if (typeof window === 'undefined') return null;
    const verifier = window.sessionStorage.getItem(STORAGE_VERIFIER_KEY);
    const state = window.sessionStorage.getItem(STORAGE_STATE_KEY);
    if (!verifier || !state) return null;
    window.sessionStorage.removeItem(STORAGE_VERIFIER_KEY);
    window.sessionStorage.removeItem(STORAGE_STATE_KEY);
    return { verifier, state };
}
