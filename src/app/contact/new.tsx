import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import {
    ContactForm,
    type ContactFormSubmit,
    type ContactFormValues,
} from '@/components/contact-form';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import {
    createContact,
    updateContact,
    uploadContactAvatar,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

const BASE_INITIAL: ContactFormValues = {
    name: '',
    phone: '',
    company: '',
    descriptor: '',
    avatarUrl: null,
    avatarDisplayUrl: null,
    // Phase 7 defaults — new rows land in the 'other' category with no
    // tier flags or extra fields set. Users opt in to category /
    // favorite / emergency via the form picker + toggles.
    category: 'other',
    isFavorite: false,
    isEmergency: false,
    email: '',
    bestTime: '',
    address: '',
    notes: '',
    linkedEventId: null,
    linkedEventLabel: null,
};

export default function NewContactScreen() {
    const router = useRouter();
    // Optional `?emergency=1` from the Contacts emergency-strip empty-state
    // tile — pre-flags is_emergency so the user lands in a one-tap "fill
    // name + phone + save" state for the common case (doctor, school).
    const params = useLocalSearchParams<{ emergency?: string }>();
    const startEmergency = params.emergency === '1';
    const initialValues: ContactFormValues = {
        ...BASE_INITIAL,
        isEmergency: startEmergency,
        // If the user came in via the emergency tile, the 'emergency'
        // category is the right default — keeps the contact's category
        // chip + the strip pin consistent without an extra tap.
        category: startEmergency ? 'emergency' : BASE_INITIAL.category,
    };

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    if (authLoading || householdsLoading || roleLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Contacts are parent-curated. Caregivers can read + dial but cannot add.
    // RLS would reject the INSERT; bouncing at the route avoids the form +
    // cryptic postgres error.
    if (isCaregiver) return <Redirect href="/contacts" />;

    const handleSubmit = async (input: ContactFormSubmit) => {
        // Two-step on create when an avatar was picked: insert first (so we
        // have a contact_id for the storage path), then upload, then patch
        // avatar_url onto the new row. We don't keep a draft id client-side
        // because the storage path uses contact_id as its filename, and
        // making one up only to rename later doubles the round-trips.
        const created = await createContact(household.id, {
            name: input.name,
            phone: input.phone,
            company: input.company,
            descriptor: input.descriptor,
            category: input.category,
            isFavorite: input.isFavorite,
            isEmergency: input.isEmergency,
            email: input.email,
            bestTime: input.bestTime,
            address: input.address,
            notes: input.notes,
            linkedEventId: input.linkedEventId,
        });
        if (input.avatar.kind === 'pick') {
            try {
                const path = await uploadContactAvatar(
                    household.id,
                    created.id,
                    input.avatar.blob,
                    input.avatar.ext,
                );
                // Only the avatar_url changes here. Every other Phase 7
                // field was already persisted by the create() above, so we
                // omit them from this update — the helper's "undefined =
                // leave alone" convention takes care of the rest.
                await updateContact(created.id, {
                    name: input.name,
                    phone: input.phone,
                    company: input.company,
                    descriptor: input.descriptor,
                    avatarUrl: path,
                });
            } catch (err) {
                // The contact was created successfully — only the avatar
                // upload failed. Log + continue rather than throw, so the
                // user doesn't see a confusing "save failed" toast when
                // their text fields landed fine. They can re-edit to add
                // the photo later.
                console.error('avatar upload on create failed', err);
            }
        }
        router.back();
    };

    return (
        <ContactForm
            headerTitle="Add contact"
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
