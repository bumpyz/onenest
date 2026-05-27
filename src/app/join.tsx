import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { signInWithGoogle } from '@/lib/auth';
import {
    acceptInvitation,
    getInvitationPreview,
    type InvitationPreview,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function JoinScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ token?: string | string[] }>();
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();

    const [preview, setPreview] = useState<InvitationPreview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => {
        if (!session || !token) return;
        setPreviewLoading(true);
        setPreviewError(null);
        getInvitationPreview(token)
            .then((row) => {
                if (!row) {
                    setPreviewError('This invitation is no longer valid. It may have been used, revoked, or expired.');
                } else {
                    setPreview(row);
                }
            })
            .catch((err: unknown) => {
                setPreviewError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => setPreviewLoading(false));
    }, [session, token]);

    const handleSignIn = async () => {
        setSigningIn(true);
        try {
            // Preserve the current URL (including ?token=...) so we return here after OAuth.
            const redirectTo =
                Platform.OS === 'web' ? window.location.href : undefined;
            await signInWithGoogle({ redirectTo });
        } catch (err) {
            setSigningIn(false);
            const message = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') console.error('Sign-in failed', err);
            else Alert.alert('Sign-in failed', message);
        }
    };

    const handleAccept = async () => {
        if (!token) return;
        setAccepting(true);
        try {
            await acceptInvitation(token);
            router.replace('/');
        } catch (err) {
            setAccepting(false);
            const message = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                setPreviewError(message);
            } else {
                Alert.alert("Couldn't accept invitation", message);
            }
        }
    };

    // No token in the URL.
    if (!token) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Invalid link</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            This URL is missing an invitation token.
                        </ThemedText>
                        <Pressable onPress={() => router.replace('/')} style={styles.linkBtn}>
                            <ThemedText style={{ color: '#1F2940' }}>Go home</ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    if (authLoading) return <LoadingScreen />;

    // Signed-out state: prompt sign-in, preserving the URL.
    if (!session) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="title">You&apos;re invited</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            Sign in to accept your invitation to OneNest.
                        </ThemedText>
                        <Pressable
                            onPress={handleSignIn}
                            disabled={signingIn}
                            style={({ pressed }) => [
                                styles.googleButton,
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText style={styles.googleText}>
                                {signingIn ? 'Opening Google…' : 'Continue with Google'}
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    if (previewLoading) return <LoadingScreen />;

    if (previewError || !preview) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Invitation unavailable</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            {previewError ?? 'Invitation not found.'}
                        </ThemedText>
                        <Pressable onPress={() => router.replace('/')} style={styles.linkBtn}>
                            <ThemedText style={{ color: '#1F2940' }}>Go home</ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.centered}>
                    <ThemedText themeColor="textSecondary" type="small">
                        {preview.inviter_name} invited you to
                    </ThemedText>
                    <ThemedText type="title" style={styles.center}>
                        {preview.household_name}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" type="small" style={styles.center}>
                        on OneNest
                    </ThemedText>

                    <Pressable
                        onPress={handleAccept}
                        disabled={accepting}
                        style={({ pressed }) => [
                            styles.acceptButton,
                            { backgroundColor: '#1F2940' },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.acceptText}>
                            {accepting ? 'Joining…' : 'Accept invitation'}
                        </ThemedText>
                    </Pressable>

                    <Pressable
                        onPress={() => router.replace('/')}
                        disabled={accepting}
                        style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary" type="small">
                            Not now
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
    googleButton: {
        marginTop: Spacing.four,
        minWidth: 240,
        height: 48,
        borderRadius: Spacing.three,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#dadce0',
    },
    googleText: { color: '#3c4043', fontWeight: '500' },
    acceptButton: {
        marginTop: Spacing.four,
        minWidth: 240,
        height: 48,
        borderRadius: Spacing.three,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptText: { color: '#fff', fontWeight: '600' },
    linkBtn: { marginTop: Spacing.two, padding: Spacing.two },
    pressed: { opacity: 0.7 },
});
