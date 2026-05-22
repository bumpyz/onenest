import { createLocation, type Location } from './db';

/**
 * Resolves a location name + optional Maps URL into a location_id. If the name (case-insensitive)
 * already exists in the household's saved locations, reuses that row. Otherwise creates a new one.
 * Empty name returns null.
 */
export async function resolveLocationId(
    householdId: string,
    locations: Location[],
    name: string,
    mapsUrl: string,
): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const match = locations.find(
        (l) => l.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) return match.id;
    const created = await createLocation(
        householdId,
        trimmed,
        mapsUrl.trim() || null,
    );
    return created.id;
}
