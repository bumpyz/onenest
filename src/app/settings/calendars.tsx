// Connected calendars — Phase 6.6.3 sub-route.
//
// Extracted from the legacy "Paired calendars" SettingsSection. Same
// behavior + same handlers — only the chrome changed. Users land here
// from Family Hub's Manage card → "Connected calendars" row (wired in
// 6.6.7) or from a direct /settings/calendars deep link.
//
// State + handlers (connect / sync / disconnect / reconnect) live here
// rather than in (app)/settings.tsx now — the page reads + edits its own
// calendars list via useExternalCalendars.

import { format } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useExternalCalendars } from '@/hooks/use-external-calendars';
import { useHouseholds } from '@/hooks/use-households';
import {
    disconnectExternalCalendar,
    type ExternalCalendar,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { GoogleAuthError, syncGoogleCalendar } from '@/lib/google-calendar';
import { startGoogleOAuth } from '@/lib/google-oauth';
import { MicrosoftAuthError, syncMicrosoftCalendar } from '@/lib/microsoft-calendar';
import { startMicrosoftOAuth } from '@/lib/microsoft-oauth';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function ConnectedCalendarsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const {
        calendars: externalCalendars,
        isLoading: calendarsLoading,
        refetch: refetchExternalCalendars,
    } = useExternalCalendars();

    const [connectingGoogle, setConnectingGoogle] = useState(false);
    const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
    const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null);
    const [externalCalendarError, setExternalCalendarError] = useState<string | null>(
        null,
    );

    const microsoftClientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '';
    const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID ?? '';

    const handleConnectGoogleCalendar = useCallback(async () => {
        if (!googleClientId) {
            setExternalCalendarError(
                'EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID is not set. Add it to .env.local and restart the dev server.',
            );
            return;
        }
        setConnectingGoogle(true);
        setExternalCalendarError(null);
        try {
            await startGoogleOAuth(googleClientId);
            // Browser is about to redirect; no need to clear connectingGoogle.
        } catch (err) {
            setConnectingGoogle(false);
            setExternalCalendarError(errorMessage(err));
        }
    }, [googleClientId]);

    const handleConnectMicrosoftCalendar = useCallback(async () => {
        if (!microsoftClientId) {
            setExternalCalendarError(
                'EXPO_PUBLIC_MICROSOFT_CLIENT_ID is not set. Register an Azure SPA app and add the client ID to .env.local, then restart the dev server.',
            );
            return;
        }
        setConnectingMicrosoft(true);
        setExternalCalendarError(null);
        try {
            await startMicrosoftOAuth(microsoftClientId);
        } catch (err) {
            setConnectingMicrosoft(false);
            setExternalCalendarError(errorMessage(err));
        }
    }, [microsoftClientId]);

    const handleSyncCalendar = useCallback(
        async (cal: ExternalCalendar) => {
            setSyncingCalendarId(cal.id);
            setExternalCalendarError(null);
            try {
                if (cal.provider === 'google') {
                    await syncGoogleCalendar(cal);
                } else if (cal.provider === 'microsoft') {
                    await syncMicrosoftCalendar(cal);
                } else {
                    throw new Error(`Unknown calendar provider: ${cal.provider}`);
                }
                await refetchExternalCalendars();
            } catch (err) {
                if (err instanceof GoogleAuthError) {
                    setExternalCalendarError(
                        'Google access expired. Click "Reconnect" to refresh access.',
                    );
                } else if (err instanceof MicrosoftAuthError) {
                    setExternalCalendarError(
                        'Microsoft access expired and refresh failed. Click "Reconnect" to grant access again.',
                    );
                } else {
                    console.error('sync failed', err);
                    setExternalCalendarError(errorMessage(err));
                }
            } finally {
                setSyncingCalendarId(null);
            }
        },
        [refetchExternalCalendars],
    );

    const reconnectHandlerFor = useCallback(
        (cal: ExternalCalendar): (() => Promise<void>) => {
            if (cal.provider === 'microsoft') return handleConnectMicrosoftCalendar;
            return handleConnectGoogleCalendar;
        },
        [handleConnectMicrosoftCalendar, handleConnectGoogleCalendar],
    );

    const handleDisconnectCalendar = useCallback(
        async (cal: ExternalCalendar) => {
            const doDisconnect = async () => {
                try {
                    await disconnectExternalCalendar(cal.id);
                    await refetchExternalCalendars();
                } catch (err) {
                    console.error('disconnectExternalCalendar failed', err);
                    setExternalCalendarError(errorMessage(err));
                }
            };
            if (Platform.OS === 'web') {
                const ok =
                    typeof window !== 'undefined' &&
                    window.confirm(
                        `Disconnect ${cal.external_account_email}? Synced events will be removed.`,
                    );
                if (ok) await doDisconnect();
            } else {
                Alert.alert(
                    'Disconnect calendar?',
                    `Removes ${cal.external_account_email} and its synced events.`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Disconnect',
                            style: 'destructive',
                            onPress: doDisconnect,
                        },
                    ],
                );
            }
        },
        [refetchExternalCalendars],
    );

    if (authLoading || householdsLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View
                    style={[styles.topBar, { borderBottomColor: colors.hair }]}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.topBarIconBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="chevron-left" size={14} color={colors.text} />
                    </Pressable>
                    <ThemedText
                        style={[styles.topBarTitle, { color: colors.text }]}>
                        Connected calendars
                    </ThemedText>
                    {/* Right slot kept as an invisible spacer so the title stays centered. */}
                    <View style={styles.topBarIconBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Sub-header copy. Lives outside the card so the
                        first card sits flush to the top of its row. */}
                    <ThemedText
                        themeColor="textSecondary"
                        type="small"
                        style={styles.subHeader}>
                        Connect your personal calendars so busy times show up here. Event
                        details stay private — your co-parent only sees that you're busy.
                    </ThemedText>

                    {calendarsLoading && !externalCalendars ? (
                        <View style={styles.empty}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Loading…
                            </ThemedText>
                        </View>
                    ) : externalCalendars && externalCalendars.length > 0 ? (
                        <View style={styles.calList}>
                            {externalCalendars.map((cal) => {
                                const isSyncing = syncingCalendarId === cal.id;
                                return (
                                    <View
                                        key={cal.id}
                                        style={[
                                            styles.calCard,
                                            {
                                                backgroundColor: colors.backgroundElement,
                                                borderColor: colors.hair,
                                            },
                                        ]}>
                                        <ThemedText type="smallBold">
                                            {cal.provider === 'google'
                                                ? 'Google Calendar'
                                                : 'Microsoft Calendar'}
                                        </ThemedText>
                                        <ThemedText
                                            themeColor="textSecondary"
                                            type="small">
                                            {cal.external_account_email}
                                        </ThemedText>
                                        <ThemedText
                                            style={[
                                                styles.calMeta,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily: FontFamily.monoMedium,
                                                },
                                            ]}>
                                            {cal.last_synced_at
                                                ? `Last synced ${format(new Date(cal.last_synced_at), 'MMM d, h:mm a')}`
                                                : 'Not yet synced'}
                                        </ThemedText>
                                        <View style={styles.calActions}>
                                            {/* Destructive on the left, primary on
                                                the right — same vocabulary as the
                                                pre-extraction Settings flow. */}
                                            <Pressable
                                                onPress={() =>
                                                    handleDisconnectCalendar(cal)
                                                }
                                                disabled={isSyncing}
                                                style={({ pressed }) => [
                                                    styles.calBtn,
                                                    {
                                                        borderColor:
                                                            colors.backgroundSelected,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{
                                                        color: BrandColors.error,
                                                        fontWeight: '500',
                                                    }}>
                                                    Disconnect
                                                </ThemedText>
                                            </Pressable>
                                            <Pressable
                                                onPress={reconnectHandlerFor(cal)}
                                                disabled={
                                                    isSyncing ||
                                                    connectingGoogle ||
                                                    connectingMicrosoft
                                                }
                                                style={({ pressed }) => [
                                                    styles.calBtn,
                                                    {
                                                        borderColor:
                                                            colors.backgroundSelected,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{
                                                        color: colors.accent,
                                                        fontWeight: '500',
                                                    }}>
                                                    Reconnect
                                                </ThemedText>
                                            </Pressable>
                                            <Pressable
                                                onPress={() => handleSyncCalendar(cal)}
                                                disabled={isSyncing}
                                                style={({ pressed }) => [
                                                    styles.calBtn,
                                                    {
                                                        borderColor:
                                                            colors.backgroundSelected,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{
                                                        color: colors.accent,
                                                        fontWeight: '500',
                                                    }}>
                                                    {isSyncing ? 'Syncing…' : 'Sync now'}
                                                </ThemedText>
                                            </Pressable>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : null}

                    {/* Connect buttons — always visible so users can add a
                        second provider. */}
                    <View style={styles.connectRow}>
                        <Pressable
                            onPress={handleConnectGoogleCalendar}
                            disabled={
                                connectingGoogle ||
                                connectingMicrosoft ||
                                !googleClientId
                            }
                            style={({ pressed }) => [
                                styles.primaryBtn,
                                {
                                    backgroundColor:
                                        connectingGoogle ||
                                        connectingMicrosoft ||
                                        !googleClientId
                                            ? colors.backgroundSelected
                                            : colors.accent,
                                },
                                pressed &&
                                    googleClientId &&
                                    !connectingGoogle &&
                                    !connectingMicrosoft &&
                                    styles.pressed,
                            ]}>
                            <ThemedText
                                style={{
                                    color:
                                        connectingGoogle ||
                                        connectingMicrosoft ||
                                        !googleClientId
                                            ? colors.textSecondary
                                            : colors.onAccent,
                                    fontWeight: '600',
                                }}>
                                {connectingGoogle ? 'Opening Google…' : 'Connect Google'}
                            </ThemedText>
                        </Pressable>
                        <Pressable
                            onPress={handleConnectMicrosoftCalendar}
                            disabled={
                                connectingGoogle ||
                                connectingMicrosoft ||
                                !microsoftClientId
                            }
                            style={({ pressed }) => [
                                styles.primaryBtn,
                                {
                                    backgroundColor:
                                        connectingGoogle ||
                                        connectingMicrosoft ||
                                        !microsoftClientId
                                            ? colors.backgroundSelected
                                            : colors.accent,
                                },
                                pressed &&
                                    microsoftClientId &&
                                    !connectingGoogle &&
                                    !connectingMicrosoft &&
                                    styles.pressed,
                            ]}>
                            <ThemedText
                                style={{
                                    color:
                                        connectingGoogle ||
                                        connectingMicrosoft ||
                                        !microsoftClientId
                                            ? colors.textSecondary
                                            : colors.onAccent,
                                    fontWeight: '600',
                                }}>
                                {connectingMicrosoft
                                    ? 'Opening Microsoft…'
                                    : 'Connect Microsoft (Outlook)'}
                            </ThemedText>
                        </Pressable>
                    </View>

                    {!googleClientId ? (
                        <ThemedText type="small" themeColor="textSecondary">
                            Google is unavailable: EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID not
                            set.
                        </ThemedText>
                    ) : null}
                    {!microsoftClientId ? (
                        <ThemedText type="small" themeColor="textSecondary">
                            Microsoft is unavailable: EXPO_PUBLIC_MICROSOFT_CLIENT_ID not
                            set.
                        </ThemedText>
                    ) : null}

                    {externalCalendarError ? (
                        <ThemedText
                            type="small"
                            style={{ color: BrandColors.error }}>
                            {externalCalendarError}
                        </ThemedText>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        gap: Spacing.two,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: { ...Typography.titleSecondary, fontSize: 22 },

    scroll: { padding: Spacing.four, gap: Spacing.three },
    subHeader: { lineHeight: 18 },

    empty: { padding: Spacing.six, alignItems: 'center', gap: Spacing.two },

    calList: { gap: Spacing.three },
    calCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: Spacing.three,
        gap: 2,
    },
    calMeta: { fontSize: 11, marginTop: 2 },
    calActions: {
        flexDirection: 'row',
        gap: Spacing.two,
        marginTop: Spacing.two,
        flexWrap: 'wrap',
    },
    calBtn: {
        paddingVertical: Spacing.one + 2,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },

    connectRow: { gap: Spacing.two },
    primaryBtn: {
        paddingVertical: Spacing.three,
        paddingHorizontal: Spacing.four,
        borderRadius: Spacing.two,
        alignItems: 'center',
    },

    pressed: { opacity: 0.7 },
});
