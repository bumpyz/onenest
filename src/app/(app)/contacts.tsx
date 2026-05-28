// Contacts tab — household-scoped quick-dial directory, redesigned per
// Phase 7 (screens-extra.jsx:1238-1444). The screen is reachable through
// Family Hub's Manage list (the Contacts tab was removed in Phase 6.1).
//
// Layout sections, top to bottom:
//   1. Header — mono pretitle ("N PEOPLE · M ALERTS") + "Contacts" title +
//      30×30 search button.
//   2. Search bar — text input that filters by name / descriptor / company /
//      phone substring. A ⌘F kbd badge sits on the right for the desktop
//      vocabulary.
//   3. Category chips — All + every category present in this household.
//      Tap to filter the sections below.
//   4. Emergency strip — alert-tinted card pinned above the categorized
//      list. Includes a 911 dial tile + every contact flagged is_emergency.
//      Hidden when no emergency contacts.
//   5. Favorites strip — horizontal scroll of contacts flagged is_favorite,
//      rendered as larger color-ringed avatars. Hidden when none.
//   6. Categorized sections — Medical / School / Activities / Family / Other
//      cards. Each shows a SectionHeader with count + a card of ContactRows.
//   7. FAB — "New contact" pill (parent-only).
//
// Tapping a row body navigates to /contact/[id] (the new read-only detail
// screen landing in Phase 7.4). The trailing phone icon dials directly.

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { HairlineDivider, SectionHeader } from '@/components/ds';
import { initialsFor } from '@/components/initials-avatar';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useContacts } from '@/hooks/use-contacts';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import {
    CONTACT_CATEGORIES,
    getContactAvatarSignedUrl,
    type Contact,
    type ContactCategory,
} from '@/lib/db';
import { HEAVY_FAB_SHADOW, withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';
import { CONTACT_CATEGORY_META } from '@/components/contact-form';

// Palette widened to accept both Colors.light and Colors.dark literal
// types — see (app)/index.tsx for the rationale.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// `tel:` target builder. Mirrors the helper from the pre-Phase-7 screen —
// strip non-digits, preserve leading `+`. Stays inline (the export was
// only consumed locally).
function telTarget(phone: string): string {
    const trimmed = phone.trim();
    const leadingPlus = trimmed.startsWith('+') ? '+' : '';
    return `${leadingPlus}${trimmed.replace(/[^\d]/g, '')}`;
}

// Initials for the category-tinted avatar use the shared `initialsFor`
// helper exported by InitialsAvatar so the Contacts list, the
// individual contact detail screen, and the edit form all render the
// same letters — first-letter-of-first-word + first-letter-of-second-
// word ("Maria Garcia" → "MG"). The earlier ad-hoc rule here took the
// LAST word's first two letters ("Maria Garcia" → "GA"), which
// disagreed with the edit screen and surfaced as a UI inconsistency.

export default function ContactsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const {
        contacts,
        isLoading: contactsLoading,
        refetch: refetchContacts,
    } = useContacts(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const showCreateAffordances = !roleLoading && !isCaregiver;

    useFocusEffect(
        useCallback(() => {
            refetchContacts();
        }, [refetchContacts]),
    );

    // Signed-URL cache keyed by contact id. Same pattern as the previous
    // implementation — sign on focus, hold until the contacts list changes.
    const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const next: Record<string, string> = {};
            for (const c of contacts ?? []) {
                if (!c.avatar_url) continue;
                const url = await getContactAvatarSignedUrl(c.avatar_url);
                if (url) next[c.id] = url;
            }
            if (!cancelled) setAvatarUrls(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [contacts]);

    // ── Filter state ─────────────────────────────────────────────────────
    const [searchText, setSearchText] = useState('');
    // `null` = "All". Set to a specific category to filter the sections
    // below. Emergency + Favorites strips are unaffected by the chip
    // filter — they always show their full sets (matches the design's
    // "always pinned" treatment).
    const [categoryFilter, setCategoryFilter] = useState<ContactCategory | null>(null);

    // ── Derived data ─────────────────────────────────────────────────────
    const allContacts = contacts ?? [];

    // Text-search filter applies after category. We do a forgiving
    // substring match across name / descriptor / company / phone so users
    // can find "Dr. Patel" by typing "patel" OR "pediatric" OR "555".
    const filteredContacts = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        return allContacts.filter((c) => {
            if (categoryFilter && c.category !== categoryFilter) return false;
            if (!q) return true;
            const hay = [c.name, c.descriptor, c.company, c.phone]
                .filter((s): s is string => !!s)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [allContacts, searchText, categoryFilter]);

    const favorites = useMemo(
        () => allContacts.filter((c) => c.is_favorite),
        [allContacts],
    );
    const emergencyContacts = useMemo(
        () => allContacts.filter((c) => c.is_emergency),
        [allContacts],
    );

    // Group filtered contacts by category for the bottom sections. We use
    // a Map keyed by category so we can iterate in CONTACT_CATEGORIES order
    // and render only the categories that have at least one contact in
    // the current filter set.
    const contactsByCategory = useMemo(() => {
        const m = new Map<ContactCategory, Contact[]>();
        for (const cat of CONTACT_CATEGORIES) m.set(cat, []);
        for (const c of filteredContacts) {
            m.get(c.category)?.push(c);
        }
        return m;
    }, [filteredContacts]);

    // Categories present in the chip strip = "All" + any category that has
    // contacts in the household. Sorting by CONTACT_CATEGORIES order keeps
    // the chip ordering stable across renders.
    const availableCategories = useMemo(() => {
        const present = new Set<ContactCategory>();
        for (const c of allContacts) present.add(c.category);
        return CONTACT_CATEGORIES.filter((cat) => present.has(cat));
    }, [allContacts]);

    // ── Handlers ─────────────────────────────────────────────────────────
    const dialContact = useCallback(
        async (contact: Contact) => {
            const target = telTarget(contact.phone);
            if (!target || target === '+') {
                const msg = "That contact's phone number doesn't have any digits.";
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert("Can't dial", msg);
                return;
            }
            const url = `tel:${target}`;
            const proceed =
                Platform.OS === 'web'
                    ? typeof window !== 'undefined' &&
                      window.confirm(
                          `Call ${contact.name}${contact.phone ? ` at ${contact.phone}` : ''}?`,
                      )
                    : await new Promise<boolean>((resolve) => {
                          Alert.alert(`Call ${contact.name}?`, contact.phone, [
                              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                              { text: 'Call', onPress: () => resolve(true) },
                          ]);
                      });
            if (!proceed) return;
            try {
                await Linking.openURL(url);
            } catch (err) {
                console.error('tel: openURL failed', err);
                const msg =
                    Platform.OS === 'web'
                        ? "Your browser couldn't open the phone link. Copy the number manually."
                        : "Couldn't open the phone app.";
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert("Can't dial", msg);
            }
        },
        [],
    );

    const dial911 = useCallback(async () => {
        // No confirm — 911 is a dial-or-die affordance. On web `tel:911`
        // routes to whatever handles tel:, which on most desktops is
        // nothing. Native is the realistic use case.
        try {
            await Linking.openURL('tel:911');
        } catch {
            const msg =
                Platform.OS === 'web'
                    ? 'Your browser may not be able to dial. On native, this would call 911.'
                    : "Couldn't open the phone app.";
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Emergency', msg);
        }
    }, []);

    const openContact = useCallback(
        (id: string) => router.push({ pathname: '/contact/[id]', params: { id } }),
        [router],
    );

    if (householdsLoading) return <LoadingScreen />;
    if (!household) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <ThemedText themeColor="textSecondary" style={styles.empty}>
                        No household.
                    </ThemedText>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const totalCount = allContacts.length;
    // The design's "N NEEDS UPDATING" pretitle counts contacts that haven't
    // been touched in ~6 months. We don't have a stale signal yet, so this
    // is a stand-in: count contacts missing a phone OR address OR email AND
    // not flagged emergency (incomplete-but-not-critical rows). Worth
    // revisiting when we add a real stale-detection signal — see #310-ish.
    const needsUpdatingCount = allContacts.filter(
        (c) => !c.is_emergency && (!c.phone || c.phone.trim().length === 0),
    ).length;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Header — mono pretitle + "Contacts" title. The
                        previous decorative top-right search button is
                        gone: the search input below already exposes a
                        real text field with its own search glyph + ⌘F
                        keyboard hint, so the icon-only button on the
                        header was redundant chrome. */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <ThemedText
                                style={[
                                    styles.headerPretitle,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}
                                numberOfLines={1}>
                                {totalCount} {totalCount === 1 ? 'PERSON' : 'PEOPLE'}
                                {needsUpdatingCount > 0
                                    ? ` · ${needsUpdatingCount} INCOMPLETE`
                                    : ''}
                            </ThemedText>
                            <ThemedText
                                style={[Typography.titleSecondary, { color: colors.text }]}>
                                Contacts
                            </ThemedText>
                        </View>
                    </View>

                    {/* Search bar. Real text input — filters the lists below
                        as the user types. ⌘F kbd badge mirrors the design's
                        desktop shortcut hint; we don't actually wire a
                        keybinding (yet). */}
                    <View
                        style={[
                            styles.searchBar,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <Feather name="search" size={14} color={colors.textSecondary} />
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="name, role, #phone…"
                            placeholderTextColor={colors.inkFaint}
                            style={[
                                styles.searchInput,
                                {
                                    color: colors.text,
                                    fontFamily: FontFamily.monoMedium,
                                },
                                // RN-Web only: strip the default browser
                                // input outline so the field reads as part
                                // of the bar shell. `outlineStyle` isn't in
                                // RN's TextStyle type, so we cast on the
                                // platform branch instead of typing the
                                // whole searchInput style with it.
                                Platform.OS === 'web'
                                    ? ({ outlineStyle: 'none' } as object)
                                    : null,
                            ]}
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect={false}
                        />
                        <View
                            style={[
                                styles.searchKbd,
                                { backgroundColor: colors.backgroundInset },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.searchKbdText,
                                    { color: colors.textSecondary, fontFamily: FontFamily.monoRegular },
                                ]}>
                                ⌘F
                            </ThemedText>
                        </View>
                    </View>

                    {/* Category chips. "All" + every category present in
                        the household. Hidden entirely when there are no
                        contacts yet (the empty state below takes the slot).
                        Active chip always fills with the theme accent per
                        design CChip (direction-c-pro.jsx:881-894) — the
                        identity color goes on a small leading dot when
                        the chip is inactive, not on the active fill. The
                        "All" chip has no dot since it represents the
                        unfiltered set. */}
                    {totalCount > 0 ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipStrip}>
                            <CategoryChip
                                label={`All · ${totalCount}`}
                                selected={categoryFilter === null}
                                onPress={() => setCategoryFilter(null)}
                                colors={colors}
                            />
                            {availableCategories.map((cat) => {
                                const meta = CONTACT_CATEGORY_META[cat];
                                return (
                                    <CategoryChip
                                        key={cat}
                                        label={meta.label}
                                        dotColor={meta.color}
                                        selected={categoryFilter === cat}
                                        onPress={() =>
                                            setCategoryFilter(
                                                categoryFilter === cat ? null : cat,
                                            )
                                        }
                                        colors={colors}
                                    />
                                );
                            })}
                        </ScrollView>
                    ) : null}

                    {/* Emergency strip. Always renders — the 911 dial is
                        a meaningful affordance on its own and shouldn't be
                        gated behind the user remembering to flag a contact
                        as emergency. When the user has flagged emergency
                        contacts they appear to the right of the 911 tile;
                        when they haven't, the strip is just the 911 dial
                        + a brief "+ Add" hint so the empty state reads as
                        intentional rather than orphaned. */}
                    <View
                        style={[
                            styles.emergencyCard,
                            {
                                backgroundColor: withAlpha(BrandColors.error, 0.13),
                                borderColor: withAlpha(BrandColors.error, 0.33),
                            },
                        ]}>
                        <View style={styles.emergencyHeader}>
                            <View
                                style={[
                                    styles.emergencyDot,
                                    { backgroundColor: BrandColors.error },
                                ]}
                            />
                            <ThemedText
                                style={[
                                    styles.emergencyLabel,
                                    {
                                        color: BrandColors.error,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                EMERGENCY · ALWAYS VISIBLE
                            </ThemedText>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.emergencyTileRow}>
                            <EmergencyTile
                                label="911"
                                sub="Dial"
                                alert
                                onPress={dial911}
                                colors={colors}
                            />
                            {emergencyContacts.map((c) => (
                                <EmergencyTile
                                    key={c.id}
                                    label={c.name.split(' ')[0]}
                                    sub={c.descriptor ?? 'Emergency'}
                                    initials={initialsFor(c.name)}
                                    color={CONTACT_CATEGORY_META[c.category].color}
                                    onPress={() => openContact(c.id)}
                                    colors={colors}
                                />
                            ))}
                            {/* Empty-state hint when no flagged contacts yet —
                                a dashed-border tile that opens /contact/new
                                with is_emergency pre-checked. Keeps the strip
                                from looking like "just one tile" while also
                                surfacing the missing-data signal in-place. */}
                            {emergencyContacts.length === 0 ? (
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: '/contact/new',
                                            params: { emergency: '1' },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel="Add an emergency contact"
                                    style={({ pressed }) => [
                                        styles.emergencyTile,
                                        styles.emergencyAddTile,
                                        {
                                            borderColor: withAlpha(BrandColors.error, 0.45),
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View
                                        style={[
                                            styles.emergencyTileInitial,
                                            {
                                                backgroundColor: 'transparent',
                                                borderWidth: 1.2,
                                                borderColor: withAlpha(
                                                    BrandColors.error,
                                                    0.45,
                                                ),
                                                borderStyle: 'dashed',
                                            },
                                        ]}>
                                        <Feather
                                            name="plus"
                                            size={16}
                                            color={BrandColors.error}
                                        />
                                    </View>
                                    <ThemedText
                                        style={[
                                            styles.emergencyTileLabel,
                                            { color: BrandColors.error },
                                        ]}
                                        numberOfLines={1}>
                                        Add
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.emergencyTileSub,
                                            {
                                                color: withAlpha(BrandColors.error, 0.75),
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}
                                        numberOfLines={1}>
                                        Doctor, school…
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                        </ScrollView>
                    </View>

                    {/* Favorites strip. Horizontal scroll of large color-
                        ringed avatars + name + role caption. Hidden when
                        no favorites. */}
                    {favorites.length > 0 ? (
                        <>
                            <View style={styles.sectionLabelWrap}>
                                <SectionHeader label="Favorites" />
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.favStrip}>
                                {favorites.map((c) => (
                                    <FavoriteTile
                                        key={c.id}
                                        contact={c}
                                        onPress={() => openContact(c.id)}
                                        colors={colors}
                                    />
                                ))}
                            </ScrollView>
                        </>
                    ) : null}

                    {/* Empty state — no contacts in the household yet. We
                        render this BEFORE the per-category sections (which
                        would all be empty) so the screen has something
                        meaningful at the spot where the list would be. */}
                    {contactsLoading && !contacts ? (
                        <View style={styles.empty}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Loading…
                            </ThemedText>
                        </View>
                    ) : totalCount === 0 ? (
                        <View style={styles.empty}>
                            <ThemedText themeColor="textSecondary" style={styles.center}>
                                No contacts yet.
                            </ThemedText>
                            {showCreateAffordances ? (
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small"
                                    style={styles.center}>
                                    Tap "Add contact" to start your roster.
                                </ThemedText>
                            ) : (
                                <ThemedText
                                    themeColor="textSecondary"
                                    type="small"
                                    style={styles.center}>
                                    Ask a parent in your household to add some.
                                </ThemedText>
                            )}
                        </View>
                    ) : null}

                    {/* Per-category sections. Render in CONTACT_CATEGORIES
                        order, skipping any with zero contacts in the
                        filtered set. The "Other" bucket catches contacts
                        the user hasn't categorized yet. */}
                    {CONTACT_CATEGORIES.map((cat) => {
                        const rows = contactsByCategory.get(cat) ?? [];
                        if (rows.length === 0) return null;
                        const meta = CONTACT_CATEGORY_META[cat];
                        return (
                            <View key={cat} style={styles.sectionWrap}>
                                <View style={styles.sectionLabelWrap}>
                                    <SectionHeader
                                        label={`${meta.label} · ${rows.length}`}
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.sectionCard,
                                        {
                                            backgroundColor: colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {rows.map((c, i) => (
                                        <View key={c.id}>
                                            {i > 0 ? (
                                                <HairlineDivider insetLeft={Spacing.three} />
                                            ) : null}
                                            <ContactRow
                                                contact={c}
                                                avatarUrl={avatarUrls[c.id] ?? null}
                                                onOpen={() => openContact(c.id)}
                                                onDial={() => dialContact(c)}
                                                colors={colors}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        );
                    })}

                    {/* Bottom padding so the FAB doesn't sit on top of
                        the last category card's bottom edge. */}
                    <View style={{ height: Spacing.six * 2 }} />
                </ScrollView>
            </SafeAreaView>

            {/* FAB — pill-shaped "New contact". Parent-only. Per the v2 FAB
                consistency rule
                (docs/design-handoffs/onenest-spec-v2/design_handoff_fab_rule/README.md):
                Contacts is a kind-committed tab (contacts are the content), so
                the label uses the `New <kind>` verb pattern shared across all
                kind-committed tabs (Calendar → "New event", Lists → "New task",
                etc.). The destination is unchanged. */}
            {showCreateAffordances ? (
                <Pressable
                    onPress={() => router.push('/contact/new')}
                    accessibilityRole="button"
                    accessibilityLabel="New contact"
                    style={({ pressed }) => [
                        styles.fab,
                        { backgroundColor: colors.accent },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="plus" size={18} color={colors.onAccent} />
                    <ThemedText
                        style={[styles.fabText, { color: colors.onAccent }]}>
                        New contact
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedView>
    );
}

// ─── CategoryChip ───────────────────────────────────────────────────────────
//
// Small filter chip in the horizontal strip. Implements the design's CChip
// pattern exactly (direction-c-pro.jsx:881-894):
//   • Active   — fills with theme accent + onAccent text. No identity dot
//                (the accent fill IS the selection signal; an identity dot
//                on top would compete for attention).
//   • Inactive — card surface + hair border + optional 6px identity dot in
//                the category color, leading the label.
//
// The "All" chip omits the dot since it isn't tied to a specific category.

function CategoryChip({
    label,
    dotColor,
    selected,
    onPress,
    colors,
}: {
    label: string;
    /** Identity color for the inactive-state leading dot. Omit for chips
     *  that don't represent a single category (e.g. the "All" filter). */
    dotColor?: string;
    selected: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${label}`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
                styles.categoryChip,
                {
                    backgroundColor: selected
                        ? colors.accent
                        : colors.backgroundElement,
                    borderColor: selected ? colors.accent : colors.hair,
                },
                pressed && styles.pressed,
            ]}>
            {!selected && dotColor ? (
                <View
                    style={[
                        styles.categoryChipDot,
                        { backgroundColor: dotColor },
                    ]}
                />
            ) : null}
            <ThemedText
                style={[
                    styles.categoryChipText,
                    {
                        color: selected ? colors.onAccent : colors.text,
                        fontFamily: FontFamily.sansSemiBold,
                    },
                ]}>
                {label}
            </ThemedText>
        </Pressable>
    );
}

// ─── EmergencyTile ─────────────────────────────────────────────────────────
//
// Single tile inside the Emergency strip. Two flavors:
//   • alert: solid red bg with white phone icon (the 911 dial tile)
//   • contact: white-card bg with category-tinted initial badge
// Tap → onPress (dial for 911, openContact for contacts).

function EmergencyTile({
    label,
    sub,
    alert,
    initials,
    color,
    onPress,
    colors,
}: {
    label: string;
    sub: string;
    alert?: boolean;
    initials?: string;
    color?: string;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={alert ? 'Dial 911' : `Open ${label}`}
            style={({ pressed }) => [
                styles.emergencyTile,
                {
                    backgroundColor: alert ? BrandColors.error : colors.backgroundElement,
                    borderColor: alert ? BrandColors.error : colors.hair,
                },
                pressed && styles.pressed,
            ]}>
            {alert ? (
                <View style={styles.emergencyTileIconAlert}>
                    <Feather name="phone" size={14} color="#FFFFFF" />
                </View>
            ) : initials ? (
                <View
                    style={[
                        styles.emergencyTileInitial,
                        { backgroundColor: color ?? colors.accent },
                    ]}>
                    <ThemedText style={styles.emergencyTileInitialText}>
                        {initials}
                    </ThemedText>
                </View>
            ) : null}
            <ThemedText
                numberOfLines={1}
                style={[
                    styles.emergencyTileLabel,
                    { color: alert ? '#FFFFFF' : colors.text },
                ]}>
                {label}
            </ThemedText>
            <ThemedText
                numberOfLines={1}
                style={[
                    styles.emergencyTileSub,
                    {
                        color: alert ? withAlpha('#FFFFFF', 0.7) : colors.textSecondary,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {sub}
            </ThemedText>
        </Pressable>
    );
}

// ─── FavoriteTile ──────────────────────────────────────────────────────────
//
// Big circular avatar inside a color-tinted ring. Used in the horizontal
// Favorites scroll above the categorized list. Tap → openContact.

function FavoriteTile({
    contact,
    onPress,
    colors,
}: {
    contact: Contact;
    onPress: () => void;
    colors: Palette;
}) {
    const meta = CONTACT_CATEGORY_META[contact.category];
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Open ${contact.name}`}
            style={({ pressed }) => [styles.favTile, pressed && styles.pressed]}>
            <View
                style={[
                    styles.favRing,
                    {
                        backgroundColor: withAlpha(meta.color, 0.13),
                        borderColor: withAlpha(meta.color, 0.33),
                    },
                ]}>
                <View style={[styles.favInner, { backgroundColor: meta.color }]}>
                    <ThemedText style={styles.favInitialText}>
                        {initialsFor(contact.name)[0]}
                    </ThemedText>
                </View>
            </View>
            <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={{ color: colors.text, textAlign: 'center' }}>
                {contact.name.split(' ').slice(0, 2).join(' ')}
            </ThemedText>
            {contact.descriptor ? (
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.favRole,
                        { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                    ]}>
                    {contact.descriptor}
                </ThemedText>
            ) : null}
        </Pressable>
    );
}

// ─── ContactRow ─────────────────────────────────────────────────────────────
//
// Single contact in a categorized section card. Layout:
//   [category-tinted 40px avatar with category badge] [name + meta] [phone btn]
//
// Tap the body → openContact (detail screen).
// Tap the trailing phone button → dialContact.

function ContactRow({
    contact,
    avatarUrl,
    onOpen,
    onDial,
    colors,
}: {
    contact: Contact;
    /** Pre-signed URL for an uploaded avatar, when present. Phase 7 keeps
     *  the category-tinted initials avatar even when a photo is set so the
     *  visual category cue isn't lost — the photo would replace the badge
     *  in a future iteration. For now we ignore avatarUrl in the list view. */
    avatarUrl: string | null;
    onOpen: () => void;
    onDial: () => void;
    colors: Palette;
}) {
    const meta = CONTACT_CATEGORY_META[contact.category];
    // `avatarUrl` is unused in this render pass — see prop doc above. Refer
    // to it once so unused-prop lints don't fire.
    void avatarUrl;
    return (
        <View style={styles.row}>
            <Pressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={`Open ${contact.name}`}
                style={({ pressed }) => [
                    styles.rowBody,
                    pressed && styles.pressed,
                ]}>
                <View
                    style={[
                        styles.rowAvatar,
                        {
                            backgroundColor: withAlpha(meta.color, 0.13),
                            borderColor: withAlpha(meta.color, 0.33),
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.rowAvatarText,
                            { color: meta.color },
                        ]}>
                        {initialsFor(contact.name)}
                    </ThemedText>
                </View>
                <View style={styles.rowMain}>
                    <View style={styles.rowTitleRow}>
                        <ThemedText
                            type="smallBold"
                            numberOfLines={1}
                            style={{ color: colors.text, flex: 1 }}>
                            {contact.name}
                        </ThemedText>
                        {contact.is_favorite ? (
                            <Feather name="star" size={11} color={colors.accent} />
                        ) : null}
                    </View>
                    {contact.descriptor || contact.company ? (
                        <ThemedText
                            numberOfLines={1}
                            style={[
                                styles.rowSub,
                                { color: colors.textSecondary },
                            ]}>
                            {[contact.descriptor, contact.company]
                                .filter((s): s is string => !!s)
                                .join(' · ')}
                        </ThemedText>
                    ) : null}
                    {contact.phone ? (
                        <ThemedText
                            numberOfLines={1}
                            style={[
                                styles.rowPhone,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            {contact.phone}
                        </ThemedText>
                    ) : null}
                </View>
            </Pressable>
            {contact.phone ? (
                <Pressable
                    onPress={onDial}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${contact.name}`}
                    style={({ pressed }) => [
                        styles.rowDialBtn,
                        {
                            backgroundColor: withAlpha(colors.accent, 0.13),
                            borderColor: withAlpha(colors.accent, 0.33),
                        },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="phone" size={14} color={colors.accent} />
                </Pressable>
            ) : null}
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: Spacing.six },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 6,
        gap: Spacing.two,
    },
    headerPretitle: { fontSize: 10, letterSpacing: -0.2 },

    // Search bar
    searchBar: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        letterSpacing: -0.2,
        // RN-Web outline-removal happens inline at the JSX call site
        // (the `outlineStyle: 'none'` cast), not here — RN's TextStyle
        // type doesn't include the property.
    },
    searchKbd: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 3,
    },
    searchKbdText: { fontSize: 9.5, letterSpacing: -0.2 },

    // Chip strip
    chipStrip: {
        paddingHorizontal: 16,
        paddingBottom: 18,
        gap: 6,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    // 6px identity dot per design CChip ~891 — leading the label on
    // inactive chips so the category's color is still readable. Hidden
    // on active chips since the accent fill already carries selection.
    categoryChipDot: { width: 6, height: 6, borderRadius: 3 },
    categoryChipText: { fontSize: 12, letterSpacing: -0.2 },

    // Emergency strip
    emergencyCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 12,
        gap: 10,
    },
    emergencyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    emergencyDot: { width: 6, height: 6, borderRadius: 3 },
    emergencyLabel: { fontSize: 10, letterSpacing: 0.4 },
    emergencyTileRow: { gap: 8, paddingRight: 4 },
    emergencyTile: {
        width: 84,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 10,
        alignItems: 'center',
        gap: 6,
    },
    emergencyTileIconAlert: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: withAlpha('#FFFFFF', 0.18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emergencyTileInitial: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emergencyTileInitialText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 11,
        fontWeight: '700',
    },
    emergencyTileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: -0.2 },
    emergencyTileSub: { fontSize: 9, letterSpacing: -0.2 },
    // Empty-state tile that pre-flags is_emergency on /contact/new. Dashed
    // border in the alert color to read as "add" without competing with the
    // solid-red 911 tile next to it.
    emergencyAddTile: {
        borderWidth: 1,
        borderStyle: 'dashed',
    },

    // Favorites strip
    sectionLabelWrap: { paddingHorizontal: 8, marginBottom: 0 },
    favStrip: {
        paddingHorizontal: 16,
        paddingBottom: 18,
        gap: 14,
    },
    favTile: { width: 64, alignItems: 'center', gap: 6 },
    favRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    favInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    favInitialText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 17,
        fontWeight: '700',
    },
    favRole: { fontSize: 9, letterSpacing: -0.2, textAlign: 'center' },

    // Categorized sections
    sectionWrap: { marginBottom: 16 },
    sectionCard: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // ContactRow
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
    },
    rowBody: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowAvatarText: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    rowSub: { fontSize: 11.5, marginBottom: 4 },
    rowPhone: { fontSize: 10.5, letterSpacing: -0.2 },
    rowDialBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Empty state
    empty: {
        padding: Spacing.six,
        alignItems: 'center',
        gap: Spacing.two,
    },
    center: { textAlign: 'center' },

    // FAB
    fab: {
        position: 'absolute',
        right: 16,
        // Matches Home's fabPill `bottom: 16` (index.tsx). Was 96 — that
        // legacy value was a conservative tab-bar buffer that no longer
        // applies; the bottom tab bar sits below the screen area, not
        // overlaid on top of it.
        bottom: 16,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        // HEAVY_FAB_SHADOW is the platform-aware version of the prior
        // inlined shadow* props — boxShadow on web (avoids RN-web 0.20+
        // deprecation warning), shadowColor/Offset/Opacity/Radius +
        // elevation on native. The Family Hub FAB uses CARD_SHADOW; this
        // pill needs more drop because it's larger and weightier.
        ...HEAVY_FAB_SHADOW,
    },
    fabText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },

    pressed: { opacity: 0.7 },
});
