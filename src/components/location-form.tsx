// Shared add / edit form for saved locations. Mounted by two routes:
//   - /location/new            → create mode, no Delete button
//   - /location/[id]           → edit mode, Delete button at the bottom
//
// Restyled to match the v2 creation-flow vocabulary used by every other
// form surface in the app (ChildForm, ContactForm, TaskForm, EventForm):
//
//   • CreateTopBar  — sticky Cancel / centered title / accent Save pill
//   • TitleInput    — "NAME" label + 22/600 value with accent underline
//   • FormSectionLabel + FormGroup(flush) — every grouped section
//   • CIRow         — inline icon + value + caps mono label per row
//
// Replaces the previous old-style header (Save pill in a generic bar)
// + FormCard with bordered TextInputs — that pattern is gone from every
// other edit screen, leaving Edit location as the odd one out.

import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    CIRow,
    CreateTopBar,
    FormGroup,
    FormSectionLabel,
    TitleInput,
} from '@/components/ds';
import { MapPreview } from '@/components/map-preview';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import type { LocationPlaceInput } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';

export type LocationFormValues = {
    name: string;
    /** Free-text address shown under the name. Either user-typed or pulled from a pick. */
    address: string;
    mapsUrl: string;
    /** Set when the user picked a Google Places suggestion (now or originally). */
    place: LocationPlaceInput | null;
};

export type LocationFormSubmit = {
    name: string;
    mapsUrl: string;
    place: LocationPlaceInput | null;
};

type Props = {
    headerTitle: string;
    submitLabel?: string;
    initialValues: LocationFormValues;
    onSubmit: (input: LocationFormSubmit) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

export function LocationForm({
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
    const [address, setAddress] = useState(initialValues.address);
    const [mapsUrl, setMapsUrl] = useState(initialValues.mapsUrl);
    const [pickedPlace, setPickedPlace] = useState<LocationPlaceInput | null>(
        initialValues.place,
    );
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const busy = submitting || deleting;
    const canSubmit = name.trim().length > 0 && !busy;

    // PlacesAutocomplete's effect fires on every `value` change including the
    // initial render. On the Edit screen that means typing isn't required —
    // simply opening the form would dispatch a Google autocomplete request
    // for the already-saved address and pop a dropdown the user didn't ask
    // for (showing the existing address verbatim as a redundant suggestion).
    // `skipFetchValues` short-circuits the fetch when the input matches one
    // of these entries case-insensitively, so the dropdown stays closed
    // until the user actually edits the address. Memoized per the
    // QA-007 / #236 fix so the effect doesn't loop.
    const skipFetchValues = useMemo<readonly string[]>(
        () =>
            initialValues.address && initialValues.address.trim().length > 0
                ? [initialValues.address]
                : [],
        [initialValues.address],
    );

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                name: name.trim(),
                mapsUrl: mapsUrl.trim(),
                place: pickedPlace,
            });
        } catch (err) {
            console.error('location submit failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save location", msg);
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete || busy) return;
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm(
                      'Delete this location? Events using it will keep their existing label, but the saved place will be removed.',
                  )
                : await new Promise<boolean>((resolve) => {
                      Alert.alert(
                          'Delete this location?',
                          'Events using it will keep their existing label, but the saved place will be removed.',
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
            console.error('location delete failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't delete location", msg);
            setDeleting(false);
        }
    };

    // The map preview wants either a picked place_id OR a free-text query fallback. We
    // prefer the place_id (precise pin) but fall back to whatever's in the address field
    // for legacy rows that never went through Google.
    const previewPlaceId = pickedPlace?.placeId ?? null;
    const previewQuery =
        pickedPlace?.formattedAddress?.trim() || address.trim() || null;

    // PlacesAutocomplete needs an explicit inputStyle since it doesn't
    // own its visual frame. Match the CIRow's value-cell vocabulary
    // (14/0/sansRegular) so the address row reads consistently with the
    // Maps URL row below it. The icon column + caps label are rendered
    // by the wrapper, NOT by PlacesAutocomplete itself — the autocomplete
    // just owns the input + suggestions dropdown.
    const addressInputStyle = {
        flex: 1,
        fontSize: 13,
        letterSpacing: -0.2,
        paddingVertical: 0,
        fontWeight: '500' as const,
        color: colors.text,
        fontFamily: FontFamily.sansRegular,
    };

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
                    {/* TITLE — "NAME" with accent underline. Mirrors
                        ContactForm / ChildForm. Sentence-case + word-cap
                        autocapitalize so "Home", "School", "Soccer field"
                        all read right. */}
                    <TitleInput
                        label="NAME"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Home, School, Soccer field"
                        autoFocus={!initialValues.name}
                        autoCapitalize="words"
                        editable={!busy}
                    />

                    {/* WHERE — address autocomplete + (when set) map
                        preview + Google Maps link. Three rows inside one
                        flush group so the hairlines read as one
                        continuous card. */}
                    <FormSectionLabel>Where</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            {/* Address row — composed like CIRow but
                                wraps PlacesAutocomplete instead of a
                                plain TextInput so users can pick from
                                Google's suggestion list. The caps label
                                ("ADDRESS") on the right matches every
                                other row's right-anchor convention. */}
                            <View
                                style={[
                                    styles.row,
                                    {
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <View style={styles.iconCol}>
                                    <Feather
                                        name="map-pin"
                                        size={14}
                                        color={colors.inkSec}
                                    />
                                </View>
                                <View style={styles.inputCell}>
                                    <PlacesAutocomplete
                                        value={address}
                                        onChangeText={(t) => {
                                            setAddress(t);
                                            // Editing away from the picked place clears the place_id so
                                            // we don't save a stale link. The user can re-pick or just
                                            // leave it as free text.
                                            if (
                                                pickedPlace &&
                                                t.trim().toLowerCase() !==
                                                    (pickedPlace.formattedAddress ?? '')
                                                        .trim()
                                                        .toLowerCase()
                                            ) {
                                                setPickedPlace(null);
                                            }
                                        }}
                                        onPickPlace={(details) => {
                                            // Replace the address with Google's canonical formatted
                                            // version, fill the Maps URL, and capture the place_id so
                                            // saveLocation can dedup against future picks of the same
                                            // spot.
                                            setAddress(
                                                details.formattedAddress ||
                                                    details.displayName,
                                            );
                                            setMapsUrl(details.googleMapsUri);
                                            setPickedPlace({
                                                placeId: details.placeId,
                                                formattedAddress:
                                                    details.formattedAddress,
                                            });
                                        }}
                                        placeholder="Search a place"
                                        placeholderTextColor={colors.inkFaint}
                                        inputStyle={addressInputStyle}
                                        editable={!busy}
                                        skipFetchValues={skipFetchValues}
                                    />
                                </View>
                                <ThemedText
                                    style={[
                                        styles.rowLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ADDRESS
                                </ThemedText>
                            </View>

                            {/* Map preview — inline below the address row
                                so the picked location reads in-context
                                instead of floating outside the card. Only
                                renders when we have a query / place to
                                resolve. */}
                            {previewQuery ? (
                                <View style={styles.previewWrap}>
                                    <MapPreview
                                        placeId={previewPlaceId}
                                        query={previewQuery}
                                    />
                                </View>
                            ) : null}

                            {/* Google Maps URL row — CIRow with the
                                external-link glyph. Auto-fills when the
                                user picks a Place suggestion; editable
                                so paste-from-Maps still works. */}
                            <CIRow
                                icon="external-link"
                                label="MAPS URL"
                                value={mapsUrl}
                                onChangeText={setMapsUrl}
                                placeholder="Auto-filled when you pick a place"
                                keyboardType="url"
                                mono
                                autoCapitalize="none"
                                editable={!busy}
                                last
                            />
                        </FormGroup>
                    </View>

                    {error ? (
                        <ThemedText
                            style={[
                                styles.errorText,
                                { color: BrandColors.error },
                            ]}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {/* Destructive — same vocabulary as ContactForm /
                        ChildForm. Sits outside the section card so it
                        reads as a separate considered action, not a
                        regular row. */}
                    {onDelete ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel="Delete location"
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <ThemedText style={styles.deleteText}>
                                {deleting ? 'Deleting…' : 'Delete location'}
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
    scroll: {
        paddingBottom: Spacing.six,
    },
    section: { paddingHorizontal: 16 },

    // Address row — handcoded because PlacesAutocomplete needs its own
    // wrapper to host the suggestions dropdown. Matches CIRow padding
    // (12 vertical / 14 horizontal) and the icon-column / right-label
    // composition so this row sits flush with the CIRow underneath.
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    iconCol: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    inputCell: { flex: 1 },
    rowLabel: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        flexShrink: 0,
    },

    // Map preview — sits inside the section card between the address
    // row and the Maps URL row. Inset 10px and rounded so the corners
    // don't bleed against the card's hairline border.
    previewWrap: {
        marginHorizontal: 10,
        marginVertical: 10,
        borderRadius: 10,
        overflow: 'hidden',
    },

    errorText: {
        paddingHorizontal: 16,
        paddingTop: Spacing.two,
        fontSize: 12,
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
