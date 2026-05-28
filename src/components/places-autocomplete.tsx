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
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
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
     * Optional leading icon (e.g. <Feather name="search" .../>) rendered
     * INSIDE the input bar, immediately to the left of the TextInput.
     * When provided, the input + icon are wrapped in a flex row whose
     * shell styling comes from `barStyle` — the bar reads as a single
     * field with an inline icon (matching the Lists search-bar
     * vocabulary). When omitted, the component renders a bare TextInput
     * styled by `inputStyle` only (back-compat for existing callers).
     */
    leadingIcon?: React.ReactNode;
    /**
     * Style applied to the input-bar shell when `leadingIcon` is set
     * (border, background, padding, radius). Ignored when leadingIcon
     * is absent. Separate from `containerStyle` because containerStyle
     * wraps both the input row AND the suggestions dropdown — bar
     * styling needs to live on just the input row so the dropdown
     * doesn't pick up the same border.
     */
    barStyle?: StyleProp<ViewStyle>;
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
    leadingIcon,
    barStyle,
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

    const textInputNode = (
        <TextInput
            value={value}
            onChangeText={(t) => {
                onChangeText(t);
                if (placesOn) setShowSuggestions(true);
            }}
            onFocus={() => placesOn && setShowSuggestions(true)}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            // When leadingIcon is present the input sits in a flex row
            // inside the bar shell — `flex: 1` lets it consume the row's
            // remaining width to the right of the icon. Without a bar
            // we keep the back-compat path where `inputStyle` solely
            // controls the input's appearance.
            style={leadingIcon ? [{ flex: 1 }, inputStyle] : inputStyle}
            editable={editable && !picking}
            autoFocus={autoFocus}
            // Tell the browser this is an address field (and emphatically
            // NOT a password field). Stops 1Password / Chrome from
            // offering credential autofill on every keystroke while the
            // user is searching Google Places.
            autoComplete="street-address"
        />
    );

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {leadingIcon ? (
                <View style={[styles.bar, barStyle]}>
                    {leadingIcon}
                    {textInputNode}
                </View>
            ) : (
                textInputNode
            )}

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
                            <ThemedText
                                type="small"
                                style={{ color: BrandColors.error }}>
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
                                  {/* Typography matches LocationSuggestionRow
                                      (the saved-locations row primitive used
                                      directly above this dropdown in the
                                      EventForm Where section) so the
                                      Google-sourced rows read as a natural
                                      continuation of the saved list rather
                                      than a different design system. Was
                                      using ThemedText `smallBold` (Geist
                                      Bold 14/700) which was visibly heavier
                                      than the form's 500-weight body. */}
                                  <ThemedText
                                      style={[
                                          styles.suggestionTitle,
                                          { color: colors.text },
                                      ]}
                                      numberOfLines={1}>
                                      {s.mainText || s.text}
                                  </ThemedText>
                                  {s.secondaryText ? (
                                      <ThemedText
                                          style={[
                                              styles.suggestionSub,
                                              {
                                                  color: colors.inkFaint,
                                                  fontFamily:
                                                      FontFamily.monoMedium,
                                              },
                                          ]}
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
    // Flex row that holds the optional leading icon + TextInput when the
    // caller is using the "search bar" variant (leadingIcon set). Shell
    // appearance (border, bg, padding, radius) comes from the caller via
    // `barStyle`; this style only owns the layout.
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dropdown: {
        marginTop: Spacing.one,
        borderWidth: 1,
        borderRadius: Spacing.two,
        overflow: 'hidden',
    },
    row: {
        // Padding mirrors LocationSuggestionRow (11 vertical / 14
        // horizontal) so the dropdown rows have the same vertical
        // rhythm as the saved-locations rows in the card above.
        paddingHorizontal: 14,
        paddingVertical: 11,
        gap: 1,
    },
    // Suggestion typography — matches LocationSuggestionRow (title
    // 14/500/-0.2 sansMedium; sub 10 monoMedium/-0.2 inkFaint). Color +
    // fontFamily for the sub line are applied at the call site so the
    // light/dark theme injection stays simple.
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    suggestionSub: {
        fontSize: 10,
        letterSpacing: -0.2,
        marginTop: 1,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
    },
});
