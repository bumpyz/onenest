import { Redirect, useRouter } from 'expo-router';

import {
    ChildForm,
    type ChildFormSubmit,
    type ChildFormValues,
} from '@/components/child-form';
import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholds } from '@/hooks/use-households';
import { addChild } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

const INITIAL: ChildFormValues = {
    displayName: '',
    birthdate: '',
    notes: '',
    color: null,
};

export default function NewChildScreen() {
    const router = useRouter();
    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];

    if (authLoading || householdsLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    const handleSubmit = async (input: ChildFormSubmit) => {
        await addChild(
            household.id,
            input.displayName,
            input.birthdate,
            input.notes,
            input.color,
        );
        router.back();
    };

    return (
        <ChildForm
            headerTitle="Add child"
            initialValues={INITIAL}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
