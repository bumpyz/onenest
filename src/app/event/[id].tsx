import { format } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventForm, type EventFormSubmitInput, type EventFormValues } from '@/components/event-form';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useEvent } from '@/hooks/use-event';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import { deleteEvent, updateEvent } from '@/lib/db';
import { resolveLocationId } from '@/lib/locations';
import { useAuth } from '@/providers/auth-provider';

export default function EditEventScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { locations, isLoading: locationsLoading } = useLocations(household?.id);
    const { event, isLoading: eventLoading } = useEvent(id);

    const initialValues = useMemo<EventFormValues | null>(() => {
        if (!event) return null;
        const start = new Date(event.starts_at);
        const end = new Date(event.ends_at);
        // Prefer the linked location's name; fall back to legacy text.
        const linkedLocation =
            event.location_id && locations
                ? locations.find((l) => l.id === event.location_id)
                : null;
        const locationName = linkedLocation?.name ?? event.location ?? '';
        const locationMapsUrl = linkedLocation?.google_maps_url ?? '';
        return {
            title: event.title,
            date: format(start, 'yyyy-MM-dd'),
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            allDay: event.all_day,
            locationName,
            locationMapsUrl,
            notes: event.description ?? '',
            responsibleProfileId: event.responsible_profile_id,
            recurrenceRule: event.recurrence_rule,
            eventType: event.event_type,
        };
    }, [event, locations]);

    if (authLoading || householdsLoading || membersLoading || locationsLoading || eventLoading) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!event || !initialValues) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Event not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            It may have been deleted.
                        </ThemedText>
                        <Pressable onPress={() => router.replace('/')} style={styles.linkBtn}>
                            <ThemedText style={{ color: '#6F7FA5' }}>Go to calendar</ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const handleSubmit = async (input: EventFormSubmitInput) => {
        const locationId = await resolveLocationId(
            household.id,
            locations ?? [],
            input.locationName,
            input.locationMapsUrl,
        );
        await updateEvent(event.id, { ...input, locationId });
        router.back();
    };

    const handleDelete = async () => {
        await deleteEvent(event.id);
        router.back();
    };

    return (
        <EventForm
            headerTitle="Edit event"
            members={members ?? []}
            locations={locations ?? []}
            currentUserId={user.id}
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
