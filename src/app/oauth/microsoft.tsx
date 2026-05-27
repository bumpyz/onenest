import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { saveMicrosoftCalendarPairing } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import {
    exchangeMicrosoftAuthCode,
    fetchMicrosoftUserEmail,
    syncMicrosoftCalendar,
} from '@/lib/microsoft-calendar';
import {
    consumeMicrosoftOAuthState,
    getRedirectUri,
} from '@/lib/microsoft-oauth';

type Status = 'pending' | 'ok' | 'error';

export default function MicrosoftOAuthCallback() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        code?: string | string[];
        state?: string | string[];
        error?: string | string[];
        error_description?: string | string[];
    }>();

    const [status, setStatus] = useState<Status>('pending');
    const [message, setMessage] = useState<string>('Finishing Microsoft sign-in…');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const code = Array.isArray(params.code) ? params.code[0] : params.code;
            const state = Array.isArray(params.state) ? params.state[0] : params.state;
            const error = Array.isArray(params.error) ? params.error[0] : params.error;
            const errorDescription = Array.isArray(params.error_description)
                ? params.error_description[0]
                : params.error_description;

            if (error) {
                if (cancelled) return;
                setStatus('error');
                setMessage(errorDescription ?? error);
                return;
            }

            if (!code) {
                if (cancelled) return;
                setStatus('error');
                setMessage('No authorization code returned from Microsoft.');
                return;
            }

            const stored = consumeMicrosoftOAuthState();
            if (!stored) {
                setStatus('error');
                setMessage(
                    'Lost the PKCE verifier (maybe a stale or duplicate redirect). Try connecting again.',
                );
                return;
            }
            if (stored.state !== state) {
                setStatus('error');
                setMessage('OAuth state mismatch — possible CSRF. Try connecting again.');
                return;
            }

            const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
            if (!clientId) {
                setStatus('error');
                setMessage(
                    'Missing EXPO_PUBLIC_MICROSOFT_CLIENT_ID. Set it in .env.local and restart the dev server.',
                );
                return;
            }

            try {
                const token = await exchangeMicrosoftAuthCode(
                    clientId,
                    code,
                    stored.verifier,
                    getRedirectUri(),
                );
                const email = await fetchMicrosoftUserEmail(token.access_token);
                const expiresAt = new Date(
                    Date.now() + token.expires_in * 1000,
                ).toISOString();
                const pairing = await saveMicrosoftCalendarPairing({
                    email,
                    accessToken: token.access_token,
                    refreshToken: token.refresh_token ?? null,
                    expiresAt,
                });
                // Kick off an initial sync; not fatal if it fails (user can retry from Settings).
                try {
                    await syncMicrosoftCalendar(pairing);
                } catch (syncErr) {
                    console.warn('Initial Microsoft sync failed', syncErr);
                }
                if (cancelled) return;
                setStatus('ok');
                setMessage(`Connected ${email}. Redirecting…`);
                setTimeout(() => router.replace('/settings'), 800);
            } catch (err) {
                if (cancelled) return;
                console.error('Microsoft OAuth callback failed', err);
                setStatus('error');
                setMessage(errorMessage(err));
            }
        })();

        return () => {
            cancelled = true;
        };
        // params and router are stable references; this should only fire once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (status === 'pending') return <LoadingScreen />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.centered}>
                    <ThemedText type="subtitle">
                        {status === 'ok' ? 'Connected' : "Couldn't finish"}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.center}>
                        {message}
                    </ThemedText>
                    <Pressable
                        onPress={() => router.replace('/settings')}
                        style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
                        <ThemedText style={{ color: '#1F2940', fontWeight: '600' }}>
                            Back to Settings
                        </ThemedText>
                    </Pressable>
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1, padding: Spacing.four, justifyContent: 'center' },
    centered: { alignItems: 'center', gap: Spacing.three },
    center: { textAlign: 'center' },
    linkBtn: { padding: Spacing.two },
    pressed: { opacity: 0.7 },
});
