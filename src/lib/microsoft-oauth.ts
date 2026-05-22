import * as Crypto from 'expo-crypto';

import {
    MICROSOFT_AUTHORIZATION_ENDPOINT,
    MICROSOFT_SCOPES,
} from './microsoft-calendar';

const STORAGE_VERIFIER_KEY = 'onenest:ms-code-verifier';
const STORAGE_STATE_KEY = 'onenest:ms-oauth-state';

function base64UrlFromBytes(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    // btoa is available in modern browsers + RN Hermes; expo-crypto runtime ensures it.
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

export function getRedirectUri(): string {
    if (typeof window === 'undefined') {
        // Native build would use a custom scheme. For now we only support web for Microsoft.
        return 'onenest://oauth/microsoft';
    }
    return `${window.location.origin}/oauth/microsoft`;
}

/**
 * Web only: kicks off the Microsoft OAuth flow.
 * - Generates PKCE verifier + challenge, plus a random state for CSRF protection
 * - Stashes both in sessionStorage so the callback route can recover them
 * - Redirects the whole window to Microsoft's authorize endpoint
 *
 * The callback lives at /oauth/microsoft and completes the token exchange.
 */
export async function startMicrosoftOAuth(clientId: string): Promise<void> {
    if (typeof window === 'undefined') {
        throw new Error('Microsoft OAuth is web-only in this MVP.');
    }
    const { verifier, challenge } = await generatePKCEPair();
    const stateBytes = await Crypto.getRandomBytesAsync(16);
    const state = base64UrlFromBytes(stateBytes);

    window.sessionStorage.setItem(STORAGE_VERIFIER_KEY, verifier);
    window.sessionStorage.setItem(STORAGE_STATE_KEY, state);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: getRedirectUri(),
        response_mode: 'query',
        scope: MICROSOFT_SCOPES.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        // Always prompt so the user can pick which account (work vs personal Outlook).
        prompt: 'select_account',
    });

    window.location.href = `${MICROSOFT_AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

export function consumeMicrosoftOAuthState(): { verifier: string; state: string } | null {
    if (typeof window === 'undefined') return null;
    const verifier = window.sessionStorage.getItem(STORAGE_VERIFIER_KEY);
    const state = window.sessionStorage.getItem(STORAGE_STATE_KEY);
    if (!verifier || !state) return null;
    window.sessionStorage.removeItem(STORAGE_VERIFIER_KEY);
    window.sessionStorage.removeItem(STORAGE_STATE_KEY);
    return { verifier, state };
}
