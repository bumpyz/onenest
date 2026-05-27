// ContactForm — CreateContact / EditContact surface, v2 scaffold (spec 08.3).
//
// Design source: docs/design-handoffs/onenest-spec-v1/
//   design_handoff_creation_flows/screens-creation.jsx::CreateContact
//   (~line 290).
//
// Sections, top to bottom (matches canvas 08.3):
//   1. TitleInput "NAME" — accent underline.
//   2. AIHelper — vCard paste hint.
//   3. Type — 5-segment SegRow (Medical/School/Activity/Family/Other) +
//      Sub-type chevron (deferred — sub_type column not in schema).
//   4. Belongs to — kid chips. Schema gap (no contact_children junction
//      yet); render as "Coming soon" pending follow-up migration.
//   5. Contact info — CIRow phone / email / address.
//   6. Linked event — colored-bar preview + LINKED chip when set;
//      chevron picker row to pick/clear.
//   7. Quick flags — Pin to top (= is_favorite) + Emergency contact
//      FormSwitches.
//   8. Notes — multiline textarea.
//
// Avatar handling: keep the legacy hero + image-picker affordance from
// the prior form so EditContact preserves photo upload. CreateContact's
// spec mock omits the avatar — we render it anyway because (a) the
// component is shared with edit, and (b) seeing a colored placeholder
// while typing the name reads better than nothing.

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InitialsAvatar } from '@/components/initials-avatar';
import {
    AIHelper,
    CIRow,
    CreateTopBar,
    FormGroup,
    FormRow,
    FormSectionLabel,
    FormSwitch,
    SegRow,
    TitleInput,
} from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { CONTACT_CATEGORIES, type ContactCategory } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { formatPhoneInput } from '@/lib/phone-format';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

// Per-category display + tint colors. Identity colors stay constant
// across light/dark; alphas adjust per usage site.
export const CONTACT_CATEGORY_META: Record<
    ContactCategory,
    { label: string; color: string }
> = {
    medical: { label: 'Medical', color: '#E5613D' },
    school: { label: 'School', color: '#5667D4' },
    activities: { label: 'Activity', color: '#E8A04F' },
    family: { label: 'Family', color: '#8369A8' },
    emergency: { label: 'Emergency', color: BrandColors.error },
    other: { label: 'Other', color: '#828B85' },
};

// SegRow expects {id, label}. Render order matches the spec.
const TYPE_OPTIONS: ReadonlyArray<{ id: ContactCategory; label: string }> =
    CONTACT_CATEGORIES.map((id) => ({
        id,
        label: CONTACT_CATEGORY_META[id].label,
    }));

export type ContactFormValues = {
    name: string;
    phone: string;
    company: string;
    descriptor: string;
    /** Storage path of an existing avatar, or null when none. */
    avatarUrl: string | null;
    /** Display URL for an existing avatar (signed URL). */
    avatarDisplayUrl: string | null;
    category: ContactCategory;
    isFavorite: boolean;
    isEmergency: boolean;
    email: string;
    bestTime: string;
    address: string;
    notes: string;
    linkedEventId: string | null;
    linkedEventLabel: string | null;
};

export type ContactFormSubmit = {
    name: string;
    phone: string;
    company: string | null;
    descriptor: string | null;
    avatar:
        | { kind: 'pick'; uri: string; ext: string; blob: Blob }
        | { kind: 'clear' }
        | { kind: 'keep' };
    category: ContactCategory;
    isFavorite: boolean;
    isEmergency: boolean;
    email: string | null;
    bestTime: string | null;
    address: string | null;
    notes: string | null;
    linkedEventId: string | null;
};

type Props = {
    headerTitle: string;
    submitLabel?: string;
    initialValues: ContactFormValues;
    onSubmit: (input: ContactFormSubmit) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

// ─── Component ─────────────────────────────────────────────────────────

export function ContactForm({
    headerTitle,
    submitLabel = 'Save',
    initialValues,
    onSubmit,
    onDelete,
    onCancel,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [name, setName] = useState(initialValues.name);
    const [phone, setPhone] = useState(initialValues.phone);
    const [company, setCompany] = useState(initialValues.company);
    const [descriptor, setDescriptor] = useState(initialValues.descriptor);
    const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | null>(
        initialValues.avatarDisplayUrl,
    );
    const [pickedAvatar, setPickedAvatar] = useState<{
        uri: string;
        ext: string;
        blob: Blob;
    } | null>(null);
    const [avatarCleared, setAvatarCleared] = useState(false);
    const [category, setCategory] = useState<ContactCategory>(
        initialValues.category,
    );
    const [isFavorite, setIsFavorite] = useState(initialValues.isFavorite);
    const [isEmergency, setIsEmergency] = useState(initialValues.isEmergency);
    const [email, setEmail] = useState(initialValues.email);
    const [address, setAddress] = useState(initialValues.address);
    const [notes, setNotes] = useState(initialValues.notes);
    const [linkedEventId] = useState<string | null>(
        initialValues.linkedEventId,
    );
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const busy = submitting || deleting;
    const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !busy;

    // ─── Avatar picker ──────────────────────────────────────────────────

    const handlePickAvatar = async () => {
        if (busy) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });
            if (result.canceled || result.assets.length === 0) return;
            const asset = result.assets[0];
            // Resolve a blob the upload helper can stream. On web the
            // ImagePicker returns a real File-ish blob via fetch(uri).
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
            setPickedAvatar({ uri: asset.uri, ext, blob });
            setAvatarCleared(false);
            setAvatarDisplayUrl(asset.uri);
        } catch (err) {
            console.error('avatar pick failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't pick image", msg);
        }
    };

    const handleClearAvatar = () => {
        setPickedAvatar(null);
        setAvatarCleared(true);
        setAvatarDisplayUrl(null);
    };

    // ─── Submit / delete ────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                name: name.trim(),
                phone: phone.trim(),
                company: company.trim() || null,
                descriptor: descriptor.trim() || null,
                avatar: pickedAvatar
                    ? { kind: 'pick', ...pickedAvatar }
                    : avatarCleared
                      ? { kind: 'clear' }
                      : { kind: 'keep' },
                category,
                isFavorite,
                isEmergency,
                email: email.trim() || null,
                bestTime: null,
                address: address.trim() || null,
                notes: notes.trim() || null,
                linkedEventId,
            });
        } catch (err) {
            console.error('contact submit failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save", msg);
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete || busy) return;
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm(
                      `Delete ${name.trim() || 'this contact'}? This cannot be undone.`,
                  )
                : await new Promise<boolean>((resolve) => {
                      Alert.alert(
                          'Delete this contact?',
                          'This cannot be undone.',
                          [
                              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                          ],
                      );
                  });
        if (!confirmed) return;
        setDeleting(true);
        setError(null);
        try {
            await onDelete();
        } catch (err) {
            console.error('contact delete failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't delete", msg);
            setDeleting(false);
        }
    };

    const categoryColor = CONTACT_CATEGORY_META[category].color;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <CreateTopBar
                    title={headerTitle}
                    saveLabel={submitting ? 'Saving…' : submitLabel}
                    saveDisabled={!canSubmit}
                    onCancel={onCancel}
                    onSave={handleSubmit}
                />
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    {/* Avatar hero — diverges from canvas 08.3 (which
                        omits it), but kept here so the shared form
                        works for the EditContact route. The colored
                        ring tracks the selected category. */}
                    <View style={styles.hero}>
                        <Pressable
                            onPress={handlePickAvatar}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel="Change photo"
                            style={({ pressed }) => [
                                styles.heroWrap,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <View
                                style={[
                                    styles.heroHalo,
                                    {
                                        backgroundColor: withAlpha(
                                            categoryColor,
                                            0x22 / 255,
                                        ),
                                    },
                                ]}
                            />
                            {avatarDisplayUrl ? (
                                <Image
                                    source={{ uri: avatarDisplayUrl }}
                                    style={styles.heroImage}
                                />
                            ) : (
                                <InitialsAvatar
                                    name={name || '?'}
                                    backgroundColor={categoryColor}
                                    size="lg"
                                />
                            )}
                            <View
                                style={[
                                    styles.heroPencil,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <Feather
                                    name="edit-2"
                                    size={11}
                                    color={colors.text}
                                />
                            </View>
                        </Pressable>
                        {avatarDisplayUrl ? (
                            <Pressable
                                onPress={handleClearAvatar}
                                disabled={busy}
                                accessibilityRole="button"
                                accessibilityLabel="Remove photo"
                                style={({ pressed }) => [
                                    pressed && !busy && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.heroCaption,
                                        {
                                            color: colors.accent,
                                            fontFamily:
                                                FontFamily.monoMedium,
                                        },
                                    ]}>
                                    Remove photo
                                </ThemedText>
                            </Pressable>
                        ) : (
                            <ThemedText
                                style={[
                                    styles.heroCaption,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}>
                                Tap to upload photo
                            </ThemedText>
                        )}
                    </View>

                    {/* TITLE */}
                    <TitleInput
                        label="NAME"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Mrs. Anderson"
                        autoFocus={!initialValues.name}
                        autoCapitalize="words"
                        editable={!busy}
                    />

                    <AIHelper example="paste a vCard / contact card → phone + email pre-filled" />

                    {/* TYPE */}
                    <FormSectionLabel>Type</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.segWrap}>
                                <SegRow
                                    options={TYPE_OPTIONS}
                                    selected={category}
                                    onSelect={setCategory}
                                    disabled={busy}
                                />
                            </View>
                            {/* Sub-type — deferred (no schema column).
                                Render the row so the affordance is
                                visible; mark "Coming soon" to keep
                                the contract honest. */}
                            <FormRow
                                label="Sub-type"
                                value="Coming soon"
                                muted
                                chevron
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* BELONGS TO — schema gap (no contact_children).
                        Defer with a "Coming soon" chevron row. */}
                    <FormSectionLabel>Belongs to</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <FormRow
                                label="Tag kids"
                                value="Coming soon"
                                muted
                                chevron
                            />
                            <View
                                style={[
                                    styles.explainerRow,
                                    {
                                        borderTopColor: colors.hair,
                                        borderTopWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.explainerText,
                                        { color: colors.inkFaint },
                                    ]}>
                                    Once tagging lands, only people who can see
                                    the tagged kids will see this contact.
                                </ThemedText>
                            </View>
                        </FormGroup>
                    </View>

                    {/* CONTACT INFO */}
                    <FormSectionLabel>Contact info</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <CIRow
                                icon="phone"
                                label="Phone"
                                value={phone}
                                onChangeText={(t) =>
                                    setPhone(formatPhoneInput(t))
                                }
                                placeholder="(415) 555-0142"
                                keyboardType="phone-pad"
                                editable={!busy}
                            />
                            <CIRow
                                icon="mail"
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                placeholder="name@example.com"
                                keyboardType="email-address"
                                editable={!busy}
                            />
                            <CIRow
                                icon="map-pin"
                                label="Address"
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Street, city"
                                mono={false}
                                autoCapitalize="words"
                                editable={!busy}
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* DESCRIPTOR + COMPANY — kept as inline rows since
                        they're useful but absent from canvas 08.3.
                        Render under a single "Details" group. */}
                    <FormSectionLabel>Details</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.inlineRow}>
                                <ThemedText
                                    style={[
                                        styles.inlineLabel,
                                        { color: colors.text },
                                    ]}>
                                    Descriptor
                                </ThemedText>
                                <TextInput
                                    value={descriptor}
                                    onChangeText={setDescriptor}
                                    placeholder="e.g. piano teacher"
                                    placeholderTextColor={colors.inkFaint}
                                    editable={!busy}
                                    autoCapitalize="sentences"
                                    style={[
                                        styles.inlineInput,
                                        {
                                            color: colors.text,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}
                                />
                            </View>
                            <View
                                style={[
                                    styles.inlineRow,
                                    {
                                        borderTopColor: colors.hair,
                                        borderTopWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.inlineLabel,
                                        { color: colors.text },
                                    ]}>
                                    Company
                                </ThemedText>
                                <TextInput
                                    value={company}
                                    onChangeText={setCompany}
                                    placeholder="Optional"
                                    placeholderTextColor={colors.inkFaint}
                                    editable={!busy}
                                    autoCapitalize="words"
                                    style={[
                                        styles.inlineInput,
                                        {
                                            color: colors.text,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}
                                />
                            </View>
                        </FormGroup>
                    </View>

                    {/* LINKED EVENT */}
                    <FormSectionLabel>Linked event</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            {initialValues.linkedEventLabel ? (
                                <View style={styles.linkedRow}>
                                    <View
                                        style={[
                                            styles.linkedBar,
                                            { backgroundColor: categoryColor },
                                        ]}
                                    />
                                    <View style={styles.linkedBody}>
                                        <ThemedText
                                            style={[
                                                styles.linkedTitle,
                                                { color: colors.text },
                                            ]}>
                                            {initialValues.linkedEventLabel}
                                        </ThemedText>
                                    </View>
                                    <View
                                        style={[
                                            styles.linkedChip,
                                            {
                                                backgroundColor: withAlpha(
                                                    colors.accent,
                                                    0x18 / 255,
                                                ),
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.linkedChipText,
                                                {
                                                    color: colors.accent,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            LINKED
                                        </ThemedText>
                                    </View>
                                </View>
                            ) : null}
                            <FormRow
                                label="Recurring event"
                                value="Coming soon"
                                muted
                                chevron
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* QUICK FLAGS */}
                    <FormSectionLabel>Quick flags</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <FormRow
                                label="Pin to top"
                                value={
                                    <FormSwitch
                                        value={isFavorite}
                                        onValueChange={setIsFavorite}
                                        disabled={busy}
                                    />
                                }
                            />
                            <FormRow
                                label="Emergency contact"
                                value={
                                    <FormSwitch
                                        value={isEmergency}
                                        onValueChange={setIsEmergency}
                                        disabled={busy}
                                    />
                                }
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* NOTES */}
                    <FormSectionLabel>Notes</FormSectionLabel>
                    <View style={styles.section}>
                        <View
                            style={[
                                styles.notesCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Anything worth remembering"
                                placeholderTextColor={colors.inkFaint}
                                multiline
                                numberOfLines={3}
                                editable={!busy}
                                style={[
                                    styles.notesInput,
                                    { color: colors.text },
                                ]}
                            />
                        </View>
                    </View>

                    {error ? (
                        <ThemedText
                            type="small"
                            style={[
                                styles.errorText,
                                { color: BrandColors.error },
                            ]}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {onDelete ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <ThemedText style={styles.deleteText}>
                                {deleting ? 'Deleting…' : 'Delete contact'}
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: Spacing.six },
    section: { paddingHorizontal: 16, paddingBottom: 12 },

    // Hero
    hero: { alignItems: 'center', gap: 8, paddingVertical: 20 },
    heroWrap: {
        width: 96,
        height: 96,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    heroHalo: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    heroImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    heroPencil: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCaption: { fontSize: 11, letterSpacing: -0.1 },

    // Sections
    segWrap: { padding: 12 },

    // Inline rows
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    inlineLabel: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
        flexShrink: 0,
    },
    inlineInput: {
        flex: 1,
        textAlign: 'right',
        fontSize: 13,
        letterSpacing: -0.3,
        paddingVertical: 0,
    },

    explainerRow: { paddingHorizontal: 14, paddingVertical: 10 },
    explainerText: { fontSize: 11, lineHeight: 16 },

    // Linked event
    linkedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
    },
    linkedBar: {
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 2,
        minHeight: 36,
    },
    linkedBody: { flex: 1, minWidth: 0 },
    linkedTitle: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    linkedChip: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
    },
    linkedChipText: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

    // Notes
    notesCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 12,
        minHeight: 80,
    },
    notesInput: {
        fontSize: 13,
        lineHeight: 18,
        textAlignVertical: 'top',
    },

    errorText: {
        paddingHorizontal: 16,
        paddingTop: Spacing.two,
    },

    // Destructive
    deleteBtn: {
        marginTop: Spacing.three,
        marginHorizontal: 16,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: BrandColors.errorBackground,
        alignItems: 'center',
    },
    deleteText: { color: BrandColors.error, fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
