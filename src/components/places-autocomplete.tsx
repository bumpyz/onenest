// Debounced location autocomplete backed by Google Places API (New).
//
// Wraps a TextInput. As the user types we (after a short debounce) call
// places:autocomplete and show suggestions in a dropdown below the input. Picking a
// suggestion fires onPickPlace with the hydrated details — the parent decides what to do
// with them (set name, set maps URL, capture place_id, etc.).
//
// If EXPO_PUBLIC_GOOGLE_PLACES_API_KEY isn't set, this component degrades to a plain
// TextInput — no API calls, no dropdown, no error.

import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import {
    autocompletePlaces,
    getPlaceDetails,
    isPlacesEnabled,
    newSessionToken,
    type PlaceDetails,
    type PlaceSuggestion,
} from '@/lib/places';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    /** Fires after the user taps a suggestion AND the details fetch succeeds. */
    onPickPlace: (details: PlaceDetails) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    editable?: boolean;
    autoFocus?: boolean;
    /** Wrapper view style — useful for matching the existing layout. */
    containerStyle?: StyleProp<ViewStyle>;
    /** Style for the inner TextInput; same shape as the form's other inputs. */
    inputStyle?: StyleProp<TextStyle>;
    /**
     * Strings (e.g. names + addresses of saved locations) that should NOT trigger a
     * Google autocomplete fetch when the input value matches them exactly. Used when
     * the parent has a chip picker for already-resolved entries — clicking the chip
     * shouldn't fire a useless search for "Nadim's home" or "123 Main St".
     * Comparison is case-insensitive on the trimmed value.
     */
    skipFetchValues?: ReadonlyArray<string>;
};

export function PlacesAutocomplete({
    value,
    onChangeText,
    onPickPlace,
    placeholder,
    placeholderTextColor,
    editable = true,
    autoFocus = false,
    containerStyle,
    inputStyle,
    skipFetchValues,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const placesOn = isPlacesEnabled();

    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [picking, setPicking] = useState(false);

    // Session token survives the entire type→pick flow. We rotate it after a successful
    // pick so the next round of typing starts a fresh billed session.
    const sessionTokenRef = useRef<string>(placesOn ? newSessionToken() : '');
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // After a pick, we suppress the next typeahead fetch so picking doesn't immediately
    // re-query for "Soccer Field at Lincoln Park".
    const suppressNextFetchRef = useRef(false);

    useEffect(() => {
        if (!placesOn) return;
        if (suppressNextFetchRef.current) {
            suppressNextFetchRef.current = false;
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();

        const trimmed = value.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            setLoading(false);
            setError(null);
            return;
        }

        // If this exact value matches an already-resolved saved entry (chip pick),
        // don't bother Google — close the dropdown and keep the field as-is.
        if (
            skipFetchValues?.some(
                (s) => s.trim().toLowerCase() === trimmed.toLowerCase(),
            )
        ) {
            setSuggestions([]);
            setLoading(false);
            setError(null);
            setShowSuggestions(false);
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);

        debounceRef.current = setTimeout(async () => {
            try {
                const results = await autocompletePlaces(
                    trimmed,
                    sessionTokenRef.current,
                    controller.signal,
                );
                if (controller.signal.aborted) return;
                setSuggestions(results);
                setShowSuggestions(true);
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                console.warn('Places autocomplete failed', err);
                setError('Could not load place suggestions.');
                setSuggestions([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            controller.abort();
        };
    }, [value, placesOn, skipFetchValues]);

    const handlePick = async (s: PlaceSuggestion) => {
        if (picking) return;
        setPicking(true);
        setError(null);
        try {
            const details = await getPlaceDetails(s.placeId, sessionTokenRef.current);
            // Suppress the next debounce so updating the input below doesn't re-fetch.
            suppressNextFetchRef.current = true;
            // Use the friendlier display name (falls back to the suggestion's main text).
            const newName = details.displayName || s.mainText || s.text;
            onChangeText(newName);
            onPickPlace(details);
            setSuggestions([]);
            setShowSuggestions(false);
            // Rotate the session for the next type-then-pick flow.
            sessionTokenRef.current = newSessionToken();
        } catch (err) {
            console.warn('Place details fetch failed', err);
            setError('Could not load place details.');
        } finally {
            setPicking(false);
        }
    };

    return (
        <View style={[styles.wrapper, containerStyle]}>
            <TextInput
                value={value}
                onChangeText={(t) => {
                    onChangeText(t);
                    if (placesOn) setShowSuggestions(true);
                }}
                onFocus={() => placesOn && setShowSuggestions(true)}
                placeholder={placeholder}
                placeholderTextColor={placeholderTextColor}
                style={inputStyle}
                editable={editable && !picking}
                autoFocus={autoFocus}
            />

            {placesOn && showSuggestions && (suggestions.length > 0 || loading || error) ? (
                <View
                    style={[
                        styles.dropdown,
                        {
                            backgroundColor: colors.backgroundElement,
                            borderColor: colors.backgroundSelected,
                        },
                    ]}>
                    {loading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                            <ThemedText themeColor="textSecondary" type="small">
                                Searching…
                            </ThemedText>
                        </View>
                    ) : null}

                    {!loading && error ? (
                        <View style={styles.row}>
                            <ThemedText type="small" style={{ color: '#B85D52' }}>
                                {error}
                            </ThemedText>
                        </View>
                    ) : null}

                    {!loading && !error
                        ? suggestions.map((s, idx) => (
                              <Pressable
                                  key={s.placeId}
                                  onPress={() => handlePick(s)}
                                  disabled={picking}
                                  style={({ pressed }) => [
                                      styles.row,
                                      idx > 0 && {
                                          borderTopWidth: StyleSheet.hairlineWidth,
                                          borderTopColor: colors.backgroundSelected,
                                      },
                                      pressed && { opacity: 0.6 },
                                  ]}>
                                  <ThemedText type="smallBold">
                                      📍 {s.mainText || s.text}
                                  </ThemedText>
                                  {s.secondaryText ? (
                                      <ThemedText
                                          themeColor="textSecondary"
                                          type="small"
                                          numberOfLines={1}>
                                          {s.secondaryText}
                                      </ThemedText>
                                  ) : null}
                              </Pressable>
                          ))
                        : null}

                    {!loading && !error && suggestions.length === 0 ? null : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { position: 'relative' },
    dropdown: {
        marginTop: Spacing.one,
        borderWidth: 1,
        borderRadius: Spacing.two,
        overflow: 'hidden',
    },
    row: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        gap: 2,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
    },
});
