// Members — Phase 6.7.5 sub-route.
//
// Reached from the Household SGroup's Members nav row on the main Settings
// page. Consolidates two things that previously lived as separate top-
// level surfaces on the Settings screen:
//   1) The dashed-accent "Invite a co-parent or caregiver" hero card +
//      role chip picker + email row + pending invitations sub-list, and
//   2) The read-only Members row that surfaced an avatar stack + count.
//
// The new screen reads as: header summary → invite form → pending invites
// → member list. The kebab affordance on each member row is a hook for a
// future remove-member sheet (RemoveCaregiverSheet exists already and is
// being generalized — see docs/design-handoffs/settings-subroutes-v2/
// README.md "Change 4 · Members screen").
//
// Gates: caregivers are bounced back to /family (they can't manage
// members; the parent-only RLS in migration 0031 would block the mutations
// anyway, but bouncing early avoids a flash of a form they can't submit).

import { format, parseISO } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { RemoveMemberSheet } from '@/components/remove-member-sheet';
import { RoleBadge } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { usePendingInvitations } from '@/hooks/use-pending-invitations';
import {
    createInvitation,
    getExternalCoparentsByChild,
    resendInvitation,
    revokeInvitation,
    type ChildExternalCoparent,
    type HouseholdMember,
    type HouseholdRole,
    type Invitation,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

function inviteUrlFor(token: string): string {
    if (Platform.OS === 'web') {
        return `${window.location.origin}/join?token=${token}`;
    }
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

// Pretty-print invitation lifetime relative to today (e.g. "5d", "6d 20h",
// "expired"). The design wants the right-side mono badge to read as a
// compact countdown; full date-with-year is too noisy.
function relativeExpiry(expiresAt: string): string {
    const now = Date.now();
    const target = new Date(expiresAt).getTime();
    const diff = target - now;
    if (diff <= 0) return 'expired';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days >= 1) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours >= 1) {
        const mins = Math.floor((diff % 3600000) / 60000);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return '<1h';
}

// Friendly "Sent N ago" / "Resent N ago" copy matching the design's
// pending-row meta. When `lastRemindedAt` is set (#403), we anchor on
// that and switch the verb to "Resent" so the row reflects the most
// recent action the parent took.
function relativeSent(
    createdAt: string,
    lastRemindedAt: string | null = null,
): string {
    const verb = lastRemindedAt ? 'Resent' : 'Sent';
    const anchor = lastRemindedAt ?? createdAt;
    const now = Date.now();
    const t = new Date(anchor).getTime();
    const diff = now - t;
    if (diff < 60000) return `${verb} just now`;
    if (diff < 3600000) {
        const m = Math.floor(diff / 60000);
        return `${verb} ${m} min ago`;
    }
    if (diff < 86400000) {
        const h = Math.floor(diff / 3600000);
        return `${verb} ${h} hour${h === 1 ? '' : 's'} ago`;
    }
    const d = Math.floor(diff / 86400000);
    return `${verb} ${d} day${d === 1 ? '' : 's'} ago`;
}

export default function MembersSettingsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const householdType = household?.household_type ?? 'separated';
    const {
        members,
        isLoading: membersLoading,
        refetch: refetchMembers,
    } = useHouseholdMembers(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const { children: householdChildren } = useChildren(household?.id);
    const {
        invitations,
        refetch: refetchInvites,
    } = usePendingInvitations(household?.id);

    // External co-parents (#404) — fetched per-kid then deduped by
    // profile_id. A single external profile linked to two kids in this
    // household renders as one row with both kids listed inline. We
    // run the per-kid queries in parallel via Promise.all so the
    // Members screen doesn't wait on a sequential chain.
    type ExtRow = ChildExternalCoparent & { kid_names: string[] };
    const [externalRows, setExternalRows] = useState<ExtRow[]>([]);
    useEffect(() => {
        const kids = householdChildren ?? [];
        if (kids.length === 0) {
            setExternalRows([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const allLinks = await Promise.all(
                    kids.map(async (k) => {
                        const links =
                            await getExternalCoparentsByChild(k.id);
                        return links.map((l) => ({
                            ...l,
                            _kidName: k.display_name,
                        }));
                    }),
                );
                if (cancelled) return;
                // Dedupe by profile_id, aggregating kid names.
                const byProfile = new Map<string, ExtRow>();
                for (const link of allLinks.flat()) {
                    const existing = byProfile.get(link.profile_id);
                    if (existing) {
                        existing.kid_names.push(link._kidName);
                    } else {
                        const { _kidName, ...rest } = link;
                        byProfile.set(link.profile_id, {
                            ...rest,
                            kid_names: [_kidName],
                        });
                    }
                }
                setExternalRows(Array.from(byProfile.values()));
            } catch {
                if (cancelled) return;
                setExternalRows([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [householdChildren]);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<HouseholdRole>(
        householdType === 'single_parent' ? 'caregiver' : 'parent',
    );
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    // #403: track which invite (if any) is mid-resend so we can render
    // a transient "…" state on its RESEND chip without rejecting a click
    // on a sibling row.
    const [resendingId, setResendingId] = useState<string | null>(null);
    // Tokens whose RESEND just succeeded — used to swap the chip label to
    // "SENT" for ~2s before the optimistic state hands off to the refetched
    // `last_reminded_at`. Mirrors the COPY → COPIED flash on the same row.
    const [resentToken, setResentToken] = useState<string | null>(null);
    // Phase 13: RemoveMemberSheet target. Null = sheet closed.
    const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null);

    // Auto-clear the "COPIED" affordance ~2s after a copy. Owning the
    // timeout in a useEffect (rather than the older setTimeout-inside-
    // onCopy pattern) means the timer is canceled on unmount — no stale
    // setState warnings if the user navigates away mid-fade.
    useEffect(() => {
        if (!copiedToken) return;
        const id = setTimeout(() => setCopiedToken(null), 2000);
        return () => clearTimeout(id);
    }, [copiedToken]);

    // Mirror flash for the SENT (resend) chip. Same 2s hold + unmount-
    // safe cleanup as COPIED above.
    useEffect(() => {
        if (!resentToken) return;
        const id = setTimeout(() => setResentToken(null), 2000);
        return () => clearTimeout(id);
    }, [resentToken]);

    const onSendInvite = async () => {
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
            await refetchInvites();
        } catch (err) {
            console.error('createInvitation failed', err);
            setInviteError(errorMessage(err));
        } finally {
            setInviting(false);
        }
    };

    const onCopyLink = async (invitation: Invitation) => {
        const url = inviteUrlFor(invitation.token);
        const ok = await copyToClipboard(url);
        if (ok) {
            setCopiedToken(invitation.token);
            // useEffect above handles the 2s auto-clear with unmount-safe
            // cleanup; no inline setTimeout here.
        } else if (Platform.OS !== 'web') {
            Alert.alert('Invite link', url);
        }
    };

    // #403: nudge an unaccepted invite. The RPC bumps reminder_count +
    // last_reminded_at + refreshes expires_at on the server, then we
    // refetch so the row's relative time + EXPIRES IN badge reflect the
    // new state. The optimistic SENT flash on the chip means the user
    // gets feedback even before the refetch lands.
    const onResend = async (invitation: Invitation) => {
        setResendingId(invitation.id);
        try {
            await resendInvitation(invitation.id);
            setResentToken(invitation.token);
            await refetchInvites();
        } catch (err) {
            console.error('resendInvitation failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') {
                setInviteError(msg);
            } else {
                Alert.alert("Couldn't resend", msg);
            }
        } finally {
            setResendingId(null);
        }
    };

    const onRevoke = async (invitation: Invitation) => {
        const doRevoke = async () => {
            setRevokingId(invitation.id);
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
            } finally {
                setRevokingId(null);
            }
        };
        if (Platform.OS === 'web') {
            const ok =
                typeof window !== 'undefined' &&
                window.confirm(`Revoke invitation to ${invitation.invited_email}?`);
            if (ok) await doRevoke();
        } else {
            Alert.alert(
                'Revoke invitation?',
                `This will invalidate the invite link sent to ${invitation.invited_email}.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Revoke', style: 'destructive', onPress: doRevoke },
                ],
            );
        }
    };

    // Phase 13: kebab now opens the RemoveMemberSheet (the generalized
    // RemoveCaregiverSheet from screens-extra-4.jsx). Only Remove is offered
    // today; future iterations can add Change role / Resend last invite /
    // View activity from the same kebab.
    const onMemberKebab = (member: HouseholdMember) => {
        setMemberToRemove(member);
    };

    if (authLoading || householdsLoading || membersLoading || roleLoading) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers can't manage members. Bounce them.
    if (isCaregiver) return <Redirect href="/family" />;

    const activeCount = members?.length ?? 0;
    const pendingCount = invitations?.length ?? 0;

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
                        Members
                    </ThemedText>
                    <View style={styles.topBarIconBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Header summary line */}
                    <View style={styles.headerSummary}>
                        <ThemedText
                            style={[
                                styles.headerSummaryMono,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            {(household.name ?? '').toUpperCase()} ·{' '}
                            {activeCount} ACTIVE
                            {pendingCount > 0 ? ` · ${pendingCount} PENDING` : ''}
                        </ThemedText>
                        <ThemedText
                            themeColor="textSecondary"
                            type="small"
                            style={styles.headerSummaryBody}>
                            People who can see and edit your family&apos;s plans.
                            Co-parents and external co-parents see the schedule;
                            caregivers only see what&apos;s assigned to them.
                        </ThemedText>
                    </View>

                    {/* Invite form card */}
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <View
                            style={[
                                styles.inviteSection,
                                {
                                    borderBottomColor: colors.hair,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.subSectionLabel,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                INVITE SOMEONE
                            </ThemedText>
                            {/* Phase 6.7 pass-2 UX fix: use backgroundInset
                                (not backgroundSelected) so the email input
                                surface matches the other inset surfaces on
                                the screen (dashed help card, role-chip icon
                                tiles). The two tokens differ slightly in
                                Mist Forest — inset is the canonical "nested
                                container" hue. */}
                            <View
                                style={[
                                    styles.emailInputWrap,
                                    {
                                        backgroundColor: colors.backgroundInset,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <Feather
                                    name="mail"
                                    size={14}
                                    color={colors.textSecondary}
                                />
                                <TextInput
                                    value={inviteEmail}
                                    onChangeText={(t) => {
                                        setInviteEmail(t);
                                        if (inviteError) setInviteError(null);
                                    }}
                                    placeholder={
                                        inviteRole === 'caregiver'
                                            ? 'caregiver@example.com'
                                            : 'coparent@example.com'
                                    }
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    autoCorrect={false}
                                    editable={!inviting}
                                    style={[
                                        styles.emailInput,
                                        {
                                            color: colors.text,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Role chips — single-parent households offer only
                            caregiver, so skip the picker entirely there. */}
                        {householdType !== 'single_parent' ? (
                            <View
                                style={[
                                    styles.inviteSection,
                                    {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.subSectionLabel,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ROLE
                                </ThemedText>
                                <View style={styles.roleChipColumn}>
                                    <RoleChipRow
                                        title={householdType === 'couple' ? 'Partner' : 'Co-parent'}
                                        desc="Full access · can create events, manage custody, invite others."
                                        icon="user"
                                        selected={inviteRole === 'parent'}
                                        disabled={inviting}
                                        onPress={() => setInviteRole('parent')}
                                        colors={colors}
                                    />
                                    <RoleChipRow
                                        title="Caregiver"
                                        desc="Read-only · only what's assigned to them. Can mark tasks done."
                                        icon="user-check"
                                        selected={inviteRole === 'caregiver'}
                                        disabled={inviting}
                                        onPress={() => setInviteRole('caregiver')}
                                        colors={colors}
                                    />
                                </View>
                            </View>
                        ) : null}

                        {/* Send */}
                        <View style={styles.inviteSection}>
                            <Pressable
                                onPress={onSendInvite}
                                disabled={inviting || inviteEmail.trim().length === 0}
                                accessibilityRole="button"
                                accessibilityLabel="Send invitation"
                                style={({ pressed }) => [
                                    styles.sendBtn,
                                    {
                                        backgroundColor:
                                            inviting || inviteEmail.trim().length === 0
                                                ? colors.backgroundSelected
                                                : colors.accent,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="send"
                                    size={14}
                                    color={
                                        inviting || inviteEmail.trim().length === 0
                                            ? colors.textSecondary
                                            : colors.onAccent
                                    }
                                />
                                <ThemedText
                                    style={[
                                        styles.sendBtnText,
                                        {
                                            color:
                                                inviting || inviteEmail.trim().length === 0
                                                    ? colors.textSecondary
                                                    : colors.onAccent,
                                        },
                                    ]}>
                                    {inviting ? 'Generating…' : 'Send private invite link'}
                                </ThemedText>
                            </Pressable>
                            <ThemedText
                                themeColor="textSecondary"
                                type="small"
                                style={styles.sendHint}>
                                They&apos;ll get an email · link expires in 7 days · you can
                                revoke anytime
                            </ThemedText>
                            {inviteError ? (
                                <ThemedText
                                    type="small"
                                    style={[styles.errorText, { color: BrandColors.error }]}>
                                    {inviteError}
                                </ThemedText>
                            ) : null}
                        </View>
                    </View>

                    {/* Pending */}
                    {invitations && invitations.length > 0 ? (
                        <View>
                            <View
                                style={[styles.sectionHeader, styles.sectionHeaderRow]}>
                                <ThemedText
                                    style={[
                                        styles.sectionLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    PENDING · {invitations.length}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.sectionAccessory,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    EXPIRES IN
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
                                {invitations.map((invitation, idx) => (
                                    <PendingRow
                                        key={invitation.id}
                                        invitation={invitation}
                                        copied={copiedToken === invitation.token}
                                        revoking={revokingId === invitation.id}
                                        resending={resendingId === invitation.id}
                                        resent={resentToken === invitation.token}
                                        last={idx === invitations.length - 1}
                                        onCopy={() => onCopyLink(invitation)}
                                        onResend={() => onResend(invitation)}
                                        onRevoke={() => onRevoke(invitation)}
                                        colors={colors}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {/* Members list */}
                    {members && members.length > 0 ? (
                        <View>
                            <View
                                style={[styles.sectionHeader, styles.sectionHeaderRow]}>
                                <ThemedText
                                    style={[
                                        styles.sectionLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    MEMBERS · {members.length}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.sectionAccessory,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    JOINED
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
                                {members.map((m, idx) => (
                                    <MemberRow
                                        key={m.profile_id}
                                        member={m}
                                        isMe={m.profile_id === user.id}
                                        last={idx === members.length - 1}
                                        onKebab={() => onMemberKebab(m)}
                                        colors={colors}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {/* External co-parents (#404) — surfaces profiles
                        linked to any of this household's kids via the
                        `child_external_coparents` junction (migration
                        0050). They aren't members of the household —
                        they have a per-kid relationship — so they get
                        their own section with the EXT RoleBadge.
                        Hidden when the household has no external
                        co-parent links (the common case). */}
                    {externalRows.length > 0 ? (
                        <View>
                            <View
                                style={[
                                    styles.sectionHeader,
                                    styles.sectionHeaderRow,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.sectionLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    EXTERNAL CO-PARENTS ·{' '}
                                    {externalRows.length}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.sectionAccessory,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily:
                                                FontFamily.monoMedium,
                                        },
                                    ]}>
                                    LINKED TO
                                </ThemedText>
                            </View>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {externalRows.map((row, idx) => (
                                    <ExternalCoparentRow
                                        key={row.profile_id}
                                        row={row}
                                        last={
                                            idx ===
                                            externalRows.length - 1
                                        }
                                        colors={colors}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {/* Help footer — dashed-border card, transparent bg
                        (per design handoff screens-settings.jsx:474-487).
                        LEARN MORE routes to /settings/privacy-explainer
                        (#390) — full breakdown of the four visibility
                        tiers + paired-calendar privacy. */}
                    <Pressable
                        onPress={() =>
                            router.push('/settings/privacy-explainer')
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Learn more about who can see what"
                        style={({ pressed }) => [
                            styles.helpCard,
                            {
                                borderColor: colors.hair,
                                backgroundColor: 'transparent',
                            },
                            pressed && { opacity: 0.7 },
                        ]}>
                        <ThemedText
                            type="small"
                            style={{ color: colors.textSecondary, lineHeight: 17 }}>
                            <ThemedText
                                type="smallBold"
                                style={{ color: colors.inkSec }}>
                                What members can see.{' '}
                            </ThemedText>
                            Co-parents see everything across all kids. External
                            co-parents see only the children you share, never the kids
                            from your other relationship. Caregivers see only what&apos;s
                            assigned to them.
                        </ThemedText>
                        <ThemedText
                            style={[
                                styles.helpLearnMore,
                                {
                                    color: colors.accent,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            LEARN MORE →
                        </ThemedText>
                    </Pressable>
                </ScrollView>
            </SafeAreaView>
            {/* Phase 13: Remove member sheet — mounted at the screen root so
                it overlays the SafeAreaView + scroll content. Modal owns its
                own portal layer; rendering null when no target is fine. */}
            <RemoveMemberSheet
                open={memberToRemove !== null}
                member={memberToRemove}
                householdId={household.id}
                onClose={() => setMemberToRemove(null)}
                onRemoved={() => {
                    setMemberToRemove(null);
                    refetchMembers();
                }}
            />
        </ThemedView>
    );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function RoleChipRow({
    title,
    desc,
    icon,
    selected,
    disabled,
    onPress,
    colors,
}: {
    title: string;
    desc: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    selected: boolean;
    disabled?: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            accessibilityLabel={title}
            style={({ pressed }) => [
                styles.roleChip,
                {
                    borderColor: selected ? colors.accent : colors.hair,
                    borderWidth: selected ? 1.2 : StyleSheet.hairlineWidth,
                    backgroundColor: selected
                        ? `${colors.accent}14`
                        : 'transparent',
                },
                pressed && !disabled && styles.pressed,
            ]}>
            <View
                style={[
                    styles.roleChipIconTile,
                    {
                        backgroundColor: selected
                            ? `${colors.accent}22`
                            : colors.backgroundInset,
                    },
                ]}>
                <Feather
                    name={icon}
                    size={16}
                    color={selected ? colors.accent : colors.inkSec}
                />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText
                    type="smallBold"
                    style={{ color: colors.text }}>
                    {title}
                </ThemedText>
                <ThemedText
                    type="small"
                    style={{ color: colors.textSecondary, lineHeight: 16 }}>
                    {desc}
                </ThemedText>
            </View>
            <View
                style={[
                    styles.roleChipRadio,
                    {
                        borderColor: selected ? colors.accent : colors.inkFaint,
                        backgroundColor: selected ? colors.accent : 'transparent',
                    },
                ]}>
                {selected ? (
                    <Feather name="check" size={11} color={colors.onAccent} />
                ) : null}
            </View>
        </Pressable>
    );
}

function PendingRow({
    invitation,
    copied,
    revoking,
    resending,
    resent,
    last,
    onCopy,
    onResend,
    onRevoke,
    colors,
}: {
    invitation: Invitation;
    copied: boolean;
    revoking: boolean;
    resending: boolean;
    resent: boolean;
    last: boolean;
    onCopy: () => void;
    onResend: () => void;
    onRevoke: () => void;
    colors: Palette;
}) {
    // Phase 6.7 pass-2 UX fix: parent invites previously used colors.text
    // for both fg + bg-tint, which read as low-contrast white-on-near-white
    // in dark mode. Use accent for parents — caregivers stay accent too
    // (design ideally rotates a member-identity color, but until we have
    // that signal at invite time, accent works for both).
    const roleColor = colors.accent;
    void invitation.role;
    const expires = relativeExpiry(invitation.expires_at);
    const sent = relativeSent(
        invitation.created_at,
        invitation.last_reminded_at,
    );
    const isExpired = expires === 'expired';
    const reminderCount = invitation.reminder_count ?? 0;
    return (
        <View
            style={[
                styles.pendingRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            {/* Dashed envelope avatar */}
            <View
                style={[
                    styles.pendingEnvelope,
                    {
                        borderColor: `${roleColor}99`,
                        backgroundColor: `${roleColor}14`,
                    },
                ]}>
                <Feather name="mail" size={14} color={roleColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.pendingEmail,
                        { color: colors.text, fontFamily: FontFamily.monoMedium },
                    ]}>
                    {invitation.invited_email}
                </ThemedText>
                <View style={styles.pendingMetaRow}>
                    <View
                        style={[
                            styles.rolePill,
                            {
                                backgroundColor: `${roleColor}22`,
                                borderColor: `${roleColor}55`,
                            },
                        ]}>
                        <ThemedText
                            style={[
                                styles.rolePillText,
                                { color: colors.text, fontFamily: FontFamily.monoSemiBold },
                            ]}>
                            {invitation.role.toUpperCase()}
                        </ThemedText>
                    </View>
                    <ThemedText
                        style={[styles.pendingSent, { color: colors.textSecondary }]}>
                        {sent}
                    </ThemedText>
                    {reminderCount > 0 ? (
                        // #403: small mono badge surfacing how many times
                        // this invitee has been reminded. The Members
                        // screen is the only place users can see this; it
                        // helps parents notice when they're spamming an
                        // already-nudged invitee.
                        <View
                            style={[
                                styles.reminderBadge,
                                {
                                    backgroundColor: colors.backgroundInset,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.reminderBadgeText,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {reminderCount}×
                            </ThemedText>
                        </View>
                    ) : null}
                </View>
            </View>
            <View style={styles.pendingActions}>
                <ThemedText
                    style={[
                        styles.pendingExpiry,
                        {
                            color: isExpired ? BrandColors.error : colors.inkSec,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {expires}
                </ThemedText>
                <View style={styles.pendingChipRow}>
                    <Pressable
                        onPress={onCopy}
                        accessibilityRole="button"
                        accessibilityLabel={copied ? 'Link copied' : 'Copy invite link'}
                        style={({ pressed }) => [
                            styles.actionChip,
                            { borderColor: colors.hair, backgroundColor: colors.backgroundInset },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.actionChipText,
                                {
                                    color: colors.accent,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            {copied ? 'COPIED' : 'COPY'}
                        </ThemedText>
                    </Pressable>
                    {/* #403: RESEND chip. Disabled on expired invites —
                        the RPC would reject them anyway; better to make
                        that obvious in the UI than to surface the error
                        toast. */}
                    <Pressable
                        onPress={onResend}
                        disabled={resending || isExpired}
                        accessibilityRole="button"
                        accessibilityLabel={
                            resent ? 'Reminder sent' : 'Resend invitation'
                        }
                        style={({ pressed }) => [
                            styles.actionChip,
                            {
                                borderColor: colors.hair,
                                backgroundColor: colors.backgroundInset,
                                opacity: isExpired ? 0.45 : 1,
                            },
                            pressed && !resending && !isExpired && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.actionChipText,
                                {
                                    color: colors.accent,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            {resending ? '…' : resent ? 'SENT' : 'RESEND'}
                        </ThemedText>
                    </Pressable>
                    <Pressable
                        onPress={onRevoke}
                        disabled={revoking}
                        accessibilityRole="button"
                        accessibilityLabel="Revoke invitation"
                        style={({ pressed }) => [
                            styles.actionChip,
                            { borderColor: colors.hair, backgroundColor: colors.backgroundInset },
                            pressed && !revoking && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.actionChipText,
                                {
                                    color: BrandColors.error,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            {revoking ? '…' : 'CANCEL'}
                        </ThemedText>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function MemberRow({
    member,
    isMe,
    last,
    onKebab,
    colors,
}: {
    member: HouseholdMember;
    isMe: boolean;
    last: boolean;
    onKebab: () => void;
    colors: Palette;
}) {
    const avatarColor = member.color ?? colors.accent;
    const initial = (member.display_name?.[0] ?? '?').toUpperCase();
    const joinedLabel = (() => {
        try {
            return format(parseISO(member.joined_at), 'MMM yyyy');
        } catch {
            return '';
        }
    })();
    const roleColor = member.role === 'caregiver' ? colors.accent : avatarColor;
    return (
        <View
            style={[
                styles.memberRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
                <ThemedText style={styles.memberAvatarText}>{initial}</ThemedText>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={{ color: colors.text }}>
                    {member.display_name}
                    {isMe ? ' (you)' : ''}
                </ThemedText>
                <View
                    style={[
                        styles.rolePill,
                        {
                            backgroundColor: `${roleColor}22`,
                            borderColor: `${roleColor}55`,
                            alignSelf: 'flex-start',
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.rolePillText,
                            { color: colors.text, fontFamily: FontFamily.monoSemiBold },
                        ]}>
                        {member.role.toUpperCase()}
                    </ThemedText>
                </View>
            </View>
            <View style={styles.memberRight}>
                {joinedLabel ? (
                    <ThemedText
                        style={[
                            styles.memberJoined,
                            {
                                color: colors.textSecondary,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        {joinedLabel}
                    </ThemedText>
                ) : null}
                {isMe ? (
                    <View
                        style={[
                            styles.youChip,
                            {
                                backgroundColor: colors.backgroundInset,
                            },
                        ]}>
                        <ThemedText
                            style={[
                                styles.youChipText,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            YOU
                        </ThemedText>
                    </View>
                ) : (
                    <Pressable
                        onPress={onKebab}
                        accessibilityRole="button"
                        accessibilityLabel={`Member options for ${member.display_name}`}
                        style={({ pressed }) => [
                            styles.kebab,
                            { borderColor: colors.hair, backgroundColor: colors.backgroundInset },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="more-horizontal" size={14} color={colors.inkSec} />
                    </Pressable>
                )}
            </View>
        </View>
    );
}

/** Row for an external co-parent (#404). Visually parallels MemberRow
 *  but lacks the role pill + kebab. The EXT RoleBadge anchors the
 *  right slot, and a kid-name list (capped to 2 with "+ N more") sits
 *  underneath the display name so users see the relationship context
 *  at a glance. */
function ExternalCoparentRow({
    row,
    last,
    colors,
}: {
    row: { profile_id: string; color: string | null; display_name?: string; kid_names: string[] };
    last: boolean;
    colors: Palette;
}) {
    const avatarColor = row.color ?? colors.accent;
    const name = row.display_name ?? 'External co-parent';
    const initial = (name[0] ?? '?').toUpperCase();
    // Cap kid list display at 2 names + "+N more". Matches the
    // strip-variants README Q2 collapse convention.
    const kidLabel = (() => {
        const names = row.kid_names;
        if (names.length === 0) return '';
        if (names.length <= 2) return names.join(', ');
        return `${names[0]}, ${names[1]} + ${names.length - 2} more`;
    })();
    return (
        <View
            style={[
                styles.memberRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View
                style={[
                    styles.memberAvatar,
                    { backgroundColor: avatarColor },
                ]}>
                <ThemedText style={styles.memberAvatarText}>
                    {initial}
                </ThemedText>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={{ color: colors.text }}>
                    {name}
                </ThemedText>
                {kidLabel ? (
                    <ThemedText
                        numberOfLines={1}
                        style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                            letterSpacing: -0.1,
                        }}>
                        {kidLabel}
                    </ThemedText>
                ) : null}
            </View>
            <View style={styles.memberRight}>
                <RoleBadge kind="ext" />
            </View>
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
    // Phase 6.7 design (handoff SubTopBar): 15/600/-0.3 — matches the main
    // Settings top bar.
    topBarTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },

    scroll: { padding: Spacing.four, gap: Spacing.four },

    // Header summary
    headerSummary: { paddingHorizontal: Spacing.two, gap: 6 },
    headerSummaryMono: {
        fontSize: 10,
        letterSpacing: 0.4,
    },
    headerSummaryBody: { lineHeight: 17 },

    // Section headers (mono caps + accessory)
    sectionHeader: {
        paddingHorizontal: Spacing.four,
        paddingBottom: Spacing.two,
        gap: 4,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    sectionAccessory: {
        fontSize: 10,
        letterSpacing: 0.3,
    },

    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // Invite form
    inviteSection: { padding: Spacing.three, gap: Spacing.two },
    subSectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    emailInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    emailInput: {
        flex: 1,
        fontSize: 13,
        padding: 0,
    },

    // Role chips
    roleChipColumn: { gap: 6 },
    roleChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 10,
    },
    roleChipIconTile: {
        width: 28,
        height: 28,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleChipRadio: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.4,
        alignItems: 'center',
        justifyContent: 'center',
    },

    sendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
    },
    sendBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
    sendHint: { textAlign: 'center', lineHeight: 16 },
    errorText: { paddingHorizontal: 4 },

    // Pending rows
    pendingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    pendingEnvelope: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingEmail: { fontSize: 12.5, letterSpacing: -0.2 },
    pendingMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    pendingSent: { fontSize: 10.5, letterSpacing: -0.1 },
    pendingActions: { alignItems: 'flex-end', gap: 4 },
    pendingExpiry: { fontSize: 11, letterSpacing: -0.2 },
    pendingChipRow: { flexDirection: 'row', gap: 4 },

    rolePill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    rolePillText: {
        fontSize: 9,
        letterSpacing: 0.3,
    },

    actionChip: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    actionChipText: { fontSize: 9, letterSpacing: 0.3 },
    // #403: reminder-count badge sitting inline with the "Resent N ago"
    // meta. Same 9px mono caps as the action chips, just visually muted
    // since it's informational rather than tappable.
    reminderBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
    },
    reminderBadgeText: { fontSize: 9, letterSpacing: 0.2 },

    // Member rows
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    memberAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    memberAvatarText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 14,
        fontWeight: '700',
    },
    memberRight: { alignItems: 'flex-end', gap: 6 },
    memberJoined: { fontSize: 10, letterSpacing: -0.1 },
    youChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    youChipText: { fontSize: 9, letterSpacing: 0.3 },
    kebab: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Help footer
    helpCard: {
        padding: Spacing.three,
        borderRadius: 12,
        borderStyle: 'dashed',
        // RN-Web treats hairlineWidth as fractional and quietly drops the
        // dashed style. 1px keeps the dashes legible on both web + native.
        borderWidth: 1,
        gap: 8,
    },
    helpLearnMore: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },

    pressed: { opacity: 0.7 },
});
