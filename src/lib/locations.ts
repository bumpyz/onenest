import { createLocation, type Location, type LocationPlaceInput } from './db';

export type ResolveLocationOptions = {
    /** If a Google Place was picked, prefer matching on its place_id so we don't make duplicates. */
    place?: LocationPlaceInput | null;
};

/**
 * Resolves a location name + optional Maps URL into a location_id.
 *
 * Matching priority:
 *   1. If the caller picked a Google Place, find the row with the same google_place_id (dedup
 *      even when names differ — Google sometimes returns trailing comma variants).
 *   2. Otherwise fall back to case-insensitive name match against existing saved locations.
 *   3. Otherwise create a new row, passing through any Place data.
 *
 * Empty name returns null (no location set).
 */
export async function resolveLocationId(
    householdId: string,
    locations: Location[],
    name: string,
    mapsUrl: string,
    options: ResolveLocationOptions = {},
): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    if (options.place?.placeId) {
        const placeMatch = locations.find(
            (l) => l.google_place_id === options.place!.placeId,
        );
        if (placeMatch) return placeMatch.id;
    }

    const nameMatch = locations.find(
        (l) => l.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (nameMatch) return nameMatch.id;

    const created = await createLocation(
        householdId,
        trimmed,
        mapsUrl.trim() || null,
        options.place ?? null,
    );
    return created.id;
}
