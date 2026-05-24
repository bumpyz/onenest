import { Redirect, useRouter } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import {
    LocationForm,
    type LocationFormSubmit,
    type LocationFormValues,
} from '@/components/location-form';
import { useHouseholds } from '@/hooks/use-households';
import { createLocation } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

const INITIAL: LocationFormValues = {
    name: '',
    address: '',
    mapsUrl: '',
    place: null,
};

export default function NewLocationScreen() {
    const router = useRouter();
    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];

    if (authLoading || householdsLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    const handleSubmit = async (input: LocationFormSubmit) => {
        await createLocation(
            household.id,
            input.name,
            input.mapsUrl.length > 0 ? input.mapsUrl : null,
            input.place,
        );
        router.back();
    };

    return (
        <LocationForm
            headerTitle="Add location"
            initialValues={INITIAL}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
