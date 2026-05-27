import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import {
    LocationForm,
    type LocationFormSubmit,
    type LocationFormValues,
} from '@/components/location-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import { deleteLocation, updateLocation } from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';

export default function EditLocationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { locations, isLoading: locationsLoading } = useLocations(household?.id);

    const location = useMemo(
        () => (id && locations ? locations.find((l) => l.id === id) : null),
        [id, locations],
    );

    const initialValues = useMemo<LocationFormValues | null>(() => {
        if (!location) return null;
        return {
            name: location.name,
            address: location.formatted_address ?? '',
            mapsUrl: location.google_maps_url ?? '',
            place: location.google_place_id
                ? {
                      placeId: location.google_place_id,
                      formattedAddress: location.formatted_address ?? '',
                  }
                : null,
        };
    }, [location]);

    if (authLoading || householdsLoading || locationsLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!location || !initialValues) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Location not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            It may have been deleted.
                        </ThemedText>
                        <Pressable
                            onPress={() => router.replace('/settings/locations')}
                            style={styles.linkBtn}>
                            <ThemedText style={{ color: colors.accent }}>
                                Back to Locations
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const handleSubmit = async (input: LocationFormSubmit) => {
        await updateLocation(
            location.id,
            input.name,
            input.mapsUrl.length > 0 ? input.mapsUrl : null,
            input.place,
        );
        router.back();
    };

    const handleDelete = async () => {
        await deleteLocation(location.id);
        router.back();
    };

    return (
        <LocationForm
            headerTitle="Edit location"
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            onCancel={() => router.back()}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1, padding: Spacing.four, justifyContent: 'center' },
    centered: { alignItems: 'center', gap: Spacing.three },
    center: { textAlign: 'center' },
    linkBtn: { padding: Spacing.two },
});
