import { format } from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { EventForm, type EventFormSubmitInput, type EventFormValues } from '@/components/event-form';
import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import { createEvent } from '@/lib/db';
import { resolveLocationId } from '@/lib/locations';
import { useAuth } from '@/providers/auth-provider';

function defaultStartTime(now: Date): string {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return format(next, 'HH:mm');
}

function addHours(time: string, hours: number): string {
    const [h, m] = time.split(':').map((s) => parseInt(s, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const total = h * 60 + m + hours * 60;
    const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = Math.floor(wrapped / 60).toString().padStart(2, '0');
    const mm = (wrapped % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
}

export default function NewEventScreen() {
    const router = useRouter();

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { locations, isLoading: locationsLoading } = useLocations(household?.id);

    const initialValues = useMemo<EventFormValues | null>(() => {
        if (!user) return null;
        const now = new Date();
        const start = defaultStartTime(now);
        return {
            title: '',
            date: format(now, 'yyyy-MM-dd'),
            startTime: start,
            endTime: addHours(start, 1),
            allDay: false,
            locationName: '',
            locationMapsUrl: '',
            notes: '',
            responsibleProfileId: user.id,
            recurrenceRule: null,
            eventType: null,
        };
    }, [user]);

    if (authLoading || householdsLoading || membersLoading || locationsLoading) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (!initialValues) return <LoadingScreen />;

    const handleSubmit = async (input: EventFormSubmitInput) => {
        const locationId = await resolveLocationId(
            household.id,
            locations ?? [],
            input.locationName,
            input.locationMapsUrl,
        );
        await createEvent(household.id, { ...input, locationId });
        router.back();
    };

    return (
        <EventForm
            headerTitle="New event"
            members={members ?? []}
            locations={locations ?? []}
            currentUserId={user.id}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
