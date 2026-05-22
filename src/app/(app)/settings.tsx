import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustodyScheduleSection } from '@/components/custody-schedule-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useExternalCalendars } from '@/hooks/use-external-calendars';
import { Colors, Spacing } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import { usePendingInvitations } from '@/hooks/use-pending-invitations';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PARENT_PALETTE, colorForResponsible, memberColorMap } from '@/lib/colors';
import {
    createInvitation,
    createLocation,
    deleteLocation,
    disconnectExternalCalendar,
    revokeInvitation,
    saveGoogleCalendarPairing,
    updateHouseholdType,
    updateLocation,
    updateMyColor,
    updateMyDisplayName,
    type ExternalCalendar,
    type HouseholdType,
    type Invitation,
    type Location,
} from '@/lib/db';
import { GoogleAuthError, syncGoogleCalendar } from '@/lib/google-calendar';
import { MicrosoftAuthError, syncMicrosoftCalendar } from '@/lib/microsoft-calendar';
import { startMicrosoftOAuth } from '@/lib/microsoft-oauth';
import { HOUSEHOLD_TYPE_OPTIONS, labelForHouseholdType } from '@/lib/household-types';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import {
    useAppColorScheme,
    useThemePreference,
    type ThemePreference,
} from '@/providers/theme-provider';

const APPEARANCE_OPTIONS: ReadonlyArray<{ id: ThemePreference; label: string }> = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
];

function inviteUrlFor(token: string): string {
    if (Platform.OS === 'web') {
        return `${window.location.origin}/join?token=${token}`;
    }
    // TODO: replace with production URL once we have one.
    return `https://onenest.app/join?token=${token}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

export default function SettingsScreen() {
    const { user } = useAuth();
    const scheme = useAppColorScheme();
    const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { households, refetch: refetchHouseholds } = useHouseholds();
    const household = households?.[0];
    const householdType: HouseholdType = household?.household_type ?? 'separated';
    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    const colorMap = memberColorMap(members);
    const myMember = members?.find((m) => m.profile_id === user?.id);
    const myColor = myMember?.color ?? null;

    const { invitations, refetch: refetchInvites } = usePendingInvitations(household?.id);
    const { locations, refetch: refetchLocations } = useLocations(household?.id);
    const { calendars: externalCalendars, refetch: refetchExternalCalendars } = useExternalCalendars();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [savingColor, setSavingColor] = useState<string | null>(null);
    const [colorError, setColorError] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    // Display name editing
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    // Household type editing
    const [editingType, setEditingType] = useState(false);
    const [savingType, setSavingType] = useState(false);
    const [typeError, setTypeError] = useState<string | null>(null);

    // External calendars
    const [connectingGoogle, setConnectingGoogle] = useState(false);
    const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
    const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null);
    const [externalCalendarError, setExternalCalendarError] = useState<string | null>(null);
    const microsoftClientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '';

    const PENDING_CONNECT_KEY = 'onenest:pending-google-calendar-connect';

    // After Supabase OAuth re-auth with calendar.readonly scope, the user lands back on
    // this Settings page with session.provider_token populated. We detect the "pending"
    // flag we set before redirecting and persist the token to external_calendars.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const pending = window.localStorage.getItem(PENDING_CONNECT_KEY);
        if (pending !== 'google') return;
        if (!user) return;

        (async () => {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                const providerToken = sessionData.session?.provider_token;
                const providerRefreshToken = sessionData.session?.provider_refresh_token;
                if (!providerToken) return;
                const email = user.email;
                if (!email) {
                    setExternalCalendarError('Could not determine Google account email.');
                    return;
                }
                // Google access tokens last about 1 hour; we use that as a heuristic.
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                const saved = await saveGoogleCalendarPairing({
                    email,
                    accessToken: providerToken,
                    refreshToken: providerRefreshToken ?? null,
                    expiresAt,
                });
                // Kick off an initial sync so the user sees data immediately.
                try {
                    await syncGoogleCalendar(saved);
                } catch (syncErr) {
                    console.warn('Initial sync after connect failed', syncErr);
                }
                await refetchExternalCalendars();
            } catch (err) {
                console.error('Saving Google Calendar pairing failed', err);
                setExternalCalendarError(errorMessage(err));
            } finally {
                window.localStorage.removeItem(PENDING_CONNECT_KEY);
            }
        })();
    }, [user, refetchExternalCalendars]);

    const handleConnectGoogleCalendar = async () => {
        if (typeof window === 'undefined') return;
        setConnectingGoogle(true);
        setExternalCalendarError(null);
        try {
            window.localStorage.setItem(PENDING_CONNECT_KEY, 'google');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: 'https://www.googleapis.com/auth/calendar.readonly',
                    redirectTo: window.location.href,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) {
                window.localStorage.removeItem(PENDING_CONNECT_KEY);
                throw error;
            }
            // The browser is about to redirect to Google. No need to clear connectingGoogle.
        } catch (err) {
            setConnectingGoogle(false);
            setExternalCalendarError(errorMessage(err));
        }
    };

    const handleSyncCalendar = async (cal: ExternalCalendar) => {
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
    };

    const handleConnectMicrosoftCalendar = async () => {
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
            // Browser is about to redirect.
        } catch (err) {
            setConnectingMicrosoft(false);
            setExternalCalendarError(errorMessage(err));
        }
    };

    const reconnectHandlerFor = (cal: ExternalCalendar): (() => Promise<void>) => {
        if (cal.provider === 'microsoft') return handleConnectMicrosoftCalendar;
        return handleConnectGoogleCalendar;
    };

    const handleDisconnectCalendar = async (cal: ExternalCalendar) => {
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
                window.confirm(`Disconnect ${cal.external_account_email}? Synced events will be removed.`);
            if (ok) await doDisconnect();
        } else {
            Alert.alert(
                'Disconnect calendar?',
                `Removes ${cal.external_account_email} and its synced events.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disconnect', style: 'destructive', onPress: doDisconnect },
                ],
            );
        }
    };

    const onChangeHouseholdType = async (next: HouseholdType) => {
        if (!household || next === householdType) {
            setEditingType(false);
            return;
        }
        setSavingType(true);
        setTypeError(null);
        try {
            await updateHouseholdType(household.id, next);
            await refetchHouseholds();
            setEditingType(false);
        } catch (err) {
            console.error('updateHouseholdType failed', err);
            setTypeError(errorMessage(err));
        } finally {
            setSavingType(false);
        }
    };

    // Locations state
    const [newLocName, setNewLocName] = useState('');
    const [newLocUrl, setNewLocUrl] = useState('');
    const [addingLocation, setAddingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
    const [editLocName, setEditLocName] = useState('');
    const [editLocUrl, setEditLocUrl] = useState('');
    const [savingLocation, setSavingLocation] = useState(false);

    const onAddLocation = async () => {
        if (!household) return;
        const name = newLocName.trim();
        if (!name) {
            setLocationError('Enter a name.');
            return;
        }
        setAddingLocation(true);
        setLocationError(null);
        try {
            await createLocation(household.id, name, newLocUrl.trim() || null);
            setNewLocName('');
            setNewLocUrl('');
            await refetchLocations();
        } catch (err) {
            console.error('createLocation failed', err);
            setLocationError(errorMessage(err));
        } finally {
            setAddingLocation(false);
        }
    };

    const onStartEditLocation = (loc: Location) => {
        setEditingLocationId(loc.id);
        setEditLocName(loc.name);
        setEditLocUrl(loc.google_maps_url ?? '');
        setLocationError(null);
    };

    const onCancelEditLocation = () => {
        setEditingLocationId(null);
        setEditLocName('');
        setEditLocUrl('');
    };

    const onSaveEditLocation = async () => {
        if (!editingLocationId) return;
        const name = editLocName.trim();
        if (!name) {
            setLocationError('Name cannot be empty.');
            return;
        }
        setSavingLocation(true);
        setLocationError(null);
        try {
            await updateLocation(editingLocationId, name, editLocUrl.trim() || null);
            await refetchLocations();
            onCancelEditLocation();
        } catch (err) {
            console.error('updateLocation failed', err);
            setLocationError(errorMessage(err));
        } finally {
            setSavingLocation(false);
        }
    };

    const onDeleteLocation = async (loc: Location) => {
        const doDelete = async () => {
            try {
                await deleteLocation(loc.id);
                await refetchLocations();
            } catch (err) {
                console.error('deleteLocation failed', err);
                setLocationError(errorMessage(err));
            }
        };
        if (Platform.OS === 'web') {
            const ok = typeof window !== 'undefined' && window.confirm(`Delete location "${loc.name}"?`);
            if (ok) await doDelete();
        } else {
            Alert.alert('Delete location?', `Remove "${loc.name}" from saved places.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: doDelete },
            ]);
        }
    };

    const openMaps = (url: string) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url).catch(() => undefined);
        }
    };

    const onInvite = async () => {
        if (!household) return;
        const email = inviteEmail.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setInviteError('Enter a valid email address.');
            return;
        }
        setInviting(true);
        setInviteError(null);
        try {
            await createInvitation(household.id, email);
            setInviteEmail('');
            await refetchInvites();
        } catch (err) {
            console.error('createInvitation failed', err);
            setInviteError(errorMessage(err));
        } finally {
            setInviting(false);
        }
    };

    const onStartEditName = () => {
        setNameInput(myMember?.display_name ?? '');
        setEditingName(true);
        setNameError(null);
    };

    const onCancelEditName = () => {
        setEditingName(false);
        setNameInput('');
        setNameError(null);
    };

    const onSaveName = async () => {
        const trimmed = nameInput.trim();
        if (!trimmed) {
            setNameError('Name cannot be empty.');
            return;
        }
        setSavingName(true);
        setNameError(null);
        try {
            await updateMyDisplayName(trimmed);
            await refetchMembers();
            setEditingName(false);
        } catch (err) {
            console.error('updateMyDisplayName failed', err);
            setNameError(errorMessage(err));
        } finally {
            setSavingName(false);
        }
    };

    const onPickColor = async (color: string) => {
        if (!household || color === myColor) return;
        setSavingColor(color);
        setColorError(null);
        try {
            await updateMyColor(household.id, color);
            await refetchMembers();
        } catch (err) {
            console.error('updateMyColor failed', err);
            setColorError(errorMessage(err));
        } finally {
            setSavingColor(null);
        }
    };

    const onCopy = async (invitation: Invitation) => {
        const url = inviteUrlFor(invitation.token);
        const ok = await copyToClipboard(url);
        if (ok) {
            setCopiedToken(invitation.token);
            setTimeout(() => setCopiedToken((t) => (t === invitation.token ? null : t)), 2000);
        } else if (Platform.OS !== 'web') {
            Alert.alert('Invite link', url);
        }
    };

    const onRevoke = async (invitation: Invitation) => {
        const confirmRevoke = async () => {
            try {
                await revokeInvitation(invitation.id);
                await refetchInvites();
            } catch (err) {
                console.error('revokeInvitation failed', err);
                const msg = errorMessage(err);
                if (Platform.OS === 'web') {
                    setInviteError(msg);
                } else {
                    Alert.alert("Couldn't revoke", msg);
                }
            }
        };
        if (Platform.OS === 'web') {
            const ok = typeof window !== 'undefined' && window.confirm(`Revoke invitation to ${invitation.invited_email}?`);
            if (ok) await confirmRevoke();
        } else {
            Alert.alert(
                'Revoke invitation?',
                `This will invalidate the invite link sent to ${invitation.invited_email}.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Revoke', style: 'destructive', onPress: confirmRevoke },
                ],
            );
        }
    };

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
        flex: 1,
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <ThemedText type="title">Settings</ThemedText>

                    {/* Household */}
                    {household ? (
                        <View style={styles.section}>
                            <ThemedText type="smallBold">Household</ThemedText>
                            <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                                <ThemedText type="smallBold">{household.name}</ThemedText>

                                {/* Household type row */}
                                {editingType ? (
                                    <View style={styles.typeColumn}>
                                        <ThemedText themeColor="textSecondary" type="small">
                                            Who&apos;s in this household?
                                        </ThemedText>
                                        {HOUSEHOLD_TYPE_OPTIONS.map((opt) => {
                                            const selected = householdType === opt.id;
                                            return (
                                                <Pressable
                                                    key={opt.id}
                                                    onPress={() => onChangeHouseholdType(opt.id)}
                                                    disabled={savingType}
                                                    style={({ pressed }) => [
                                                        styles.typeOption,
                                                        {
                                                            borderColor: selected
                                                                ? '#6F7FA5'
                                                                : colors.backgroundSelected,
                                                            backgroundColor: selected
                                                                ? '#6F7FA511'
                                                                : 'transparent',
                                                        },
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <ThemedText type="smallBold">
                                                        {opt.label}
                                                    </ThemedText>
                                                    <ThemedText themeColor="textSecondary" type="small">
                                                        {opt.description}
                                                    </ThemedText>
                                                </Pressable>
                                            );
                                        })}
                                        <Pressable
                                            onPress={() => setEditingType(false)}
                                            disabled={savingType}
                                            style={({ pressed }) => [
                                                styles.secondaryBtn,
                                                {
                                                    borderColor: colors.backgroundSelected,
                                                    alignSelf: 'flex-start',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText themeColor="textSecondary" type="small">
                                                {savingType ? 'Saving…' : 'Done'}
                                            </ThemedText>
                                        </Pressable>
                                        {typeError ? (
                                            <ThemedText type="small" style={styles.errorText}>
                                                {typeError}
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                ) : (
                                    <View style={styles.inviteActions}>
                                        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                                            {labelForHouseholdType(householdType)}
                                        </ThemedText>
                                        <Pressable
                                            onPress={() => setEditingType(true)}
                                            style={({ pressed }) => [
                                                styles.secondaryBtn,
                                                { borderColor: colors.backgroundSelected },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                Change
                                            </ThemedText>
                                        </Pressable>
                                    </View>
                                )}

                                {members?.length ? (
                                    <View style={styles.memberList}>
                                        {members.map((m) => {
                                            const color = colorForResponsible(m.profile_id, colorMap);
                                            const label =
                                                user?.id === m.profile_id ? `${m.display_name} (you)` : m.display_name;
                                            return (
                                                <View key={m.profile_id} style={styles.memberRow}>
                                                    <View
                                                        style={[styles.memberDot, { backgroundColor: color }]}
                                                    />
                                                    <ThemedText type="small">{label}</ThemedText>
                                                    <ThemedText themeColor="textSecondary" type="small">
                                                        · {m.role}
                                                    </ThemedText>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    {/* My color */}
                    {household && myMember ? (
                        <View style={styles.section}>
                            <ThemedText type="smallBold">My color</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                Events you&apos;re responsible for will show in this color.
                            </ThemedText>
                            <View style={styles.swatchRow}>
                                {PARENT_PALETTE.map((c) => {
                                    const selected = myColor === c;
                                    const isSaving = savingColor === c;
                                    return (
                                        <Pressable
                                            key={c}
                                            onPress={() => onPickColor(c)}
                                            disabled={savingColor !== null}
                                            style={({ pressed }) => [
                                                styles.swatch,
                                                {
                                                    backgroundColor: c,
                                                    borderColor: selected ? colors.text : 'transparent',
                                                    opacity: isSaving ? 0.5 : 1,
                                                },
                                                pressed && styles.pressed,
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                            {colorError ? (
                                <ThemedText type="small" style={styles.errorText}>
                                    {colorError}
                                </ThemedText>
                            ) : null}
                        </View>
                    ) : null}

                    {/* Custody schedule — only relevant for separated co-parents. */}
                    {household && user && householdType === 'separated' ? (
                        <CustodyScheduleSection
                            householdId={household.id}
                            members={members ?? []}
                            colorMap={colorMap}
                            currentUserId={user.id}
                        />
                    ) : null}

                    {/* Paired calendars (external sync) */}
                    <View style={styles.section}>
                        <ThemedText type="smallBold">Paired calendars</ThemedText>
                        <ThemedText themeColor="textSecondary" type="small">
                            Connect your personal calendars so busy times show up here. Event details stay private — your co-parent only sees that you&apos;re busy.
                        </ThemedText>

                        {externalCalendars && externalCalendars.length > 0 ? (
                            externalCalendars.map((cal) => {
                                const isSyncing = syncingCalendarId === cal.id;
                                return (
                                    <View
                                        key={cal.id}
                                        style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                                        <ThemedText type="smallBold">
                                            {cal.provider === 'google' ? 'Google Calendar' : 'Microsoft Calendar'}
                                        </ThemedText>
                                        <ThemedText themeColor="textSecondary" type="small">
                                            {cal.external_account_email}
                                        </ThemedText>
                                        <ThemedText themeColor="textSecondary" type="small">
                                            {cal.last_synced_at
                                                ? `Last synced ${format(new Date(cal.last_synced_at), 'MMM d, h:mm a')}`
                                                : 'Not yet synced'}
                                        </ThemedText>
                                        <View style={styles.inviteActions}>
                                            <Pressable
                                                onPress={() => handleSyncCalendar(cal)}
                                                disabled={isSyncing}
                                                style={({ pressed }) => [
                                                    styles.secondaryBtn,
                                                    { borderColor: colors.backgroundSelected },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                    {isSyncing ? 'Syncing…' : 'Sync now'}
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
                                                    styles.secondaryBtn,
                                                    { borderColor: colors.backgroundSelected },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                    Reconnect
                                                </ThemedText>
                                            </Pressable>
                                            <Pressable
                                                onPress={() => handleDisconnectCalendar(cal)}
                                                disabled={isSyncing}
                                                style={({ pressed }) => [
                                                    styles.secondaryBtn,
                                                    { borderColor: colors.backgroundSelected },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{ color: '#B85D52', fontWeight: '600' }}>
                                                    Disconnect
                                                </ThemedText>
                                            </Pressable>
                                        </View>
                                    </View>
                                );
                            })
                        ) : null}

                        {/* Connect buttons — always visible so users can add a second provider. */}
                        <View style={styles.inviteActions}>
                            <Pressable
                                onPress={handleConnectGoogleCalendar}
                                disabled={connectingGoogle || connectingMicrosoft}
                                style={({ pressed }) => [
                                    styles.primaryBtn,
                                    {
                                        backgroundColor:
                                            connectingGoogle || connectingMicrosoft
                                                ? colors.backgroundSelected
                                                : '#6F7FA5',
                                    },
                                    pressed && !connectingGoogle && !connectingMicrosoft && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={{
                                        color:
                                            connectingGoogle || connectingMicrosoft
                                                ? colors.textSecondary
                                                : '#fff',
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
                                                : '#6F7FA5',
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
                                                : '#fff',
                                        fontWeight: '600',
                                    }}>
                                    {connectingMicrosoft
                                        ? 'Opening Microsoft…'
                                        : 'Connect Microsoft (Outlook)'}
                                </ThemedText>
                            </Pressable>
                        </View>
                        {!microsoftClientId ? (
                            <ThemedText type="small" themeColor="textSecondary">
                                Microsoft is unavailable: EXPO_PUBLIC_MICROSOFT_CLIENT_ID not set.
                            </ThemedText>
                        ) : null}

                        {externalCalendarError ? (
                            <ThemedText type="small" style={styles.errorText}>
                                {externalCalendarError}
                            </ThemedText>
                        ) : null}
                    </View>

                    {/* Saved locations */}
                    {household ? (
                        <View style={styles.section}>
                            <ThemedText type="smallBold">Saved locations</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                Places you reuse for events (School, Soccer field, the other parent&apos;s home).
                            </ThemedText>

                            {locations && locations.length > 0 ? (
                                <View style={{ gap: Spacing.two }}>
                                    {locations.map((loc) => {
                                        const isEditing = editingLocationId === loc.id;
                                        return (
                                            <View
                                                key={loc.id}
                                                style={[
                                                    styles.card,
                                                    { backgroundColor: colors.backgroundElement },
                                                ]}>
                                                {isEditing ? (
                                                    <>
                                                        <TextInput
                                                            value={editLocName}
                                                            onChangeText={setEditLocName}
                                                            placeholder="Name"
                                                            placeholderTextColor={colors.textSecondary}
                                                            style={inputStyle}
                                                            editable={!savingLocation}
                                                        />
                                                        <TextInput
                                                            value={editLocUrl}
                                                            onChangeText={setEditLocUrl}
                                                            placeholder="Google Maps link (optional)"
                                                            placeholderTextColor={colors.textSecondary}
                                                            style={inputStyle}
                                                            autoCapitalize="none"
                                                            autoCorrect={false}
                                                            keyboardType="url"
                                                            editable={!savingLocation}
                                                        />
                                                        <View style={styles.inviteActions}>
                                                            <Pressable
                                                                onPress={onSaveEditLocation}
                                                                disabled={savingLocation}
                                                                style={({ pressed }) => [
                                                                    styles.secondaryBtn,
                                                                    { borderColor: colors.backgroundSelected },
                                                                    pressed && styles.pressed,
                                                                ]}>
                                                                <ThemedText
                                                                    type="small"
                                                                    style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                                    {savingLocation ? 'Saving…' : 'Save'}
                                                                </ThemedText>
                                                            </Pressable>
                                                            <Pressable
                                                                onPress={onCancelEditLocation}
                                                                disabled={savingLocation}
                                                                style={({ pressed }) => [
                                                                    styles.secondaryBtn,
                                                                    { borderColor: colors.backgroundSelected },
                                                                    pressed && styles.pressed,
                                                                ]}>
                                                                <ThemedText themeColor="textSecondary" type="small">
                                                                    Cancel
                                                                </ThemedText>
                                                            </Pressable>
                                                        </View>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ThemedText type="smallBold">{loc.name}</ThemedText>
                                                        {loc.google_maps_url ? (
                                                            <Pressable onPress={() => openMaps(loc.google_maps_url!)}>
                                                                <ThemedText
                                                                    type="small"
                                                                    style={{ color: '#6F7FA5' }}
                                                                    numberOfLines={1}>
                                                                    📍 {loc.google_maps_url}
                                                                </ThemedText>
                                                            </Pressable>
                                                        ) : (
                                                            <ThemedText themeColor="textSecondary" type="small">
                                                                No map link
                                                            </ThemedText>
                                                        )}
                                                        <View style={styles.inviteActions}>
                                                            <Pressable
                                                                onPress={() => onStartEditLocation(loc)}
                                                                style={({ pressed }) => [
                                                                    styles.secondaryBtn,
                                                                    { borderColor: colors.backgroundSelected },
                                                                    pressed && styles.pressed,
                                                                ]}>
                                                                <ThemedText
                                                                    type="small"
                                                                    style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                                    Edit
                                                                </ThemedText>
                                                            </Pressable>
                                                            <Pressable
                                                                onPress={() => onDeleteLocation(loc)}
                                                                style={({ pressed }) => [
                                                                    styles.secondaryBtn,
                                                                    { borderColor: colors.backgroundSelected },
                                                                    pressed && styles.pressed,
                                                                ]}>
                                                                <ThemedText
                                                                    type="small"
                                                                    style={{ color: '#B85D52', fontWeight: '600' }}>
                                                                    Delete
                                                                </ThemedText>
                                                            </Pressable>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <ThemedText themeColor="textSecondary" type="small">
                                    No saved locations yet. Add one below, or start typing a new location in any event.
                                </ThemedText>
                            )}

                            <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                                <ThemedText type="smallBold">Add a location</ThemedText>
                                <TextInput
                                    value={newLocName}
                                    onChangeText={setNewLocName}
                                    placeholder="Name (e.g. Soccer field)"
                                    placeholderTextColor={colors.textSecondary}
                                    style={inputStyle}
                                    editable={!addingLocation}
                                />
                                <TextInput
                                    value={newLocUrl}
                                    onChangeText={setNewLocUrl}
                                    placeholder="Google Maps link (optional)"
                                    placeholderTextColor={colors.textSecondary}
                                    style={inputStyle}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                    editable={!addingLocation}
                                />
                                <Pressable
                                    onPress={onAddLocation}
                                    disabled={addingLocation || newLocName.trim().length === 0}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        {
                                            backgroundColor:
                                                addingLocation || newLocName.trim().length === 0
                                                    ? colors.backgroundSelected
                                                    : '#6F7FA5',
                                            alignSelf: 'flex-start',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={{
                                            color:
                                                addingLocation || newLocName.trim().length === 0
                                                    ? colors.textSecondary
                                                    : '#fff',
                                            fontWeight: '600',
                                        }}>
                                        {addingLocation ? 'Adding…' : 'Add'}
                                    </ThemedText>
                                </Pressable>
                            </View>

                            {locationError ? (
                                <ThemedText type="small" style={styles.errorText}>
                                    {locationError}
                                </ThemedText>
                            ) : null}
                        </View>
                    ) : null}

                    {/* Invite section — hidden for single-parent, relabeled for couple. */}
                    {householdType !== 'single_parent' && (
                        <View style={styles.section}>
                        <ThemedText type="smallBold">
                            {householdType === 'couple' ? 'Invite your partner' : 'Invite a co-parent'}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary" type="small">
                            Generate a one-time link. Send it any way you like — they sign in with Google and join your household.
                        </ThemedText>
                        <View style={styles.inviteRow}>
                            <TextInput
                                value={inviteEmail}
                                onChangeText={setInviteEmail}
                                placeholder="coparent@example.com"
                                placeholderTextColor={colors.textSecondary}
                                style={inputStyle}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!inviting}
                            />
                            <Pressable
                                onPress={onInvite}
                                disabled={inviting || inviteEmail.trim().length === 0}
                                style={({ pressed }) => [
                                    styles.primaryBtn,
                                    {
                                        backgroundColor:
                                            inviting || inviteEmail.trim().length === 0
                                                ? colors.backgroundSelected
                                                : '#6F7FA5',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={{
                                        color:
                                            inviting || inviteEmail.trim().length === 0
                                                ? colors.textSecondary
                                                : '#fff',
                                        fontWeight: '600',
                                    }}>
                                    {inviting ? 'Generating…' : 'Generate link'}
                                </ThemedText>
                            </Pressable>
                        </View>
                        {inviteError ? (
                            <ThemedText type="small" style={styles.errorText}>
                                {inviteError}
                            </ThemedText>
                        ) : null}
                    </View>
                    )}

                    {/* Pending invitations — visible only when invites are enabled. */}
                    {householdType !== 'single_parent' && invitations && invitations.length > 0 ? (
                        <View style={styles.section}>
                            <ThemedText type="smallBold">Pending invitations</ThemedText>
                            {invitations.map((invitation) => {
                                const url = inviteUrlFor(invitation.token);
                                const copied = copiedToken === invitation.token;
                                return (
                                    <View
                                        key={invitation.id}
                                        style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                                        <ThemedText type="smallBold">{invitation.invited_email}</ThemedText>
                                        <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                                            {url}
                                        </ThemedText>
                                        <ThemedText themeColor="textSecondary" type="small">
                                            Expires {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                                        </ThemedText>
                                        <View style={styles.inviteActions}>
                                            <Pressable
                                                onPress={() => onCopy(invitation)}
                                                style={({ pressed }) => [
                                                    styles.secondaryBtn,
                                                    { borderColor: colors.backgroundSelected },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText type="small" style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                    {copied ? 'Copied!' : 'Copy link'}
                                                </ThemedText>
                                            </Pressable>
                                            <Pressable
                                                onPress={() => onRevoke(invitation)}
                                                style={({ pressed }) => [
                                                    styles.secondaryBtn,
                                                    { borderColor: colors.backgroundSelected },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <ThemedText
                                                    type="small"
                                                    style={{ color: '#B85D52', fontWeight: '600' }}>
                                                    Revoke
                                                </ThemedText>
                                            </Pressable>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : null}

                    {/* Account */}
                    <View style={styles.section}>
                        <ThemedText type="smallBold">Account</ThemedText>
                        {user ? (
                            <ThemedText themeColor="textSecondary" type="small">
                                Signed in as {user.email ?? user.id}
                            </ThemedText>
                        ) : null}

                        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                            <ThemedText type="smallBold">Display name</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                How your name shows up everywhere — events, custody, the household roster.
                            </ThemedText>
                            {editingName ? (
                                <>
                                    <TextInput
                                        value={nameInput}
                                        onChangeText={setNameInput}
                                        placeholder="Your name"
                                        placeholderTextColor={colors.textSecondary}
                                        style={inputStyle}
                                        autoCapitalize="words"
                                        autoFocus
                                        editable={!savingName}
                                    />
                                    <View style={styles.inviteActions}>
                                        <Pressable
                                            onPress={onSaveName}
                                            disabled={savingName || nameInput.trim().length === 0}
                                            style={({ pressed }) => [
                                                styles.secondaryBtn,
                                                { borderColor: colors.backgroundSelected },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                                {savingName ? 'Saving…' : 'Save'}
                                            </ThemedText>
                                        </Pressable>
                                        <Pressable
                                            onPress={onCancelEditName}
                                            disabled={savingName}
                                            style={({ pressed }) => [
                                                styles.secondaryBtn,
                                                { borderColor: colors.backgroundSelected },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText themeColor="textSecondary" type="small">
                                                Cancel
                                            </ThemedText>
                                        </Pressable>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.inviteActions}>
                                    <ThemedText type="smallBold" style={{ flex: 1 }}>
                                        {myMember?.display_name ?? '—'}
                                    </ThemedText>
                                    <Pressable
                                        onPress={onStartEditName}
                                        style={({ pressed }) => [
                                            styles.secondaryBtn,
                                            { borderColor: colors.backgroundSelected },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                            Edit
                                        </ThemedText>
                                    </Pressable>
                                </View>
                            )}
                            {nameError ? (
                                <ThemedText type="small" style={styles.errorText}>
                                    {nameError}
                                </ThemedText>
                            ) : null}
                        </View>

                        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                            <ThemedText type="smallBold">Appearance</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                Light, dark, or follow your device.
                            </ThemedText>
                            <View style={styles.chipRow}>
                                {APPEARANCE_OPTIONS.map((opt) => {
                                    const selected = themePreference === opt.id;
                                    return (
                                        <Pressable
                                            key={opt.id}
                                            onPress={() => setThemePreference(opt.id)}
                                            style={({ pressed }) => [
                                                styles.appearanceChip,
                                                {
                                                    borderColor: selected
                                                        ? '#6F7FA5'
                                                        : colors.backgroundSelected,
                                                    backgroundColor: selected
                                                        ? '#6F7FA5'
                                                        : 'transparent',
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{
                                                    color: selected ? '#fff' : colors.text,
                                                    fontWeight: '500',
                                                }}>
                                                {opt.label}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        <Pressable
                            onPress={signOut}
                            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
                            <ThemedText style={styles.signOutText}>Sign out</ThemedText>
                        </Pressable>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { padding: Spacing.four, gap: Spacing.five, paddingBottom: Spacing.six },
    section: { gap: Spacing.two },
    card: {
        padding: Spacing.three,
        borderRadius: Spacing.two,
        gap: Spacing.two,
    },
    memberList: { gap: Spacing.one },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    memberDot: { width: 10, height: 10, borderRadius: 5 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.one },
    appearanceChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    typeColumn: { gap: Spacing.two, paddingTop: Spacing.one },
    typeOption: {
        gap: 2,
        borderWidth: 1,
        borderRadius: Spacing.two,
        padding: Spacing.three,
    },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, paddingVertical: Spacing.one },
    swatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
    },
    inviteRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
    primaryBtn: {
        height: 44,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.two,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtn: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    inviteActions: { flexDirection: 'row', gap: Spacing.two },
    errorText: { color: '#B85D52' },
    signOut: {
        marginTop: Spacing.two,
        paddingVertical: Spacing.three,
        paddingHorizontal: Spacing.four,
        borderRadius: Spacing.three,
        backgroundColor: '#F3D9D3',
        alignSelf: 'flex-start',
    },
    signOutText: { color: '#B85D52', fontWeight: '500' },
    pressed: { opacity: 0.7 },
});
