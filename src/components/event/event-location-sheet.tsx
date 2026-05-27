// EventLocationSheet — field-edit sheet for the Location row.
//
// Three ways to set a location:
//   1. Pick a saved household location from the chip strip at the top.
//   2. Type a free-form name + manual Maps URL — same shape EventForm used.
//   3. Use PlacesAutocomplete to pick a Google Place; that auto-fills the
//      name + writes a place_id + formatted_address into a new locations
//      row via resolveLocationId on save.
//
// Save flow mirrors EventForm: resolveLocationId picks/creates the
// Location row, then we updateEvent with the new location_id + the
// legacy `location` text mirror.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SheetShell } from '@/components/ds/sheet-shell';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import {
    updateEvent,
    type Event,
    type Location,
    type LocationPlaceInput,
    type NewEventResponsibleInput,
} from '@/lib/db';
import { resolveLocationId } from '@/lib/locations';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    event: Event;
    /** Household locations cache so users can re-pick from saved entries
     *  without re-typing. */
    locations: Location[];
    /** Owning household id — needed by resolveLocationId so a brand-new
     *  location gets inserted in the right tenant. */
    householdId: string;
};

export function EventLocationSheet({
    open,
    onClose,
    onSaved,
    event,
    locations,
    householdId,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Seed from the linked location (preferred) or the legacy free-text
    // `location` column for unmigrated rows.
    const linkedLocation = event.location_id
        ? locations.find((l) => l.id === event.location_id) ?? null
        : null;
    const initialName = linkedLocation?.name ?? event.location ?? '';
    const initialMapsUrl = linkedLocation?.google_maps_url ?? '';

    const [name, setName] = useState(initialName);
    const [mapsUrl, setMapsUrl] = useState(initialMapsUrl);
    const [pickedPlace, setPickedPlace] = useState<LocationPlaceInput | null>(null);
    // Tracks the locationId the user explicitly picked from the saved
    // chip strip. While set, name edits don't re-resolve into a new
    // Location row — QA-found bug: typo-correcting "Lincoln Park" to
    // "Lincoln Park Field 3" was silently creating a duplicate
    // location for every keystroke past the original name. Cleared on
    // PlacesAutocomplete pick (a new place_id is authoritative) or
    // when the user clears + retypes a different name entirely (we
    // detect that by case-insensitive comparison against the saved
    // location's name; mismatch → drop the locked id, treat as
    // free-text).
    const [pickedLocationId, setPickedLocationId] = useState<string | null>(
        event.location_id ?? null,
    );
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(initialName);
        setMapsUrl(initialMapsUrl);
        setPickedPlace(null);
        setPickedLocationId(event.location_id ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Memoize the skipFetchValues array for PlacesAutocomplete so its
    // debounce effect doesn't re-arm on every render (QA-007 lesson).
    const skipFetchValues = useMemo(
        () =>
            locations.flatMap((l) =>
                [l.name, l.formatted_address ?? ''].filter((s) => s.length > 0),
            ),
        [locations],
    );

    const matchedLocation = useMemo<Location | null>(() => {
        if (pickedPlace?.placeId) {
            const byPlaceId = locations.find(
                (l) => l.google_place_id === pickedPlace.placeId,
            );
            if (byPlaceId) return byPlaceId;
        }
        const t = name.trim().toLowerCase();
        if (!t) return null;
        return (
            locations.find(
                (l) =>
                    l.name.toLowerCase() === t ||
                    (l.formatted_address ?? '').toLowerCase() === t,
            ) ?? null
        );
    }, [locations, name, pickedPlace]);

    const showMapsUrlField =
        name.trim().length > 0 && matchedLocation === null && pickedPlace === null;

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            // If the user picked a saved location chip and the name still
            // matches that chip (case-insensitive trim compare), bypass
            // resolveLocationId entirely — re-using the existing
            // locationId avoids any chance of creating a near-duplicate
            // Location row. If the user typed something materially
            // different OR picked a Google Place, fall through to
            // resolveLocationId for the normal lookup-or-create path.
            let locationId: string | null = null;
            const lockedLocation = pickedLocationId
                ? (locations ?? []).find((l) => l.id === pickedLocationId) ??
                  null
                : null;
            const lockedNameMatches =
                lockedLocation &&
                lockedLocation.name.trim().toLowerCase() ===
                    name.trim().toLowerCase() &&
                !pickedPlace; // a Google Place pick supersedes the lock
            if (lockedNameMatches && lockedLocation) {
                locationId = lockedLocation.id;
            } else {
                locationId = await resolveLocationId(
                    householdId,
                    locations ?? [],
                    name.trim(),
                    mapsUrl.trim(),
                    { place: pickedPlace },
                );
            }
            const responsibles: NewEventResponsibleInput[] =
                event.responsibles.length > 0
                    ? event.responsibles.map((r) => ({
                          profileId: r.profile_id,
                          isLead: r.is_lead,
                      }))
                    : event.responsible_profile_id
                      ? [{ profileId: event.responsible_profile_id, isLead: true }]
                      : [];
            await updateEvent(event.id, {
                title: event.title,
                startsAt: new Date(event.starts_at),
                endsAt: new Date(event.ends_at),
                allDay: event.all_day,
                description: event.description,
                location: name.trim() || null,
                locationId,
                recurrenceRule: event.recurrence_rule,
                eventType: event.event_type,
                timezone: event.timezone,
                childIds: event.child_ids,
                responsibleAlternation: event.responsible_alternation,
                responsibles,
            });
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleClear = () => {
        setName('');
        setMapsUrl('');
        setPickedPlace(null);
    };

    const summary = name.trim()
        ? `Save · ${name.trim().slice(0, 24)}`
        : 'Save · No location';

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Location"
            sub="Where this event happens."
            primary={saving ? 'Saving…' : summary}
            secondary="Clear"
            onPrimary={handleSave}
            onSecondary={handleClear}
            height={580}>
            {locations.length > 0 ? (
                <View style={styles.savedRow}>
                    <ThemedText
                        style={[
                            styles.sectionLabel,
                            {
                                color: colors.textSecondary,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        SAVED
                    </ThemedText>
                    <View style={styles.chipRow}>
                        {locations.map((l) => {
                            const selected = matchedLocation?.id === l.id;
                            return (
                                <Pressable
                                    key={l.id}
                                    onPress={() => {
                                        setName(l.name);
                                        setMapsUrl(l.google_maps_url ?? '');
                                        setPickedPlace(null);
                                        // Lock the resolved id so subsequent
                                        // edits to the name field don't fork
                                        // a new Location row via
                                        // resolveLocationId (QA-found).
                                        setPickedLocationId(l.id);
                                    }}
                                    style={({ pressed }) => [
                                        styles.chip,
                                        {
                                            borderColor: selected
                                                ? colors.accent
                                                : colors.hair,
                                            backgroundColor: selected
                                                ? withAlpha(
                                                      colors.accent,
                                                      0.094,
                                                  )
                                                : 'transparent',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.chipText,
                                            { color: colors.text },
                                        ]}
                                        numberOfLines={1}>
                                        {l.name}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            ) : null}

            <View style={styles.field}>
                <ThemedText
                    style={[
                        styles.sectionLabel,
                        {
                            color: colors.textSecondary,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    SEARCH OR TYPE A PLACE
                </ThemedText>
                <PlacesAutocomplete
                    value={name}
                    onChangeText={setName}
                    onPickPlace={(place) => {
                        setPickedPlace(place);
                        // PlacesAutocomplete already fills name via
                        // onChangeText when the user accepts a suggestion.
                    }}
                    placeholder="e.g. Lincoln Park · Field 3"
                    skipFetchValues={skipFetchValues}
                />
            </View>

            {showMapsUrlField ? (
                <View style={styles.field}>
                    <ThemedText
                        style={[
                            styles.sectionLabel,
                            {
                                color: colors.textSecondary,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        MAPS URL (OPTIONAL)
                    </ThemedText>
                    {/* Plain TextInput here — PlacesAutocomplete would try
                        to interpret the URL as a search query. The maps
                        URL is a separate optional field that the user
                        types directly when they want a quick "open in
                        Maps" deep link on a hand-typed location. */}
                    <TextInput
                        value={mapsUrl}
                        onChangeText={setMapsUrl}
                        placeholder="https://maps.app.goo.gl/…"
                        placeholderTextColor={colors.inkFaint}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        style={[
                            styles.urlInput,
                            {
                                color: colors.text,
                                borderColor: colors.hair,
                                backgroundColor: colors.backgroundInset,
                            },
                        ]}
                    />
                </View>
            ) : null}
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    savedRow: { marginBottom: Spacing.two, gap: 8 },
    field: { gap: 8, marginBottom: Spacing.two },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        maxWidth: 200,
    },
    chipText: { fontSize: 12, fontWeight: '500' },
    urlInput: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
    },
    pressed: { opacity: 0.7 },
});
