import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    ChildForm,
    type ChildFormSubmit,
    type ChildFormValues,
} from '@/components/child-form';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useHouseholds } from '@/hooks/use-households';
import { deleteChild, updateChild } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export default function EditChildScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { children, isLoading: childrenLoading } = useChildren(household?.id);

    const child = useMemo(
        () => (id && children ? children.find((c) => c.id === id) : null),
        [id, children],
    );

    const initialValues = useMemo<ChildFormValues | null>(() => {
        if (!child) return null;
        return {
            displayName: child.display_name,
            birthdate: child.birthdate ?? '',
            notes: child.notes ?? '',
            color: child.color,
        };
    }, [child]);

    if (authLoading || householdsLoading || childrenLoading) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!child || !initialValues) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            This child may have been deleted.
                        </ThemedText>
                        <Pressable
                            onPress={() => router.replace('/settings')}
                            style={styles.linkBtn}>
                            <ThemedText style={{ color: '#6F7FA5' }}>
                                Back to Settings
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const handleSubmit = async (input: ChildFormSubmit) => {
        // Color is non-null on edit (initialValues was preloaded from the row), but the
        // ChildFormSubmit type allows null for the create path. Fall back to the existing
        // color in the unlikely case the user unset it.
        await updateChild(
            child.id,
            input.displayName,
            input.birthdate,
            input.notes,
            input.color ?? child.color,
        );
        router.back();
    };

    const handleDelete = async () => {
        await deleteChild(child.id);
        router.back();
    };

    return (
        <ChildForm
            headerTitle="Edit child"
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
