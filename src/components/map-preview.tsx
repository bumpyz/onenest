// Native fallback for the Maps embed preview. We don't ship native yet, but when we do
// the right answer is react-native-maps; an HTML iframe doesn't exist on iOS / Android.
// For now this just renders nothing — the surrounding form still shows a "Open in Maps"
// link from the stored URL, so users aren't left without a path to the location.

export type MapPreviewProps = {
    placeId: string | null;
    query: string | null;
};

export function MapPreview(_props: MapPreviewProps) {
    return null;
}
