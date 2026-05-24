// Web variant: renders a Google Maps Embed iframe so the user gets a real preview of
// the picked location inside our form. The Embed API is free (no per-request billing)
// and shares the same Google Cloud API key we already use for Places — you just have to
// enable "Maps Embed API" in Google Cloud Console alongside "Places API (New)".
//
// We accept either a placeId (precise — what Places autocomplete gives us) or a free-
// text query as a fallback for legacy rows whose only signal is a formatted address.
// If neither is set, we render nothing rather than an empty embed.

import { Spacing } from '@/constants/theme';

export type MapPreviewProps = {
    /** Preferred input: Google Place ID from the autocomplete pick. */
    placeId: string | null;
    /** Fallback when no placeId — e.g. the stored formatted_address. */
    query: string | null;
};

function getEmbedUrl(placeId: string | null, query: string | null): string | null {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return null;
    // The Embed API's "place" mode takes a q= parameter that accepts either a literal
    // search string OR the special "place_id:..." form for exact-pin lookups. Use the
    // latter when we have a place_id; the former otherwise.
    let q: string;
    if (placeId && placeId.length > 0) {
        q = `place_id:${placeId}`;
    } else if (query && query.trim().length > 0) {
        q = query.trim();
    } else {
        return '';
    }
    const params = new URLSearchParams({ key: apiKey, q });
    return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

export function MapPreview({ placeId, query }: MapPreviewProps) {
    const url = getEmbedUrl(placeId, query);
    if (!url) return null;
    return (
        <iframe
            src={url}
            title="Map preview"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            style={{
                width: '100%',
                height: 220,
                border: 0,
                borderRadius: Spacing.two,
            }}
        />
    );
}
