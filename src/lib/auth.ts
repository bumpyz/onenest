import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Closes any in-app browser left over from a previous OAuth attempt.
WebBrowser.maybeCompleteAuthSession();

export async function isAppleAuthAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple() {
    const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
    });

    if (!credential.identityToken) {
        throw new Error('Apple sign in did not return an identity token.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
    });
    if (error) throw error;
}

export type SignInOptions = {
    /** Override the post-OAuth redirect URL. Useful for /join?token=... flows so the token survives the bounce. */
    redirectTo?: string;
};

export async function signInWithGoogle(opts: SignInOptions = {}) {
    if (Platform.OS === 'web') {
        // On web, Supabase handles the full redirect cycle and writes the session to localStorage.
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: opts.redirectTo ?? window.location.origin },
        });
        if (error) throw error;
        return;
    }

    // Native: open an in-app browser, then exchange the redirected URL for a session.
    const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'onenest',
        path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Supabase did not return an OAuth URL.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) return;

    const url = new URL(result.url);
    const hash = url.hash.replace(/^#/, '');
    const search = url.search.replace(/^\?/, '');
    const params = new URLSearchParams(hash || search);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
        const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setError) throw setError;
    }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}
