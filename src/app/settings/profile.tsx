// Profile editor — Phase 6.7.3 sub-route.
//
// Reached by tapping the EDIT chip on the Settings hero. Lifts the
// display-name inline editor and the "My color" swatch picker out of the
// main Settings hero (Phase 6.5b had moved color into the hero; that
// crowded the hero and didn't match design intent — the hero should be a
// read-only summary). This screen now owns both editors plus a read-only
// Account summary (email + phone + time zone) and an explicit Sign-out
// row.
//
// Design source: docs/design-handoffs/settings-subroutes-v2/screens-settings.jsx
// (ProfileEdit at line 660).

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimezonePicker } from '@/components/timezone-picker';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyProfile } from '@/hooks/use-my-profile';
import { signOut } from '@/lib/auth';
import { PARENT_PALETTE } from '@/lib/colors';
import {
    deleteMyAvatar,
    getProfileAvatarSignedUrl,
    setMyAvatarUrl,
    updateMyColor,
    updateMyDefaultTimezone,
    updateMyDisplayName,
    uploadMyAvatar,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { resolveDefaultTimezone } from '@/lib/timezones';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

// Human-readable labels paired with PARENT_PALETTE hexes, ordered to read
// as a satisfying spectrum (indigo → sky → forest → mint → wheat → rust →
// rose → lilac). The hex values must stay aligned with src/lib/colors.ts;
// the labels are display-only and only used here.
const COLOR_LABELS: ReadonlyArray<{ hex: string; label: string }> = [
    { hex: '#5C77B5', label: 'Indigo' },
    { hex: '#6F9DC4', label: 'Sky' },
    { hex: '#3E8A6B', label: 'Forest' },
    { hex: '#6BC0A6', label: 'Mint' },
    { hex: '#BFA168', label: 'Wheat' },
    { hex: '#C77046', label: 'Rust' },
    { hex: '#BE7896', label: 'Rose' },
    { hex: '#8369A8', label: 'Lilac' },
];

// Sanity check at module load — if PARENT_PALETTE drifts from the labels,
// fail loudly in dev instead of silently rendering the wrong label under a
// swatch. (Type-only check is enough — actual hex equality is asserted by
// existence of the same string in both lists.)
if (process.env.NODE_ENV !== 'production') {
    const palette = new Set(PARENT_PALETTE as ReadonlyArray<string>);
    const missing = COLOR_LABELS.filter((c) => !palette.has(c.hex));
    if (missing.length > 0) {
        console.warn(
            'profile.tsx: COLOR_LABELS out of sync with PARENT_PALETTE',
            missing,
        );
    }
}

const NAME_MAX_LENGTH = 40;

// Light/dark palettes have identical shapes but different hex literals — a
// `typeof Colors.light` parameter is too narrow for the dark instance. Match
// the union pattern used elsewhere in the codebase (see contacts.tsx, family.tsx).
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export default function ProfileSettingsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const {
        members,
        isLoading: membersLoading,
        refetch: refetchMembers,
    } = useHouseholdMembers(household?.id);
    // Profile row (default_timezone + avatar_url). Members already carry
    // color + display_name; we read profile separately for the two
    // user-owned fields that aren't projected into household_members.
    const {
        profile,
        isLoading: profileLoading,
        refetch: refetchProfile,
    } = useMyProfile();

    const myMember = members?.find((m) => m.profile_id === user?.id) ?? null;

    // Name editor state. Starts uninitialized; once we have a member we
    // hydrate via useMemo (cheaper than useEffect-syncing on every change).
    const initialName = myMember?.display_name ?? '';
    const [nameInput, setNameInput] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const [savingColor, setSavingColor] = useState<string | null>(null);
    const [colorError, setColorError] = useState<string | null>(null);

    const [signingOut, setSigningOut] = useState(false);

    // #402: avatar state. `avatarSignedUrl` is the time-limited GET URL we
    // render; `uploadingAvatar` flips the pencil bug to a spinner; the
    // sheet-less `Alert.alert` action sheet on long-press / future overflow
    // lives outside the screen for now (v1 = single tap → picker).
    const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (!profile?.avatar_url) {
            setAvatarSignedUrl(null);
            return;
        }
        (async () => {
            const url = await getProfileAvatarSignedUrl(profile.avatar_url!);
            if (!cancelled) setAvatarSignedUrl(url);
        })();
        return () => {
            cancelled = true;
        };
    }, [profile?.avatar_url]);

    // #402: time zone picker state. The TimezonePicker primitive (#148)
    // takes value + onChange + onCancel. We mount it inside a Modal so
    // the rest of the screen stays in place behind it.
    const [tzPickerOpen, setTzPickerOpen] = useState(false);
    const [savingTz, setSavingTz] = useState(false);
    const [tzError, setTzError] = useState<string | null>(null);

    // Display-name value the input shows. Until the user types we render
    // the loaded member name; once they type we render their input. This
    // lets the screen mount instantly while data hydrates without
    // overriding edits-in-progress.
    const displayedName = nameInput ?? initialName;
    const trimmedName = displayedName.trim();
    const nameChanged = trimmedName !== initialName.trim();
    const nameEmpty = trimmedName.length === 0;
    const nameTooLong = trimmedName.length > NAME_MAX_LENGTH;

    // Who owns each non-me color, for the "claimed by …" overlay. Members
    // with a NULL color are skipped — they haven't picked yet and don't
    // block anyone else's choice.
    const claimedBy = useMemo(() => {
        const map = new Map<string, { display_name: string; profile_id: string }>();
        for (const m of members ?? []) {
            if (!m.color || m.profile_id === user?.id) continue;
            map.set(m.color, { display_name: m.display_name ?? '?', profile_id: m.profile_id });
        }
        return map;
    }, [members, user?.id]);

    const myColor = myMember?.color ?? null;

    const onSaveName = async () => {
        if (nameEmpty) {
            setNameError('Name cannot be empty.');
            return;
        }
        if (nameTooLong) {
            setNameError(`Keep it under ${NAME_MAX_LENGTH} characters.`);
            return;
        }
        if (!nameChanged) {
            // No-op save. Just clear any stale error and bounce back.
            router.back();
            return;
        }
        setSavingName(true);
        setNameError(null);
        try {
            await updateMyDisplayName(trimmedName);
            await refetchMembers();
            router.back();
        } catch (err) {
            console.error('updateMyDisplayName failed', err);
            setNameError(errorMessage(err));
        } finally {
            setSavingName(false);
        }
    };

    const onPickColor = async (color: string) => {
        if (!household || color === myColor) return;
        if (claimedBy.has(color)) return; // can't take someone else's color
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

    const onPickAvatar = async () => {
        if (uploadingAvatar) return;
        setAvatarError(null);
        try {
            // Permissions on native — web doesn't need them and the API
            // is a no-op there. Same shape as ContactForm's avatar pick.
            if (Platform.OS !== 'web') {
                const perm =
                    await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                    setAvatarError('Photo access permission was denied.');
                    return;
                }
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });
            if (result.canceled || result.assets.length === 0) return;
            const asset = result.assets[0];
            if (!asset) return;
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
            setUploadingAvatar(true);
            const path = await uploadMyAvatar(blob, ext);
            await setMyAvatarUrl(path);
            await refetchProfile();
        } catch (err) {
            console.error('avatar upload failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setAvatarError(msg);
            else Alert.alert("Couldn't upload photo", msg);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const onRemoveAvatar = async () => {
        if (!profile?.avatar_url) return;
        setUploadingAvatar(true);
        setAvatarError(null);
        try {
            await deleteMyAvatar(profile.avatar_url);
            await setMyAvatarUrl(null);
            await refetchProfile();
        } catch (err) {
            console.error('avatar remove failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setAvatarError(msg);
            else Alert.alert("Couldn't remove photo", msg);
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Avatar interaction. On native we surface a 2-action sheet
    // (Choose / Remove) when a photo is already set; on web we go
    // straight to picker. "Remove" only appears when avatar_url is set.
    const onAvatarPress = () => {
        if (uploadingAvatar) return;
        const hasPhoto = !!profile?.avatar_url;
        if (Platform.OS === 'web' || !hasPhoto) {
            void onPickAvatar();
            return;
        }
        Alert.alert(
            'Profile photo',
            undefined,
            [
                { text: 'Choose new photo', onPress: () => void onPickAvatar() },
                {
                    text: 'Remove photo',
                    style: 'destructive',
                    onPress: () => void onRemoveAvatar(),
                },
                { text: 'Cancel', style: 'cancel' },
            ],
        );
    };

    const onPickTimezone = async (tz: string) => {
        setTzPickerOpen(false);
        if (!profile) return;
        if (tz === profile.default_timezone) return;
        setSavingTz(true);
        setTzError(null);
        try {
            await updateMyDefaultTimezone(tz);
            await refetchProfile();
        } catch (err) {
            console.error('updateMyDefaultTimezone failed', err);
            setTzError(errorMessage(err));
        } finally {
            setSavingTz(false);
        }
    };

    const onSignOut = async () => {
        const doSignOut = async () => {
            setSigningOut(true);
            try {
                await signOut();
            } catch (err) {
                console.error('signOut failed', err);
                if (Platform.OS !== 'web') {
                    Alert.alert("Couldn't sign out", errorMessage(err));
                }
                setSigningOut(false);
            }
        };
        if (Platform.OS === 'web') {
            const ok = typeof window !== 'undefined' && window.confirm('Sign out of OneNest?');
            if (ok) await doSignOut();
        } else {
            Alert.alert('Sign out of OneNest?', 'You can sign back in any time.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: doSignOut },
            ]);
        }
    };

    if (authLoading || householdsLoading || membersLoading || profileLoading) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (!myMember) return <Redirect href="/family" />;

    const avatarColor = myColor ?? colors.accent;
    const initial = (myMember.display_name?.[0] ?? '?').toUpperCase();
    // Time zone display: profile.default_timezone takes precedence when
    // the user has explicitly picked one; otherwise we fall back to the
    // device tz (same rule the rest of the app uses for event creation).
    const tz = profile?.default_timezone ?? resolveDefaultTimezone();
    const deviceTz = resolveDefaultTimezone();

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={[styles.topBar, { borderBottomColor: colors.hair }]}>
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
                    <ThemedText style={[styles.topBarTitle, { color: colors.text }]}>
                        Profile
                    </ThemedText>
                    {/* "Done" affordance — saves name if changed, otherwise just
                        dismisses. Mirrors iOS modal-edit convention from the design. */}
                    <Pressable
                        onPress={onSaveName}
                        accessibilityRole="button"
                        accessibilityLabel="Done editing profile"
                        disabled={savingName}
                        style={({ pressed }) => [
                            styles.doneBtn,
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.doneBtnText,
                                { color: colors.accent, fontFamily: FontFamily.monoSemiBold },
                            ]}>
                            {savingName ? 'SAVING…' : 'DONE'}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Avatar preview hero — 96px avatar with a soft two-stop
                        halo (Phase 6.7 UX review: the first cut used one
                        thick 4px border which read as a hard ring instead
                        of the design's box-shadow halo).
                        We stack two transparent View layers around the
                        avatar — outer is ~6% of the color, inner is ~25%.
                        Result reads as a gradient halo on both native and
                        web without needing a real `box-shadow` (RN native
                        doesn't expose multi-stop shadows). */}
                    <View style={styles.avatarHero}>
                        <Pressable
                            onPress={onAvatarPress}
                            disabled={uploadingAvatar}
                            accessibilityRole="button"
                            accessibilityLabel={
                                profile?.avatar_url
                                    ? 'Change profile photo'
                                    : 'Upload profile photo'
                            }
                            style={({ pressed }) => [
                                styles.avatarHeroWrap,
                                pressed && !uploadingAvatar && styles.pressed,
                            ]}>
                            <View
                                style={[
                                    styles.avatarOuterHalo,
                                    { backgroundColor: avatarColor + '14' },
                                ]}
                            />
                            <View
                                style={[
                                    styles.avatarInnerHalo,
                                    { backgroundColor: avatarColor + '44' },
                                ]}
                            />
                            <View
                                style={[
                                    styles.avatar,
                                    { backgroundColor: avatarColor },
                                ]}>
                                {avatarSignedUrl ? (
                                    <Image
                                        source={{ uri: avatarSignedUrl }}
                                        style={styles.avatarImage}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <ThemedText style={styles.avatarInitial}>
                                        {initial}
                                    </ThemedText>
                                )}
                            </View>
                            <View
                                style={[
                                    styles.avatarPencilBug,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <Feather
                                    name={
                                        uploadingAvatar
                                            ? 'upload-cloud'
                                            : 'edit-2'
                                    }
                                    size={11}
                                    color={colors.text}
                                />
                            </View>
                        </Pressable>
                        <ThemedText
                            style={[
                                styles.avatarCaption,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            {uploadingAvatar
                                ? 'Uploading…'
                                : profile?.avatar_url
                                  ? 'Tap to change photo'
                                  : 'Tap to upload photo'}
                        </ThemedText>
                        {avatarError ? (
                            <ThemedText
                                type="small"
                                style={[
                                    styles.errorText,
                                    { color: BrandColors.error },
                                ]}>
                                {avatarError}
                            </ThemedText>
                        ) : null}
                    </View>

                    {/* Display name */}
                    <View>
                        <View style={styles.sectionHeader}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                DISPLAY NAME
                            </ThemedText>
                            <ThemedText
                                themeColor="textSecondary"
                                type="small"
                                style={styles.sectionSub}>
                                How you appear to others in {household.name}.
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <View style={styles.nameRow}>
                                <TextInput
                                    value={displayedName}
                                    onChangeText={(t) => {
                                        setNameInput(t);
                                        if (nameError) setNameError(null);
                                    }}
                                    placeholder="Your name"
                                    placeholderTextColor={colors.textSecondary}
                                    autoCapitalize="words"
                                    maxLength={NAME_MAX_LENGTH + 8} /* allow 8-char buffer past max for nicer error */
                                    editable={!savingName}
                                    style={[
                                        styles.nameInput,
                                        {
                                            color: colors.text,
                                            backgroundColor: colors.backgroundSelected,
                                            borderColor: nameError
                                                ? BrandColors.error
                                                : colors.accent,
                                        },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.nameCounter,
                                        {
                                            color:
                                                trimmedName.length > NAME_MAX_LENGTH
                                                    ? BrandColors.error
                                                    : colors.textSecondary,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {trimmedName.length} / {NAME_MAX_LENGTH}
                                </ThemedText>
                            </View>
                            {nameError ? (
                                <ThemedText
                                    type="small"
                                    style={[styles.errorText, { color: BrandColors.error }]}>
                                    {nameError}
                                </ThemedText>
                            ) : null}
                        </View>
                    </View>

                    {/* My color picker — 4-col grid of 8 swatches */}
                    {household ? (
                        <View>
                            <View style={styles.sectionHeader}>
                                <ThemedText
                                    style={[
                                        styles.sectionLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    MY COLOR
                                </ThemedText>
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small"
                                    style={styles.sectionSub}>
                                    Used on your events, hand-offs and chips across the
                                    family. Each person picks a distinct color.
                                </ThemedText>
                            </View>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <View style={styles.swatchGrid}>
                                    {COLOR_LABELS.map(({ hex, label }) => {
                                        const selected = myColor === hex;
                                        const claimer = claimedBy.get(hex);
                                        const claimedByOther = !!claimer;
                                        const saving = savingColor === hex;
                                        return (
                                            <Pressable
                                                key={hex}
                                                onPress={() => onPickColor(hex)}
                                                disabled={
                                                    savingColor !== null || claimedByOther
                                                }
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    claimedByOther
                                                        ? `${label} (claimed by ${claimer?.display_name})`
                                                        : selected
                                                          ? `${label} (selected)`
                                                          : `Pick ${label}`
                                                }
                                                accessibilityState={{
                                                    selected,
                                                    disabled: claimedByOther,
                                                }}
                                                style={({ pressed }) => [
                                                    styles.swatchCell,
                                                    {
                                                        opacity: claimedByOther
                                                            ? 0.45
                                                            : saving
                                                              ? 0.6
                                                              : 1,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}>
                                                <View
                                                    style={[
                                                        styles.swatch,
                                                        {
                                                            backgroundColor: hex,
                                                            borderColor: selected
                                                                ? colors.text
                                                                : colors.hair,
                                                            borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                                                        },
                                                    ]}>
                                                    {selected ? (
                                                        <Feather
                                                            name="check"
                                                            size={22}
                                                            color="#FFFFFF"
                                                        />
                                                    ) : null}
                                                    {claimedByOther ? (
                                                        <View
                                                            style={[
                                                                styles.swatchClaimer,
                                                                {
                                                                    backgroundColor:
                                                                        colors.backgroundElement,
                                                                    borderColor: colors.hair,
                                                                },
                                                            ]}>
                                                            <ThemedText
                                                                style={styles.swatchClaimerText}>
                                                                {(claimer?.display_name?.[0] ?? '?').toUpperCase()}
                                                            </ThemedText>
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <ThemedText
                                                    style={[
                                                        styles.swatchLabel,
                                                        {
                                                            color: colors.textSecondary,
                                                            fontFamily: FontFamily.monoSemiBold,
                                                        },
                                                    ]}>
                                                    {label.toUpperCase()}
                                                </ThemedText>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                {/* Only render the "greyed-out swatches" hint
                                    when there's actually a claimer to point
                                    at. Solo households (no co-parent yet, no
                                    other members with a color set) never see
                                    a greyed swatch, so the hint copy reads as
                                    factually wrong there. */}
                                {claimedBy.size > 0 ? (
                                    <View
                                        style={[
                                            styles.swatchHint,
                                            {
                                                backgroundColor:
                                                    colors.accent + '14',
                                            },
                                        ]}>
                                        <Feather
                                            name="info"
                                            size={13}
                                            color={colors.accent}
                                            style={styles.swatchHintIcon}
                                        />
                                        <ThemedText
                                            type="small"
                                            style={{
                                                color: colors.inkSec,
                                                flex: 1,
                                            }}>
                                            Greyed-out swatches are claimed by
                                            other members. Pick a different
                                            color to keep things readable on
                                            shared views.
                                        </ThemedText>
                                    </View>
                                ) : null}
                                {colorError ? (
                                    <ThemedText
                                        type="small"
                                        style={[styles.errorText, { color: BrandColors.error }]}>
                                        {colorError}
                                    </ThemedText>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    {/* Account — read-only summary of email + phone + tz. None
                        of these are editable yet; this matches the design's
                        intent of surfacing them in one place. */}
                    <View>
                        <View style={styles.sectionHeader}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                ACCOUNT
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            {/* Email is bound to the auth account and
                                deliberately read-only — changing it would
                                go through Supabase auth verification, not
                                a profile update. */}
                            <AccountRow
                                label="Email"
                                value={user.email ?? '—'}
                                colors={colors}
                            />
                            {/* Phone row dropped — we don't have a phone
                                column on profiles and there's no product
                                use yet (see chat #2025-05-28). */}
                            <AccountRow
                                label="Time zone"
                                value={savingTz ? 'Saving…' : tz}
                                colors={colors}
                                onPress={
                                    savingTz
                                        ? undefined
                                        : () => setTzPickerOpen(true)
                                }
                                last
                            />
                            {tzError ? (
                                <ThemedText
                                    type="small"
                                    style={[
                                        styles.errorText,
                                        { color: BrandColors.error },
                                    ]}>
                                    {tzError}
                                </ThemedText>
                            ) : null}
                        </View>
                    </View>

                    {/* Sign out card */}
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <Pressable
                            onPress={onSignOut}
                            disabled={signingOut}
                            accessibilityRole="button"
                            accessibilityLabel="Sign out of OneNest"
                            style={({ pressed }) => [
                                styles.signOutRow,
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.signOutText,
                                    { color: BrandColors.error },
                                ]}>
                                {signingOut ? 'Signing out…' : 'Sign out of OneNest'}
                            </ThemedText>
                        </Pressable>
                    </View>
                </ScrollView>
            </SafeAreaView>
            {/* #402: TimezonePicker as a full-screen Modal. SheetShell
                isn't ideal here — the picker is a tall scrollable list
                that benefits from filling the viewport. ESC / back also
                routes through Modal's onRequestClose, which the picker's
                onCancel hook into. */}
            <Modal
                visible={tzPickerOpen}
                onRequestClose={() => setTzPickerOpen(false)}
                animationType="slide"
                presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <TimezonePicker
                        value={profile?.default_timezone ?? null}
                        deviceTimezone={deviceTz}
                        onChange={(picked) => void onPickTimezone(picked)}
                        onCancel={() => setTzPickerOpen(false)}
                    />
                </SafeAreaView>
            </Modal>
        </ThemedView>
    );
}

// Single label + mono-value row used inside the Account SGroup. Tappable
// when an onPress is provided (Time zone row); render-only otherwise
// (Email — bound to the auth account, not editable here).
function AccountRow({
    label,
    value,
    colors,
    last,
    onPress,
}: {
    label: string;
    value: string;
    colors: Palette;
    last?: boolean;
    onPress?: () => void;
}) {
    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${label.toLowerCase()}`}
                style={({ pressed }) => [
                    styles.accountRow,
                    !last && {
                        borderBottomColor: colors.hair,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                    pressed && styles.pressed,
                ]}>
                <ThemedText
                    type="smallBold"
                    style={{ flex: 1, color: colors.text }}>
                    {label}
                </ThemedText>
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.accountRowValue,
                        {
                            color: colors.textSecondary,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {value}
                </ThemedText>
                <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.inkFaint}
                />
            </Pressable>
        );
    }
    return (
        <View
            style={[
                styles.accountRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <ThemedText
                type="smallBold"
                style={{ flex: 1, color: colors.text }}>
                {label}
            </ThemedText>
            <ThemedText
                numberOfLines={1}
                style={[
                    styles.accountRowValue,
                    {
                        color: colors.textSecondary,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {value}
            </ThemedText>
        </View>
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
    // Phase 6.7 design (handoff README "SubTopBar" / screens-settings.jsx:33)
    // calls for 15/600/-0.3 — same shape as the main Settings top bar so the
    // hub→sub-route transition reads as one continuous chrome.
    topBarTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
    doneBtn: {
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: { fontSize: 11, letterSpacing: 0.4 },

    scroll: { padding: Spacing.four, gap: Spacing.four },

    // ── Avatar hero
    avatarHero: { alignItems: 'center', gap: 10, paddingVertical: Spacing.three },
    avatarHeroWrap: {
        width: 116,
        height: 116,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    avatarOuterHalo: {
        position: 'absolute',
        width: 116,
        height: 116,
        borderRadius: 58,
    },
    avatarInnerHalo: {
        position: 'absolute',
        width: 104,
        height: 104,
        borderRadius: 52,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '700',
        letterSpacing: -1,
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    avatarPencilBug: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarCaption: {
        fontSize: 11,
        letterSpacing: -0.1,
    },

    // ── Section headers (mono caps + optional sub)
    // Flush left at the card's outer edge so labels sit at the same x
    // position as the card border directly below them. The previous
    // `Spacing.four` (16) horizontal padding pushed labels in 16px past
    // the card edge, which read as misaligned against the cards and
    // against the avatar hero (which is centered relative to the
    // scrollContent's edge-to-edge area).
    sectionHeader: {
        paddingHorizontal: 0,
        paddingBottom: Spacing.two,
        gap: 4,
    },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    sectionSub: { lineHeight: 16 },

    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // ── Display name
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: Spacing.three,
    },
    nameInput: {
        flex: 1,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1.2,
        fontSize: 14,
        fontWeight: '500',
    },
    nameCounter: { fontSize: 10, letterSpacing: -0.1 },
    errorText: {
        paddingHorizontal: Spacing.three,
        paddingBottom: Spacing.two,
    },

    // ── Color picker grid
    swatchGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: Spacing.three,
        gap: 10,
    },
    swatchCell: {
        // 4 columns, accounting for 10px gap × 3 + card padding 12 × 2 ≈
        // (cardWidth - 24 - 30) / 4. Using flex basis so it adapts to screen
        // width without hard-coding a pixel size.
        width: '22%',
        alignItems: 'center',
        gap: 6,
    },
    swatch: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    swatchClaimer: {
        position: 'absolute',
        right: -4,
        bottom: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swatchClaimerText: {
        fontSize: 9,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    swatchLabel: { fontSize: 9, letterSpacing: 0.4 },
    swatchHint: {
        marginHorizontal: Spacing.three,
        marginBottom: Spacing.three,
        padding: Spacing.two,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    swatchHintIcon: { marginTop: 1 },

    // ── Account rows
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    accountRowValue: { fontSize: 12, letterSpacing: -0.2, maxWidth: '60%' },

    // ── Sign out
    signOutRow: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signOutText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },

    pressed: { opacity: 0.7 },
});
