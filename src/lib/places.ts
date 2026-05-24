// Thin client for the Google Places API (New, v1) used to power location autocomplete in
// the event form and Settings → Saved locations.
//
// Why "Places API (New)" (places.googleapis.com/v1) instead of the legacy Maps JS / Places
// JS SDK?
//   - Works in plain fetch from React Native and web identically — no platform-specific
//     SDK juggling.
//   - Field masks let us pull only what we need, which is the only way the new API will
//     return data and also keeps the per-request bill predictable.
//   - Session tokens: the New API groups one autocomplete-then-details flow into a single
//     billed session if you reuse the same token, which is how this client uses them.
//
// Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in .env.local. The key MUST be restricted in
// Google Cloud Console — see the bottom of this file for the required restriction list.

import * as Crypto from 'expo-crypto';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

/** Returns the API key from env, or null if unset (graceful degradation to plain text input). */
export function getPlacesApiKey(): string | null {
    const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
    return key.length > 0 ? key : null;
}

export function isPlacesEnabled(): boolean {
    return getPlacesApiKey() !== null;
}

/** Generates a UUID session token. Reuse the same token across one autocomplete→details flow. */
export function newSessionToken(): string {
    return Crypto.randomUUID();
}

/** One suggestion from the autocomplete endpoint. */
export type PlaceSuggestion = {
    placeId: string;
    /** "Soccer field, 123 Main St, Springfield" — the full prediction text. */
    text: string;
    /** "Soccer field" — the bold-ish primary line in Google's UI. */
    mainText: string;
    /** "123 Main St, Springfield" — the de-emphasized address line. May be empty. */
    secondaryText: string;
};

/** Hydrated details fetched after a suggestion is picked. */
export type PlaceDetails = {
    placeId: string;
    /** Human display name — e.g. "Soccer Field at Lincoln Park". */
    displayName: string;
    /** Postal-style formatted address — e.g. "200 Main St, Springfield, IL 62701, USA". */
    formattedAddress: string;
    /** Canonical Google Maps URL — opens the pin in Maps. */
    googleMapsUri: string;
};

/**
 * Calls places:autocomplete with the user's typed input. Returns up to 5 suggestions.
 * Returns [] if the key isn't set or the input is too short to be useful.
 *
 * The signal lets the caller abort an in-flight request when the user keeps typing.
 */
export async function autocompletePlaces(
    input: string,
    sessionToken: string,
    signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
    const apiKey = getPlacesApiKey();
    if (!apiKey) return [];
    const trimmed = input.trim();
    if (trimmed.length < 2) return [];

    const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            // We only need predictions, not query predictions — field mask both
            // narrows the response and saves the per-field billing tier.
            'X-Goog-FieldMask':
                'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
            input: trimmed,
            sessionToken,
            // languageCode is optional; let Google infer from the request.
        }),
        signal,
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Places autocomplete failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as {
        suggestions?: Array<{
            placePrediction?: {
                placeId: string;
                text?: { text?: string };
                structuredFormat?: {
                    mainText?: { text?: string };
                    secondaryText?: { text?: string };
                };
            };
        }>;
    };
    const suggestions = data.suggestions ?? [];
    return suggestions
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({
            placeId: p.placeId,
            text: p.text?.text ?? '',
            mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
            secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        }));
}

/**
 * Fetches details for a single place. Pass the same sessionToken used in the autocomplete
 * call so Google bills the whole flow as one session (much cheaper).
 */
export async function getPlaceDetails(
    placeId: string,
    sessionToken: string,
): Promise<PlaceDetails> {
    const apiKey = getPlacesApiKey();
    if (!apiKey) throw new Error('Google Places API key is not configured.');

    const url = `${DETAILS_URL}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,googleMapsUri',
        },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Places details failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        googleMapsUri?: string;
    };
    return {
        placeId: data.id ?? placeId,
        displayName: data.displayName?.text ?? '',
        formattedAddress: data.formattedAddress ?? '',
        googleMapsUri: data.googleMapsUri ?? '',
    };
}

// Required Google Cloud Console setup (do this once):
//   1. APIs & Services → Library → enable "Places API (New)". The legacy "Places API"
//      will NOT serve v1 endpoints.
//   2. APIs & Services → Credentials → Create credentials → API key.
//   3. On the new key, click "Edit API key" and set:
//        Application restrictions → HTTP referrers (web sites) →
//          http://localhost:8081/*
//          http://localhost:19006/*  (Expo dev menu, just in case)
//          https://<your-prod-domain>/*  (once you have one)
//        API restrictions → Restrict key → select ONLY "Places API (New)".
//      Without restrictions the key is a credit-card-shaped liability if it leaks.
//   4. Copy the key into .env.local as EXPO_PUBLIC_GOOGLE_PLACES_API_KEY and restart
//      the dev server (Expo only injects EXPO_PUBLIC_* at bundle time).
