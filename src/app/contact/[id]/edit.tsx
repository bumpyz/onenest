// Edit-mode for an existing contact. Phase 7.4 split the read view to
// /contact/[id]/index.tsx (the new design-faithful detail screen); this
// route hosts the form-based editor reached via the pencil button in the
// detail screen's top bar. Same content as the pre-Phase-7 /contact/[id].tsx,
// just relocated under the dynamic-route directory.

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import {
    ContactForm,
    type ContactFormSubmit,
    type ContactFormValues,
} from '@/components/contact-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { useAppColorScheme } from '@/providers/theme-provider';
import {
    deleteContact,
    deleteContactAvatar,
    getContact,
    getContactAvatarSignedUrl,
    updateContact,
    uploadContactAvatar,
    type Contact,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export default function EditContactScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // Single-record fetch — same pattern as the pre-Phase-7 screen. Contacts
    // aren't shared across multiple screens needing the same dataset, so
    // paying for one round-trip here keeps state local and the route
    // self-contained.
    const [contact, setContact] = useState<Contact | null>(null);
    const [contactLoading, setContactLoading] = useState(true);
    const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!id) {
            setContact(null);
            setContactLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const data = await getContact(id);
                if (cancelled) return;
                setContact(data);
                if (data?.avatar_url) {
                    const url = await getContactAvatarSignedUrl(data.avatar_url);
                    if (!cancelled) setAvatarDisplayUrl(url);
                }
            } catch (err) {
                console.error('getContact failed', err);
                if (!cancelled) setContact(null);
            } finally {
                if (!cancelled) setContactLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (authLoading || householdsLoading || roleLoading || contactLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers can read + dial from the /contacts list, but they can't edit
    // or delete. Bounce them back to the list instead of showing a form they
    // can't submit.
    if (isCaregiver) return <Redirect href="/contacts" />;

    if (!contact) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Contact not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            It may have been deleted.
                        </ThemedText>
                        <Pressable
                            onPress={() => router.replace('/contacts')}
                            style={styles.linkBtn}>
                            <ThemedText style={{ color: colors.accent }}>
                                Back to Contacts
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const initialValues: ContactFormValues = {
        name: contact.name,
        phone: contact.phone,
        company: contact.company ?? '',
        descriptor: contact.descriptor ?? '',
        avatarUrl: contact.avatar_url,
        avatarDisplayUrl,
        category: contact.category,
        isFavorite: contact.is_favorite,
        isEmergency: contact.is_emergency,
        email: contact.email ?? '',
        bestTime: contact.best_time ?? '',
        address: contact.address ?? '',
        notes: contact.notes ?? '',
        linkedEventId: contact.linked_event_id,
        linkedEventLabel: contact.linked_event_id ? 'Linked event' : null,
    };

    const handleSubmit = async (input: ContactFormSubmit) => {
        let avatarUrlPatch: { avatarUrl?: string | null } = {};
        if (input.avatar.kind === 'clear') {
            if (contact.avatar_url) {
                await deleteContactAvatar(contact.avatar_url);
            }
            avatarUrlPatch = { avatarUrl: null };
        } else if (input.avatar.kind === 'pick') {
            try {
                const path = await uploadContactAvatar(
                    contact.household_id,
                    contact.id,
                    input.avatar.blob,
                    input.avatar.ext,
                );
                avatarUrlPatch = { avatarUrl: path };
            } catch (err) {
                console.error('avatar upload on edit failed', err);
                throw err;
            }
        }
        await updateContact(contact.id, {
            name: input.name,
            phone: input.phone,
            company: input.company,
            descriptor: input.descriptor,
            ...avatarUrlPatch,
            category: input.category,
            isFavorite: input.isFavorite,
            isEmergency: input.isEmergency,
            email: input.email,
            bestTime: input.bestTime,
            address: input.address,
            notes: input.notes,
            linkedEventId: input.linkedEventId,
        });
        // Back goes to the detail screen (which is one step up the stack).
        router.back();
    };

    const handleDelete = async () => {
        if (contact.avatar_url) {
            await deleteContactAvatar(contact.avatar_url);
        }
        await deleteContact(contact.id);
        // Delete takes the user past the now-stale detail screen back to
        // the Contacts list. We can't router.back() because that lands on
        // detail which would 404 itself; replace instead.
        router.replace('/contacts');
    };

    return (
        <ContactForm
            headerTitle="Edit contact"
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
