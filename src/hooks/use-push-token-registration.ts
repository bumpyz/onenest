import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

/**
 * On the first render where the user is signed in (and we're on a native build, on a real
 * device), requests notification permission, fetches an Expo push token, and persists it to
 * the push_tokens table.
 *
 * Silent no-op on web (Expo's push pipeline doesn't ship to browsers) and on simulators
 * (Device.isDevice is false), so it's safe to mount at the root.
 */
export function usePushTokenRegistration() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;
        if (Platform.OS === 'web') return;
        if (!Device.isDevice) return;

        let cancelled = false;
        (async () => {
            try {
                const existing = await Notifications.getPermissionsAsync();
                let status = existing.status;
                if (status !== 'granted') {
                    const requested = await Notifications.requestPermissionsAsync();
                    status = requested.status;
                }
                if (status !== 'granted') return;

                const tokenResult = await Notifications.getExpoPushTokenAsync();
                if (cancelled) return;
                if (!tokenResult.data) return;

                await registerPushToken(tokenResult.data, Platform.OS);
            } catch (err) {
                // Best-effort — never break auth/onboarding because of push setup.
                console.warn('Push token registration failed', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user]);
}
