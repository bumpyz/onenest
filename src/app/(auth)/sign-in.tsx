import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isAppleAuthAvailable, signInWithApple, signInWithGoogle } from '@/lib/auth';

export default function SignInScreen() {
    const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
    const [appleAvailable, setAppleAvailable] = useState(false);

    useEffect(() => {
        isAppleAuthAvailable().then(setAppleAvailable);
    }, []);

    const handleError = (provider: string, error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        // Apple sign-in throws ERR_REQUEST_CANCELED when the user dismisses the sheet; ignore it.
        if (message.includes('ERR_REQUEST_CANCELED') || message.includes('canceled')) return;
        if (Platform.OS === 'web') {
            console.error(`${provider} sign-in failed`, error);
            return;
        }
        Alert.alert(`${provider} sign-in failed`, message);
    };

    const onApple = async () => {
        setBusy('apple');
        try {
            await signInWithApple();
        } catch (error) {
            handleError('Apple', error);
        } finally {
            setBusy(null);
        }
    };

    const onGoogle = async () => {
        setBusy('google');
        try {
            await signInWithGoogle();
        } catch (error) {
            handleError('Google', error);
        } finally {
            setBusy(null);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <ThemedText type="title">OneNest</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                        One shared calendar for the whole family.
                    </ThemedText>
                </View>

                <View style={styles.buttons}>
                    {appleAvailable ? (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                            cornerRadius={Spacing.three}
                            style={styles.appleButton}
                            onPress={onApple}
                        />
                    ) : null}

                    <Pressable
                        onPress={onGoogle}
                        disabled={busy !== null}
                        style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
                        <ThemedText style={styles.googleText}>
                            {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
                        </ThemedText>
                    </Pressable>
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safe: {
        flex: 1,
        paddingHorizontal: Spacing.four,
        justifyContent: 'space-between',
        paddingVertical: Spacing.six,
    },
    header: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.two,
    },
    subtitle: {
        textAlign: 'center',
    },
    buttons: {
        gap: Spacing.three,
    },
    appleButton: {
        height: 48,
    },
    googleButton: {
        height: 48,
        borderRadius: Spacing.three,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#dadce0',
    },
    googleText: {
        color: '#3c4043',
        fontWeight: '500',
    },
    pressed: {
        opacity: 0.7,
    },
});
