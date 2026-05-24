// Shared add / edit form for saved locations. Mounted by two routes:
//   - /location/new            → create mode, no Delete button
//   - /location/[id]           → edit mode, Delete button at the bottom
// Replaces the inline cards-with-Edit/Delete pattern that lived inside Settings, which
// was getting unwieldy as the list grew. Same idea as event-form.tsx — one component,
// two callers.

import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPreview } from '@/components/map-preview';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
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
                  window.confirm('Delete this location? Events using it will keep their existing label, but the saved place will be removed.')
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

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
    };

    // The map preview wants either a picked place_id OR a free-text query fallback. We
    // prefer the place_id (precise pin) but fall back to whatever's in the address field
    // for legacy rows that never went through Google.
    const previewPlaceId = pickedPlace?.placeId ?? null;
    const previewQuery =
        pickedPlace?.formattedAddress?.trim() || address.trim() || null;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.headerBar}>
                    <Pressable
                        onPress={onCancel}
                        disabled={busy}
                        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold">{headerTitle}</ThemedText>
                    <Pressable
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            pressed && canSubmit && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: canSubmit ? '#6F7FA5' : colors.textSecondary,
                                fontWeight: '600',
                            }}>
                            {submitting ? 'Saving…' : submitLabel}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    <View style={styles.field}>
                        <ThemedText type="smallBold">Name</ThemedText>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Home, School, Soccer field"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoFocus
                            autoCapitalize="words"
                            editable={!busy}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Address (optional)</ThemedText>
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
                                setAddress(details.formattedAddress || details.displayName);
                                setMapsUrl(details.googleMapsUri);
                                setPickedPlace({
                                    placeId: details.placeId,
                                    formattedAddress: details.formattedAddress,
                                });
                            }}
                            placeholder="Search a place"
                            placeholderTextColor={colors.textSecondary}
                            inputStyle={inputStyle}
                            editable={!busy}
                        />
                    </View>

                    {previewQuery ? (
                        <View style={styles.previewWrapper}>
                            <MapPreview placeId={previewPlaceId} query={previewQuery} />
                        </View>
                    ) : null}

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Google Maps link (optional)</ThemedText>
                        <TextInput
                            value={mapsUrl}
                            onChangeText={setMapsUrl}
                            placeholder="Auto-filled when you pick a place"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            editable={!busy}
                        />
                    </View>

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
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
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    headerBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
    scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
    field: { gap: Spacing.two },
    previewWrapper: { borderRadius: Spacing.two, overflow: 'hidden' },
    errorText: { color: '#B85D52' },
    deleteBtn: {
        marginTop: Spacing.three,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: '#F3D9D3',
        alignItems: 'center',
    },
    deleteText: { color: '#B85D52', fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
