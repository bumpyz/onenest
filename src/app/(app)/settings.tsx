import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { CustodyScheduleSection } from '@/components/custody-schedule-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimezonePicker } from '@/components/timezone-picker';
import { lookupTimezone } from '@/lib/timezones';
import { useExternalCalendars } from '@/hooks/use-external-calendars';
import { Colors, Spacing } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useChildren } from '@/hooks/use-children';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useMyRole } from '@/hooks/use-my-role';
import { usePendingInvitations } from '@/hooks/use-pending-invitations';
import { signOut } from '@/lib/auth';
import { PARENT_PALETTE, colorForResponsible, memberColorMap } from '@/lib/colors';
import {
    createInvitation,
    disconnectExternalCalendar,
    revokeInvitation,
    updateHouseholdType,
    updateMyColor,
    updateMyDefaultTimezone,
    updateMyDisplayName,
    type ExternalCalendar,
    type HouseholdRole,
    type HouseholdType,
    type Invitation,
} from '@/lib/db';
import { GoogleAuthError, syncGoogleCalendar } from '@/lib/google-calendar';
import { startGoogleOAuth } from '@/lib/google-oauth';
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
    const router = useRouter();
    const { user } = useAuth();
    const scheme = useAppColorScheme();
    const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { households, refetch: refetchHouseholds } = useHouseholds();
    const household = households?.[0];
    const householdType: HouseholdType = household?.household_type ?? 'separated';
    const { members, refetch: refetchMembers } = useHouseholdMembers(household?.id);
    // Caregivers see a trimmed-down Settings: own profile (name, color, tz,
    // appearance), paired calendars, account / sign out. No household-type
    // editor, custody schedule, children mgmt, locations mgmt, or invite UI —
    // those are parent-only data per migration 0031's RLS.
    const { isCaregiver } = useMyRole(household?.id);
    const colorMap = memberColorMap(members);
    const myMember = members?.find((m) => m.profile_id === user?.id);
    const myColor = myMember?.color ?? null;

    const { invitations, refetch: refetchInvites } = usePendingInvitations(household?.id);
    const { locations, refetch: refetchLocations } = useLocations(household?.id);
    const { children, refetch: refetchChildren } = useChildren(household?.id);
    const { calendars: externalCalendars, refetch: refetchExternalCalendars } = useExternalCalendars();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<HouseholdRole>('parent');
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

    // Default timezone editing — the picker is its own input, so we just track open/
    // closed state plus the in-flight save status. Selecting a row in the picker calls
    // onSaveTimezone directly; there's no separate "Save" button to manage.
    const { profile, refetch: refetchProfile } = useMyProfile();
    const [editingTimezone, setEditingTimezone] = useState(false);
    const [savingTimezone, setSavingTimezone] = useState(false);
    const [timezoneError, setTimezoneError] = useState<string | null>(null);
    const deviceTimezone =
        typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : null;

    const onStartEditTimezone = () => {
        setEditingTimezone(true);
        setTimezoneError(null);
    };

    const onCancelEditTimezone = () => {
        setEditingTimezone(false);
        setTimezoneError(null);
    };

    const onPickTimezone = async (tz: string) => {
        if (savingTimezone) return;
        setSavingTimezone(true);
        setTimezoneError(null);
        try {
            await updateMyDefaultTimezone(tz);
            await refetchProfile();
            setEditingTimezone(false);
        } catch (err) {
            console.error('updateMyDefaultTimezone failed', err);
            setTimezoneError(errorMessage(err));
        } finally {
            setSavingTimezone(false);
        }
    };

    const onClearTimezone = async () => {
        if (savingTimezone) return;
        setSavingTimezone(true);
        setTimezoneError(null);
        try {
            await updateMyDefaultTimezone(null);
            await refetchProfile();
            setEditingTimezone(false);
        } catch (err) {
            console.error('updateMyDefaultTimezone failed', err);
            setTimezoneError(errorMessage(err));
        } finally {
            setSavingTimezone(false);
        }
    };

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
    const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID ?? '';

    // (Earlier this screen also hosted a useEffect that intercepted the post-OAuth
    // redirect from Supabase's Google provider and persisted session.provider_token. That
    // path is gone now — pairing runs through our own PKCE flow + /oauth/google callback,
    // which writes through saveGoogleCalendarPairing directly. The connect button below
    // just calls startGoogleOAuth and the rest happens in the callback route.)

    const handleConnectGoogleCalendar = async () => {
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

    // Saved-locations add/edit lives behind the /location/new and /location/[id] modal
    // routes (LocationForm component). Settings just renders the read-only list and a
    // push-to-route Add button — no inline form state here anymore.

    // Refetch on screen focus so changes made inside the location / child modals show up
    // the moment the user returns. Without this the lists would only refresh on full
    // reload.
    useFocusEffect(
        useCallback(() => {
            refetchLocations();
            refetchChildren();
        }, [refetchLocations, refetchChildren]),
    );

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
            await createInvitation(household.id, email, inviteRole);
            setInviteEmail('');
            setInviteRole('parent');
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
                    {/* No screen-level title — active tab tint at the bottom
                        signals "you are here", and the first section header
                        ("Household") tells the user what they're looking at. */}

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
                                        {!isCaregiver ? (
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
                                        ) : null}
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

                    {/* Children — compact list, edit/delete inside /child/[id] modal.
                        Same shape as Saved locations below for consistency. Hidden
                        for caregivers — child records are parent-managed metadata. */}
                    {household && !isCaregiver ? (
                        <View style={styles.section}>
                            <ThemedText type="smallBold">Children</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                The kids in this household. Used to tag events and (later) to
                                filter the calendar by child.
                            </ThemedText>

                            <Pressable
                                onPress={() => router.push('/child/new')}
                                style={({ pressed }) => [
                                    styles.locationAddBtn,
                                    { borderColor: colors.backgroundSelected },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather name="plus" size={16} color="#6F7FA5" />
                                <ThemedText
                                    type="small"
                                    style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                    Add child
                                </ThemedText>
                            </Pressable>

                            {children && children.length > 0 ? (
                                <View
                                    style={[
                                        styles.locationList,
                                        {
                                            backgroundColor: colors.backgroundElement,
                                            borderColor: colors.backgroundSelected,
                                        },
                                    ]}>
                                    {children.map((c, idx) => (
                                        <Pressable
                                            key={c.id}
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/child/[id]',
                                                    params: { id: c.id },
                                                })
                                            }
                                            style={({ pressed }) => [
                                                styles.locationRow,
                                                idx > 0 && {
                                                    borderTopWidth: StyleSheet.hairlineWidth,
                                                    borderTopColor: colors.backgroundSelected,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ChildBadge
                                                name={c.display_name}
                                                color={c.color}
                                                size="lg"
                                            />
                                            <View style={styles.locationRowText}>
                                                <ThemedText type="smallBold">
                                                    {c.display_name}
                                                </ThemedText>
                                                {c.birthdate ? (
                                                    <ThemedText
                                                        themeColor="textSecondary"
                                                        type="small">
                                                        {/* parseISO (not new Date) so a date-only string
                                                            like "2014-01-11" is treated as local midnight
                                                            instead of UTC midnight — the latter would render
                                                            one day earlier in any tz west of UTC. */}
                                                        Born {format(parseISO(c.birthdate), 'MMM d, yyyy')}
                                                    </ThemedText>
                                                ) : null}
                                            </View>
                                            <Feather
                                                name="chevron-right"
                                                size={18}
                                                color={colors.textSecondary}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <ThemedText themeColor="textSecondary" type="small">
                                    No children added yet. Tap Add child to start.
                                </ThemedText>
                            )}
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

                    {/* Custody schedule — only relevant for separated co-parents,
                        and only visible to parents (RLS denies caregivers access
                        to custody_* tables; the section would render empty). */}
                    {household && user && householdType === 'separated' && !isCaregiver ? (
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
                                                : '#6F7FA5',
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
                        {!googleClientId ? (
                            <ThemedText type="small" themeColor="textSecondary">
                                Google is unavailable: EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID not set.
                            </ThemedText>
                        ) : null}
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

                    {/* Saved locations — compact list, with add/edit/delete living inside a
                        modal at /location/new or /location/[id] so this screen stays short.
                        Hidden for caregivers since they don't create events and the
                        location library is a parent-curated asset. */}
                    {household && !isCaregiver ? (
                        <View style={styles.section}>
                            <ThemedText type="smallBold">Saved locations</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                Places you reuse for events. Tap a row to edit, or use Add location to save a new one.
                            </ThemedText>

                            <Pressable
                                onPress={() => router.push('/location/new')}
                                style={({ pressed }) => [
                                    styles.locationAddBtn,
                                    { borderColor: colors.backgroundSelected },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather name="plus" size={16} color="#6F7FA5" />
                                <ThemedText
                                    type="small"
                                    style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                    Add location
                                </ThemedText>
                            </Pressable>

                            {locations && locations.length > 0 ? (
                                <View
                                    style={[
                                        styles.locationList,
                                        {
                                            backgroundColor: colors.backgroundElement,
                                            borderColor: colors.backgroundSelected,
                                        },
                                    ]}>
                                    {locations.map((loc, idx) => (
                                        <Pressable
                                            key={loc.id}
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/location/[id]',
                                                    params: { id: loc.id },
                                                })
                                            }
                                            style={({ pressed }) => [
                                                styles.locationRow,
                                                idx > 0 && {
                                                    borderTopWidth: StyleSheet.hairlineWidth,
                                                    borderTopColor: colors.backgroundSelected,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <View style={styles.locationRowText}>
                                                <ThemedText type="smallBold">
                                                    {loc.name}
                                                </ThemedText>
                                                {loc.formatted_address ? (
                                                    <ThemedText
                                                        themeColor="textSecondary"
                                                        type="small"
                                                        numberOfLines={1}>
                                                        {loc.formatted_address}
                                                    </ThemedText>
                                                ) : loc.google_maps_url ? (
                                                    <ThemedText
                                                        themeColor="textSecondary"
                                                        type="small"
                                                        numberOfLines={1}>
                                                        {loc.google_maps_url}
                                                    </ThemedText>
                                                ) : (
                                                    <ThemedText
                                                        themeColor="textSecondary"
                                                        type="small">
                                                        No address
                                                    </ThemedText>
                                                )}
                                            </View>
                                            <Feather
                                                name="chevron-right"
                                                size={18}
                                                color={colors.textSecondary}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <ThemedText themeColor="textSecondary" type="small">
                                    No saved locations yet. Add one above, or start typing a new location in any event.
                                </ThemedText>
                            )}
                        </View>
                    ) : null}

                    {/* Invite section — single-parent households can still invite a
                        caregiver (nanny, grandparent helping with pickups, etc.) so
                        this block stays visible even when a partner/co-parent invite
                        wouldn't make sense. The role picker below disambiguates.
                        Hidden for caregivers — invitations are parent-only per RLS. */}
                    {!isCaregiver ? (
                    <View style={styles.section}>
                        <ThemedText type="smallBold">
                            {householdType === 'single_parent'
                                ? 'Invite a caregiver'
                                : householdType === 'couple'
                                  ? 'Invite your partner or a caregiver'
                                  : 'Invite a co-parent or caregiver'}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary" type="small">
                            Generate a one-time link. Send it any way you like — they sign in with Google and join your household.
                        </ThemedText>

                        {/* Role picker — caregivers see only events/tasks they're
                            assigned to (or Anyone tasks) and can only mark tasks
                            complete; they cannot create or edit anything. Hidden
                            for single-parent since caregiver is the only option
                            anyway and the chip set would look silly. */}
                        {householdType === 'single_parent' ? null : (
                            <View style={styles.roleChipRow}>
                                {(
                                    [
                                        {
                                            id: 'parent' as const,
                                            label: householdType === 'couple' ? 'Partner' : 'Co-parent',
                                            desc: 'Full access. Can create events, manage custody, invite others.',
                                        },
                                        {
                                            id: 'caregiver' as const,
                                            label: 'Caregiver',
                                            desc: 'Sees only events/tasks they’re assigned to. Can mark tasks done but cannot create or edit.',
                                        },
                                    ]
                                ).map((opt) => {
                                    const selected = inviteRole === opt.id;
                                    return (
                                        <Pressable
                                            key={opt.id}
                                            onPress={() => setInviteRole(opt.id)}
                                            disabled={inviting}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={`Invite as ${opt.label}`}
                                            style={({ pressed }) => [
                                                styles.roleChip,
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
                                            <ThemedText type="smallBold">{opt.label}</ThemedText>
                                            <ThemedText
                                                themeColor="textSecondary"
                                                type="small">
                                                {opt.desc}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.inviteRow}>
                            <TextInput
                                value={inviteEmail}
                                onChangeText={setInviteEmail}
                                placeholder={
                                    inviteRole === 'caregiver'
                                        ? 'caregiver@example.com'
                                        : 'coparent@example.com'
                                }
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
                    ) : null}

                    {/* Pending invitations — caregiver invites are allowed for any
                        household type now, so this block is no longer gated on
                        householdType. Caregivers don't see other invitations
                        either (parent-only management). */}
                    {!isCaregiver && invitations && invitations.length > 0 ? (
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
                                        <ThemedText themeColor="textSecondary" type="small">
                                            Invited as {invitation.role}
                                        </ThemedText>
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
                            <ThemedText type="smallBold">Default timezone</ThemedText>
                            <ThemedText themeColor="textSecondary" type="small">
                                Applied to new events you create. Recurring events use this
                                to stay anchored to the same wall clock across DST.
                            </ThemedText>
                            {editingTimezone ? (
                                <TimezonePicker
                                    value={profile?.default_timezone ?? null}
                                    onChange={onPickTimezone}
                                    onCancel={onCancelEditTimezone}
                                    deviceTimezone={deviceTimezone}
                                />
                            ) : (
                                <View style={styles.inviteActions}>
                                    <View style={{ flex: 1 }}>
                                        {profile?.default_timezone ? (
                                            <>
                                                <ThemedText type="smallBold">
                                                    {(() => {
                                                        const opt = lookupTimezone(
                                                            profile.default_timezone,
                                                        );
                                                        return opt
                                                            ? `${opt.offsetLabel}  ${opt.iana}`
                                                            : profile.default_timezone;
                                                    })()}
                                                </ThemedText>
                                                {deviceTimezone &&
                                                deviceTimezone !==
                                                    profile.default_timezone ? (
                                                    <ThemedText
                                                        themeColor="textSecondary"
                                                        type="small">
                                                        Device is currently on {deviceTimezone}
                                                    </ThemedText>
                                                ) : null}
                                            </>
                                        ) : (
                                            <>
                                                <ThemedText type="smallBold">Not set</ThemedText>
                                                {deviceTimezone ? (
                                                    <ThemedText
                                                        themeColor="textSecondary"
                                                        type="small">
                                                        Falling back to device tz:{' '}
                                                        {deviceTimezone}
                                                    </ThemedText>
                                                ) : null}
                                            </>
                                        )}
                                    </View>
                                    <Pressable
                                        onPress={onStartEditTimezone}
                                        style={({ pressed }) => [
                                            styles.secondaryBtn,
                                            { borderColor: colors.backgroundSelected },
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            type="small"
                                            style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                            {profile?.default_timezone ? 'Change' : 'Set'}
                                        </ThemedText>
                                    </Pressable>
                                    {profile?.default_timezone ? (
                                        <Pressable
                                            onPress={onClearTimezone}
                                            disabled={savingTimezone}
                                            style={({ pressed }) => [
                                                styles.secondaryBtn,
                                                { borderColor: colors.backgroundSelected },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                type="small"
                                                style={{ color: '#B85D52', fontWeight: '600' }}>
                                                Clear
                                            </ThemedText>
                                        </Pressable>
                                    ) : null}
                                </View>
                            )}
                            {timezoneError ? (
                                <ThemedText type="small" style={styles.errorText}>
                                    {timezoneError}
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

                        {/* UX-028: recovery path for the Home welcome card.
                            Once dismissed it's gone for good — this small
                            link brings it back so users who tapped × by
                            mistake (or got curious later) can see it again.
                            Clears the per-household AsyncStorage key the
                            card uses to remember its dismissal. */}
                        {household ? (
                            <Pressable
                                onPress={async () => {
                                    try {
                                        await AsyncStorage.removeItem(
                                            `onenest:home-welcome-dismissed:${household.id}`,
                                        );
                                        Alert.alert(
                                            'Welcome card restored',
                                            'Visit the Home tab to see it again.',
                                        );
                                    } catch {
                                        // Best-effort; failure here is silent UX-only.
                                    }
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Show welcome card on Home again"
                                style={({ pressed }) => [
                                    styles.restoreWelcomeRow,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText themeColor="textSecondary" type="small">
                                    Show welcome card on Home again
                                </ThemedText>
                            </Pressable>
                        ) : null}

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
    // Caregiver role picker — pair of stacked option chips above the invite
    // email input. Same shape as the household-type picker so it reads as a
    // familiar control without inventing a new pattern.
    roleChipRow: { gap: Spacing.two, paddingTop: Spacing.one },
    roleChip: {
        gap: 2,
        borderWidth: 1,
        borderRadius: Spacing.two,
        padding: Spacing.three,
    },
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
    // UX-028: low-key restore-welcome link. Outlined-text style (no fill, no
    // border) so it reads as a secondary action — well below sign-out in
    // visual weight, but discoverable for users who actually want it.
    restoreWelcomeRow: {
        marginTop: Spacing.two,
        paddingVertical: Spacing.two,
    },
    pressed: { opacity: 0.7 },
    // Saved-locations list & "Add location" affordance — compact row layout with a chevron
    // on the right; each row pushes to /location/[id] for editing.
    locationAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    locationList: {
        borderRadius: Spacing.two,
        borderWidth: 1,
        overflow: 'hidden',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.three,
        gap: Spacing.three,
    },
    locationRowText: { flex: 1, gap: 2 },
});
