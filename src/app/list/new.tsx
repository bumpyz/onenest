import { Redirect, useRouter } from 'expo-router';

import { ListForm, type ListFormSubmit } from '@/components/list-form';
import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { createList } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export default function NewListScreen() {
    const router = useRouter();
    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    if (authLoading || householdsLoading || roleLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers cannot create lists (parent-only via RLS on tasks/lists).
    if (isCaregiver) return <Redirect href="/lists" />;

    const handleSubmit = async (input: ListFormSubmit) => {
        await createList(household.id, {
            name: input.name,
            // Pass through null so the DB trigger picks a palette slot when the user
            // hasn't chosen a color manually.
            color: input.color,
        });
        router.back();
    };

    return (
        <ListForm
            headerTitle="New list"
            submitLabel="Create"
            initialValues={{ name: '', color: null }}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
