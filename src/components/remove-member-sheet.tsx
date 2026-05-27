// RemoveMemberSheet — Phase 13 design (screens-extra-4.jsx RemoveCaregiverSheet
// at line 376). Confirms a member removal from the household. Renamed from the
// design's "Caregiver" label because OneNest also removes parents via the same
// sheet — the design's open question explicitly punts on this generalization
// and asks the same sheet handle co-parents + caregivers with role-specific
// copy.
//
// Layout (top to bottom inside the sheet):
//   • Drag handle (decorative; sheet is dismissed via Cancel or backdrop tap)
//   • "MANAGE ACCESS" mono caps + close-X
//   • Hero: 64px avatar + name + email + role pill + joined-month pill
//   • Current access summary card (4 rows: schedule view, task complete,
//     edit allow, last active — last is a stub for now)
//   • Alert card "This happens immediately" — 3 consequence bullets in alert
//   • Dashed "What stays" card — 3 positive bullets in accent
//   • Sticky action bar: Remove (alert) + Cancel
//
// Rendered as a React Native Modal with `transparent` so the backdrop dim
// and bottom-sheet positioning work cross-platform. The parent passes
// open + target + handlers; this component owns no data state of its own.

import { format, parseISO } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { removeHouseholdMember, type HouseholdMember } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { SHEET_SHADOW, blurActiveElement } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export function RemoveMemberSheet({
    open,
    member,
    householdId,
    onClose,
    onRemoved,
}: {
    open: boolean;
    member: HouseholdMember | null;
    householdId: string | null;
    /** Fires on backdrop tap, Cancel, or successful remove. */
    onClose: () => void;
    /** Fires after the row is deleted — parent should refetch members. */
    onRemoved: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset transient state whenever the sheet closes — otherwise an error
    // from a previous open would persist into the next render.
    const reset = () => {
        setRemoving(false);
        setError(null);
    };

    // Blur the kebab button that opened the sheet so its retained focus
    // doesn't end up inside the soon-to-be-aria-hidden background subtree.
    // Without this, Chromium logs an aria-hidden-on-focused-ancestor warning
    // every time the sheet opens.
    useEffect(() => {
        if (open) blurActiveElement();
    }, [open]);

    if (!member || !householdId) {
        // Render the Modal closed; this lets the parent always mount the
        // component without conditional logic.
        return <Modal visible={false} transparent />;
    }

    const isCaregiver = member.role === 'caregiver';
    const roleColor = member.color ?? colors.accent;
    const initial = (member.display_name?.[0] ?? '?').toUpperCase();
    const joinedLabel = (() => {
        try {
            return format(parseISO(member.joined_at), "MMM yyyy").toUpperCase();
        } catch {
            return '';
        }
    })();

    const handleRemove = async () => {
        if (removing) return;
        setRemoving(true);
        setError(null);
        try {
            await removeHouseholdMember(householdId, member.profile_id);
            onRemoved();
            reset();
            onClose();
        } catch (err) {
            console.error('removeHouseholdMember failed', err);
            const msg = errorMessage(err);
            setError(msg);
            // Surface a native Alert on iOS/Android too — the inline error
            // banner serves web well but a haptic Alert is the iOS norm.
            if (Platform.OS !== 'web') {
                Alert.alert("Couldn't remove member", msg);
            }
        } finally {
            setRemoving(false);
        }
    };

    const handleCancel = () => {
        if (removing) return;
        reset();
        onClose();
    };

    return (
        <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={handleCancel}
            statusBarTranslucent>
            <View style={styles.modalRoot}>
                {/* Backdrop — tap dismisses */}
                <Pressable
                    onPress={handleCancel}
                    accessibilityLabel="Dismiss"
                    style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                />
                {/* Sheet */}
                <View
                    style={[
                        styles.sheet,
                        { backgroundColor: colors.background },
                    ]}>
                    {/* Drag handle */}
                    <View style={styles.dragHandleWrap}>
                        <View
                            style={[
                                styles.dragHandle,
                                { backgroundColor: colors.inkFaint + '88' },
                            ]}
                        />
                    </View>

                    {/* Scrollable content */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scroll}
                        showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <ThemedText
                                style={[
                                    styles.headerLabel,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                MANAGE ACCESS
                            </ThemedText>
                            <Pressable
                                onPress={handleCancel}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                style={({ pressed }) => [
                                    styles.closeBtn,
                                    { backgroundColor: colors.backgroundInset },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather name="x" size={12} color={colors.inkSec} />
                            </Pressable>
                        </View>

                        {/* Hero */}
                        <View style={styles.hero}>
                            <View
                                style={[
                                    styles.heroAvatar,
                                    { backgroundColor: roleColor },
                                ]}>
                                <ThemedText style={styles.heroAvatarText}>
                                    {initial}
                                </ThemedText>
                            </View>
                            <View style={styles.heroBody}>
                                <ThemedText
                                    style={[styles.heroName, { color: colors.text }]}
                                    numberOfLines={1}>
                                    {member.display_name}
                                </ThemedText>
                                <View style={styles.heroPills}>
                                    <View
                                        style={[
                                            styles.rolePill,
                                            {
                                                backgroundColor: roleColor + '22',
                                                borderColor: roleColor + '55',
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.rolePillText,
                                                {
                                                    color: colors.text,
                                                    fontFamily: FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            {member.role.toUpperCase()}
                                        </ThemedText>
                                    </View>
                                    {joinedLabel ? (
                                        <View
                                            style={[
                                                styles.metaPill,
                                                { backgroundColor: colors.backgroundInset },
                                            ]}>
                                            <ThemedText
                                                style={[
                                                    styles.metaPillText,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily: FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                SINCE {joinedLabel}
                                            </ThemedText>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        {/* Current access summary */}
                        <View style={styles.cardWrap}>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.cardLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    CURRENT ACCESS
                                </ThemedText>
                                <AccessRow
                                    label="Sees family schedule"
                                    value={isCaregiver ? 'Read-only' : 'Full'}
                                    positive={!isCaregiver}
                                    colors={colors}
                                />
                                <AccessRow
                                    label="Completes assigned tasks"
                                    value="Allowed"
                                    positive
                                    colors={colors}
                                />
                                <AccessRow
                                    label="Edits events / custody"
                                    value={isCaregiver ? 'Blocked' : 'Allowed'}
                                    positive={!isCaregiver}
                                    negative={isCaregiver}
                                    colors={colors}
                                    last
                                />
                            </View>
                        </View>

                        {/* What happens warning */}
                        <View style={styles.cardWrap}>
                            <View
                                style={[
                                    styles.alertCard,
                                    {
                                        backgroundColor:
                                            BrandColors.error + (scheme === 'dark' ? '15' : '0F'),
                                        borderColor: BrandColors.error + '44',
                                        borderLeftColor: BrandColors.error,
                                    },
                                ]}>
                                <View style={styles.alertTitleRow}>
                                    <Feather
                                        name="alert-triangle"
                                        size={13}
                                        color={BrandColors.error}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.alertTitle,
                                            { color: BrandColors.error },
                                        ]}>
                                        This happens immediately
                                    </ThemedText>
                                </View>
                                <Consequence
                                    text={`${member.display_name} loses access to OneNest`}
                                    colors={colors}
                                />
                                <Consequence
                                    text={
                                        isCaregiver
                                            ? "Their upcoming task assignments unassign back to 'Anyone'"
                                            : "Their assigned events stay on the calendar but unassign back to 'Anyone'"
                                    }
                                    colors={colors}
                                />
                                <Consequence
                                    text="Today's scheduled push notifications will still send"
                                    colors={colors}
                                    last
                                />
                            </View>
                        </View>

                        {/* What stays */}
                        <View style={styles.cardWrap}>
                            <View
                                style={[
                                    styles.dashedCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <View style={styles.alertTitleRow}>
                                    <Feather
                                        name="check"
                                        size={13}
                                        color={colors.accent}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.alertTitle,
                                            { color: colors.text },
                                        ]}>
                                        What stays
                                    </ThemedText>
                                </View>
                                <Consequence
                                    text="Their completed tasks stay attributed to them"
                                    positive
                                    colors={colors}
                                />
                                <Consequence
                                    text="History &amp; activity log stays intact"
                                    positive
                                    colors={colors}
                                />
                                <Consequence
                                    text="Re-invite anytime — settings restore on accept"
                                    positive
                                    colors={colors}
                                    last
                                />
                            </View>
                        </View>

                        {error ? (
                            <View style={styles.cardWrap}>
                                <ThemedText
                                    type="small"
                                    style={{ color: BrandColors.error }}>
                                    {error}
                                </ThemedText>
                            </View>
                        ) : null}
                    </ScrollView>

                    {/* Sticky action bar */}
                    <View
                        style={[
                            styles.actionBar,
                            {
                                backgroundColor: colors.background,
                                borderTopColor: colors.hair,
                            },
                        ]}>
                        <Pressable
                            onPress={handleRemove}
                            disabled={removing}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${member.display_name}`}
                            style={({ pressed }) => [
                                styles.removeBtn,
                                {
                                    backgroundColor: BrandColors.error,
                                    opacity: removing ? 0.6 : 1,
                                },
                                pressed && !removing && styles.pressed,
                            ]}>
                            <Feather name="trash-2" size={14} color="#FFFFFF" />
                            <ThemedText style={styles.removeBtnText}>
                                {removing ? 'Removing…' : `Remove ${member.display_name}`}
                            </ThemedText>
                        </Pressable>
                        <Pressable
                            onPress={handleCancel}
                            disabled={removing}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            style={({ pressed }) => [
                                styles.cancelBtn,
                                pressed && !removing && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.cancelBtnText,
                                    { color: colors.inkSec },
                                ]}>
                                Cancel
                            </ThemedText>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function AccessRow({
    label,
    value,
    positive,
    negative,
    last,
    colors,
}: {
    label: string;
    value: string;
    positive?: boolean;
    negative?: boolean;
    last?: boolean;
    colors: Palette;
}) {
    const valueColor = positive
        ? colors.accent
        : negative
          ? BrandColors.error
          : colors.inkSec;
    return (
        <View
            style={[
                styles.accessRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <ThemedText
                style={[styles.accessLabel, { color: colors.text }]}>
                {label}
            </ThemedText>
            <ThemedText
                style={[
                    styles.accessValue,
                    {
                        color: valueColor,
                        fontFamily: FontFamily.monoMedium,
                        fontWeight: positive || negative ? '600' : '500',
                    },
                ]}>
                {value}
            </ThemedText>
        </View>
    );
}

function Consequence({
    text,
    positive,
    last,
    colors,
}: {
    text: string;
    positive?: boolean;
    last?: boolean;
    colors: Palette;
}) {
    return (
        <View
            style={[
                styles.consequence,
                !last && {
                    borderBottomColor: colors.hair + '55',
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View
                style={[
                    styles.consequenceDot,
                    {
                        backgroundColor: positive ? colors.accent : BrandColors.error,
                    },
                ]}
            />
            <ThemedText
                type="small"
                style={[styles.consequenceText, { color: colors.inkSec }]}>
                {/* decode &amp; that the design source uses */}
                {text.replace(/&amp;/g, '&')}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    // ── Sheet container
    sheet: {
        // The design pins the sheet top at y=200 of a 874 viewport.
        // On RN, set a maxHeight that approximates "covers the bottom
        // two thirds of the screen" so it looks consistent at all sizes.
        maxHeight: '78%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        ...SHEET_SHADOW,
    },

    dragHandleWrap: {
        paddingTop: 8,
        paddingBottom: 12,
        alignItems: 'center',
    },
    dragHandle: { width: 36, height: 4, borderRadius: 2 },

    scroll: { paddingBottom: 16 },

    // ── Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Hero
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    heroAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroAvatarText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        fontFamily: FontFamily.sansSemiBold,
    },
    heroBody: { flex: 1, minWidth: 0, gap: 6 },
    heroName: { fontSize: 20, fontWeight: '600', letterSpacing: -0.6 },
    heroPills: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },

    rolePill: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 3,
        borderWidth: StyleSheet.hairlineWidth,
    },
    rolePillText: { fontSize: 9.5, letterSpacing: 0.3 },
    metaPill: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 3,
    },
    metaPillText: { fontSize: 9.5, letterSpacing: 0.3 },

    // ── Cards
    cardWrap: { paddingHorizontal: 16, paddingBottom: 16 },
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    cardLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 10,
    },

    // ── Alert card (red, left-accent stripe)
    alertCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
    },
    alertTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    alertTitle: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 },

    // ── Dashed card (what stays)
    dashedCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },

    // ── Access rows
    accessRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 7,
    },
    accessLabel: { fontSize: 12.5, letterSpacing: -0.1 },
    accessValue: { fontSize: 11, letterSpacing: -0.2 },

    // ── Consequence bullets
    consequence: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: 5,
    },
    consequenceDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 7,
        flexShrink: 0,
    },
    consequenceText: { flex: 1, lineHeight: 18 },

    // ── Sticky action bar
    actionBar: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 8,
    },
    removeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    removeBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    cancelBtn: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    cancelBtnText: { fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },

    pressed: { opacity: 0.7 },
});
