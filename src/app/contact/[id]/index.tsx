// Contact detail — read-only view per the Phase 7 design (screens-extra.jsx:
// 1659-1855). Replaces the previous /contact/[id] which was the edit form;
// that's been relocated to /contact/[id]/edit.tsx. The detail screen here
// is the canonical landing page when a user taps a contact row in the
// Contacts list.
//
// Layout sections, top to bottom:
//   1. Top bar — back button + "CONTACT" mono pretitle + edit pencil
//   2. Hero — 100px category-tinted avatar with star badge (for favorites)
//      + name + descriptor + category pills
//   3. Quick actions — 4-button row (Call / Text / Email / Drive)
//   4. Contact SGroup — Phone / Email / Best time rows
//   5. Linked-to SGroup — child chips + linked event row (when set)
//   6. Address SGroup — placeholder map preview + address line + open-in-maps
//   7. Notes SGroup — multi-line text
//   8. History — DEFERRED (no audit log yet for contacts; see #310-ish)

import { Feather } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { CONTACT_CATEGORY_META } from '@/components/contact-form';
import { HairlineDivider } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import {
    getContact,
    getEvent,
    type Contact,
    type Event,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

// Widened palette — same pattern as Home / Family Hub.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// Initials picker — duplicated from the list screen rather than imported
// to keep the read-detail self-contained. Pulled into a shared util if
// any third caller needs it.
function initialsFor(name: string): string {
    const words = name.trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    const target = words.length > 1 ? words[words.length - 1] : (words[0] ?? name);
    return target
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 2)
        .toUpperCase() || '?';
}

export default function ContactDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const { children } = useChildren(household?.id);

    const [contact, setContact] = useState<Contact | null>(null);
    const [contactLoading, setContactLoading] = useState(true);
    // Resolve the linked event's title (if any) so the "Linked to" SGroup
    // shows useful copy rather than a bare id. Fetched after the contact
    // loads so we don't do two waterfall round-trips for contacts that
    // aren't event-linked.
    const [linkedEvent, setLinkedEvent] = useState<Event | null>(null);

    useEffect(() => {
        if (!id) {
            setContact(null);
            setContactLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const data = await getContact(id);
                if (cancelled) return;
                setContact(data);
                if (data?.linked_event_id) {
                    try {
                        const ev = await getEvent(data.linked_event_id);
                        if (!cancelled) setLinkedEvent(ev);
                    } catch (err) {
                        console.error('getEvent for linked contact failed', err);
                    }
                }
            } catch (err) {
                console.error('getContact failed', err);
                if (!cancelled) setContact(null);
            } finally {
                if (!cancelled) setContactLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const dial = useCallback(async () => {
        if (!contact?.phone) return;
        const target = contact.phone
            .trim()
            .replace(/[^\d+]/g, '')
            .replace(/(?!^)\+/g, ''); // strip non-leading +
        try {
            await Linking.openURL(`tel:${target}`);
        } catch {
            const msg =
                Platform.OS === 'web'
                    ? "Your browser couldn't open the phone link."
                    : "Couldn't open the phone app.";
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert("Can't dial", msg);
        }
    }, [contact?.phone]);

    const text = useCallback(async () => {
        if (!contact?.phone) return;
        const target = contact.phone.trim().replace(/[^\d+]/g, '');
        try {
            await Linking.openURL(`sms:${target}`);
        } catch {
            // sms: handlers are spotty on web; fail quietly.
        }
    }, [contact?.phone]);

    const email = useCallback(async () => {
        if (!contact?.email) return;
        try {
            await Linking.openURL(`mailto:${contact.email}`);
        } catch {
            // mailto: handlers are similar to sms: — fail quietly.
        }
    }, [contact?.email]);

    const directions = useCallback(async () => {
        if (!contact?.address) return;
        // Universal Google Maps deep link. Works as a web URL too, opening
        // maps.google.com in the user's default browser.
        const q = encodeURIComponent(contact.address);
        try {
            await Linking.openURL(`https://maps.google.com/?q=${q}`);
        } catch {
            // Fail quietly — the URL should always work in a browser.
        }
    }, [contact?.address]);

    if (authLoading || householdsLoading || roleLoading || contactLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!contact) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.notFound}>
                        <ThemedText type="subtitle">Contact not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            It may have been deleted.
                        </ThemedText>
                        <Pressable
                            onPress={() => router.replace('/contacts')}
                            style={styles.linkBtn}>
                            <ThemedText style={{ color: colors.accent }}>
                                Back to Contacts
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const meta = CONTACT_CATEGORY_META[contact.category];
    // Resolve the linked child (if linked_event has a single child). The
    // event's child_ids array can be empty (no child tagged); we show the
    // first child for now since the design's "For: <child chip>" treatment
    // is a single chip.
    const linkedChild = linkedEvent?.child_ids?.[0]
        ? (children ?? []).find((c) => c.id === linkedEvent.child_ids![0])
        : null;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Top bar: back + "CONTACT" pretitle + edit pencil. The
                        pencil routes to /contact/[id]/edit; caregivers see
                        the back affordance only (no edit). */}
                    <View style={styles.topBar}>
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
                            style={[
                                styles.topBarPretitle,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            CONTACT
                        </ThemedText>
                        {!isCaregiver ? (
                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: '/contact/[id]/edit',
                                        params: { id: contact.id },
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Edit contact"
                                style={({ pressed }) => [
                                    styles.topBarIconBtn,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather name="edit-2" size={13} color={colors.text} />
                            </Pressable>
                        ) : (
                            // Spacer so the pretitle stays centered when the
                            // edit button is hidden.
                            <View style={styles.topBarIconBtn} />
                        )}
                    </View>

                    {/* Hero — 100px ring + 84px inner avatar + name + role
                        + category pills. Favorite contacts get a small
                        accent badge with a star glyph bottom-right of the
                        ring (matches the design's accent-circle marker). */}
                    <View style={styles.hero}>
                        <View style={styles.heroAvatarWrap}>
                            <View
                                style={[
                                    styles.heroAvatarRing,
                                    {
                                        backgroundColor: withAlpha(meta.color, 0.13),
                                        borderColor: withAlpha(meta.color, 0.33),
                                    },
                                ]}>
                                <View
                                    style={[
                                        styles.heroAvatarInner,
                                        { backgroundColor: meta.color },
                                    ]}>
                                    <ThemedText style={styles.heroAvatarText}>
                                        {initialsFor(contact.name)}
                                    </ThemedText>
                                </View>
                            </View>
                            {contact.is_favorite ? (
                                <View
                                    style={[
                                        styles.heroStarBadge,
                                        {
                                            backgroundColor: colors.accent,
                                            borderColor: colors.background,
                                        },
                                    ]}>
                                    <Feather name="star" size={13} color={colors.onAccent} />
                                </View>
                            ) : null}
                        </View>
                        <ThemedText
                            style={[styles.heroName, { color: colors.text }]}
                            numberOfLines={2}>
                            {contact.name}
                        </ThemedText>
                        {contact.descriptor || contact.company ? (
                            <ThemedText
                                style={[styles.heroRole, { color: colors.textSecondary }]}
                                numberOfLines={2}>
                                {[contact.descriptor, contact.company]
                                    .filter((s): s is string => !!s)
                                    .join(' · ')}
                            </ThemedText>
                        ) : null}
                        <View style={styles.heroPills}>
                            <CategoryPill color={meta.color} label={meta.label} />
                            {contact.is_favorite ? (
                                <CategoryPill
                                    color={colors.accent}
                                    label="Favorite"
                                    icon="star"
                                />
                            ) : null}
                            {contact.is_emergency ? (
                                <CategoryPill
                                    color={CONTACT_CATEGORY_META.emergency.color}
                                    label="Emergency"
                                    icon="alert-triangle"
                                />
                            ) : null}
                        </View>
                    </View>

                    {/* Quick actions — 4-button row. Each tile is enabled
                        only when its underlying field is set; disabled
                        tiles drop to 0.4 opacity so the user understands
                        the state without trying. The Call tile is
                        accent-filled when active (primary action). */}
                    <View style={styles.actionsRow}>
                        <BigAction
                            icon="phone"
                            label="Call"
                            primary
                            enabled={!!contact.phone}
                            onPress={dial}
                            colors={colors}
                        />
                        <BigAction
                            icon="message-square"
                            label="Text"
                            enabled={!!contact.phone}
                            onPress={text}
                            colors={colors}
                        />
                        <BigAction
                            icon="mail"
                            label="Email"
                            enabled={!!contact.email}
                            onPress={email}
                            colors={colors}
                        />
                        <BigAction
                            icon="map-pin"
                            label="Drive"
                            enabled={!!contact.address}
                            onPress={directions}
                            colors={colors}
                        />
                    </View>

                    {/* Contact SGroup */}
                    <View style={styles.sgroup}>
                        <View style={styles.sgroupHeader}>
                            <ThemedText
                                style={[
                                    styles.sgroupLabel,
                                    {
                                        color: colors.inkSec,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                CONTACT
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.sgroupCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <DetailRow
                                label="Phone"
                                value={contact.phone || '—'}
                                mono
                                colors={colors}
                            />
                            <HairlineDivider />
                            <DetailRow
                                label="Email"
                                value={contact.email || '—'}
                                mono
                                colors={colors}
                            />
                            <HairlineDivider />
                            <DetailRow
                                label="Best time"
                                value={contact.best_time || '—'}
                                colors={colors}
                                last
                            />
                        </View>
                    </View>

                    {/* Linked-to SGroup — hidden when no event is linked.
                        Shows: a child chip (if the event tags a single
                        child) + the event title + recurrence/timing as
                        secondary mono text. */}
                    {linkedEvent ? (
                        <View style={styles.sgroup}>
                            <View style={styles.sgroupHeader}>
                                <ThemedText
                                    style={[
                                        styles.sgroupLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    LINKED TO
                                </ThemedText>
                            </View>
                            <View
                                style={[
                                    styles.sgroupCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {linkedChild ? (
                                    <View style={styles.linkedForRow}>
                                        <ThemedText
                                            style={[
                                                styles.linkedForLabel,
                                                {
                                                    color: colors.inkSec,
                                                    fontFamily: FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            FOR
                                        </ThemedText>
                                        <ChildBadge
                                            name={linkedChild.display_name}
                                            color={linkedChild.color}
                                            size="sm"
                                        />
                                        <ThemedText
                                            type="smallBold"
                                            style={{ color: colors.text }}>
                                            {linkedChild.display_name}
                                        </ThemedText>
                                    </View>
                                ) : null}
                                {linkedChild ? <HairlineDivider /> : null}
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: '/event/[id]',
                                            params: { id: linkedEvent.id },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open linked event ${linkedEvent.title}`}
                                    style={({ pressed }) => [
                                        styles.linkedEventRow,
                                        pressed && styles.pressed,
                                    ]}>
                                    <View
                                        style={[
                                            styles.linkedEventRail,
                                            { backgroundColor: colors.accent },
                                        ]}
                                    />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <ThemedText
                                            type="smallBold"
                                            numberOfLines={1}
                                            style={{ color: colors.text }}>
                                            {linkedEvent.title}
                                        </ThemedText>
                                        <ThemedText
                                            numberOfLines={1}
                                            style={[
                                                styles.linkedEventMeta,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily: FontFamily.monoMedium,
                                                },
                                            ]}>
                                            {linkedEvent.recurrence_rule
                                                ? 'Recurring · '
                                                : ''}
                                            {linkedEvent.all_day
                                                ? 'All day'
                                                : new Date(
                                                      linkedEvent.starts_at,
                                                  ).toLocaleString()}
                                        </ThemedText>
                                    </View>
                                    <Feather
                                        name="chevron-right"
                                        size={14}
                                        color={colors.inkFaint}
                                    />
                                </Pressable>
                            </View>
                        </View>
                    ) : null}

                    {/* Address SGroup — hidden when no address. The map
                        preview is a static colored band for now (matches
                        the design's geometric placeholder); real map
                        rendering lands when map-preview component is
                        extended to plain-text addresses (Phase 5 follow-
                        up #309 is the analogous EventDetail piece). */}
                    {contact.address ? (
                        <View style={styles.sgroup}>
                            <View style={styles.sgroupHeader}>
                                <ThemedText
                                    style={[
                                        styles.sgroupLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ADDRESS
                                </ThemedText>
                            </View>
                            <View
                                style={[
                                    styles.sgroupCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <View
                                    style={[
                                        styles.addressMapPlaceholder,
                                        {
                                            backgroundColor: colors.backgroundInset,
                                            borderBottomColor: colors.hair,
                                        },
                                    ]}>
                                    <View
                                        style={[
                                            styles.addressPin,
                                            { backgroundColor: colors.accent },
                                        ]}>
                                        <Feather
                                            name="map-pin"
                                            size={14}
                                            color={colors.onAccent}
                                        />
                                    </View>
                                </View>
                                <Pressable
                                    onPress={directions}
                                    accessibilityRole="button"
                                    accessibilityLabel="Open in Maps"
                                    style={({ pressed }) => [
                                        styles.addressBody,
                                        pressed && styles.pressed,
                                    ]}>
                                    <View style={{ flex: 1 }}>
                                        <ThemedText
                                            type="smallBold"
                                            style={{ color: colors.text }}>
                                            {contact.address}
                                        </ThemedText>
                                        <ThemedText
                                            style={[
                                                styles.addressHint,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily: FontFamily.monoMedium,
                                                },
                                            ]}>
                                            Tap to open in Maps
                                        </ThemedText>
                                    </View>
                                    <Feather
                                        name="chevron-right"
                                        size={14}
                                        color={colors.inkFaint}
                                    />
                                </Pressable>
                            </View>
                        </View>
                    ) : null}

                    {/* Notes SGroup — hidden when blank. Free-form text
                        rendered with relaxed line-height for readability. */}
                    {contact.notes ? (
                        <View style={styles.sgroup}>
                            <View style={styles.sgroupHeader}>
                                <ThemedText
                                    style={[
                                        styles.sgroupLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily: FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    NOTES
                                </ThemedText>
                            </View>
                            <View
                                style={[
                                    styles.sgroupCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <View style={styles.notesBody}>
                                    <ThemedText
                                        style={[
                                            Typography.bodySm,
                                            { color: colors.text, lineHeight: 20 },
                                        ]}>
                                        {contact.notes}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    ) : null}

                    {/* History — DEFERRED. The design includes an audit log
                        ("Riley added · 9 mo", "Alex marked as favorite ·
                        5 mo") that requires an activity_events table we
                        don't have yet. Adding a placeholder with fake data
                        would feel dishonest; better to ship the surface
                        when the eventing pipeline lands. */}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── DetailRow ──────────────────────────────────────────────────────────────
//
// Single label/value row inside an SGroup card. Value can be plain or mono
// (for phone numbers, emails — anything where character alignment matters).

function DetailRow({
    label,
    value,
    mono,
    last,
    colors,
}: {
    label: string;
    value: string;
    mono?: boolean;
    last?: boolean;
    colors: Palette;
}) {
    return (
        <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
            <ThemedText
                type="smallBold"
                style={{ color: colors.text, flex: 1 }}>
                {label}
            </ThemedText>
            <ThemedText
                numberOfLines={1}
                style={{
                    color: value === '—' ? colors.inkFaint : colors.text,
                    fontFamily: mono ? FontFamily.monoMedium : undefined,
                    fontSize: 13,
                    fontWeight: '500',
                }}>
                {value}
            </ThemedText>
        </View>
    );
}

// ─── CategoryPill ──────────────────────────────────────────────────────────

function CategoryPill({
    color,
    label,
    icon,
}: {
    color: string;
    label: string;
    icon?: React.ComponentProps<typeof Feather>['name'];
}) {
    return (
        <View
            style={[
                styles.categoryPill,
                {
                    backgroundColor: withAlpha(color, 0.13),
                    borderColor: withAlpha(color, 0.33),
                },
            ]}>
            {icon ? <Feather name={icon} size={9} color={color} /> : null}
            <ThemedText
                style={[
                    styles.categoryPillText,
                    { color, fontFamily: FontFamily.monoSemiBold },
                ]}>
                {label.toUpperCase()}
            </ThemedText>
        </View>
    );
}

// ─── BigAction ─────────────────────────────────────────────────────────────

function BigAction({
    icon,
    label,
    primary,
    enabled,
    onPress,
    colors,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    /** True for the Call tile — fills with accent. */
    primary?: boolean;
    enabled: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    const tileBg = primary
        ? colors.accent
        : enabled
          ? colors.backgroundElement
          : colors.backgroundElement;
    const tileBorder = primary ? colors.accent : colors.hair;
    const iconColor = primary
        ? colors.onAccent
        : enabled
          ? colors.text
          : colors.inkFaint;
    const labelColor = primary
        ? colors.onAccent
        : enabled
          ? colors.text
          : colors.textSecondary;

    return (
        <Pressable
            onPress={onPress}
            disabled={!enabled}
            accessibilityRole="button"
            accessibilityLabel={`${label}${enabled ? '' : ' (not available — field is empty)'}`}
            style={({ pressed }) => [
                styles.bigAction,
                {
                    backgroundColor: tileBg,
                    borderColor: tileBorder,
                    opacity: enabled ? 1 : 0.4,
                },
                pressed && enabled && styles.pressed,
            ]}>
            <Feather name={icon} size={18} color={iconColor} />
            <ThemedText
                type="small"
                style={{ color: labelColor, fontWeight: '600' }}>
                {label}
            </ThemedText>
        </Pressable>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: Spacing.six },

    // Top bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    topBarIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarPretitle: { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },

    // Hero
    hero: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 6, alignItems: 'center' },
    heroAvatarWrap: { position: 'relative', marginBottom: 16 },
    heroAvatarRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroAvatarInner: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroAvatarText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: -0.6,
    },
    heroStarBadge: {
        position: 'absolute',
        bottom: 0,
        right: 5,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroName: {
        fontSize: 24,
        fontWeight: '600',
        letterSpacing: -0.7,
        textAlign: 'center',
        lineHeight: 28,
    },
    heroRole: { fontSize: 13, marginTop: 4, textAlign: 'center' },
    heroPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'center',
        marginTop: 10,
    },
    categoryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    categoryPillText: { fontSize: 10, letterSpacing: 0.3 },

    // Quick actions row
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 18,
    },
    bigAction: {
        flex: 1,
        height: 64,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },

    // SGroup
    sgroup: { marginBottom: 18, gap: 8 },
    sgroupHeader: { paddingHorizontal: 24 },
    sgroupLabel: { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
    sgroupCard: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // DetailRow
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },

    // Linked-to
    linkedForRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    linkedForLabel: { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
    linkedEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    linkedEventRail: { width: 3, height: 32, borderRadius: 2 },
    linkedEventMeta: { fontSize: 10.5, letterSpacing: -0.2, marginTop: 1 },

    // Address
    addressMapPlaceholder: {
        height: 110,
        borderBottomWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressPin: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    addressHint: { fontSize: 11, marginTop: 2, letterSpacing: -0.2 },

    // Notes
    notesBody: { paddingHorizontal: 14, paddingVertical: 12 },

    // Not found
    notFound: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.three,
        padding: Spacing.four,
    },
    center: { textAlign: 'center' },
    linkBtn: { padding: Spacing.two },

    pressed: { opacity: 0.7 },
});
