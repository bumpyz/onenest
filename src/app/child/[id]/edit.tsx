import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import {
    addChildAllergy,
    addChildMedication,
    deleteChild,
    deleteChildAllergy,
    deleteChildMedication,
    listChildAllergies,
    listChildLivingWith,
    listChildMedications,
    setChildLivingWith,
    updateChildBasics,
    type ChildAllergy,
    type ChildMedication,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export default function EditChildScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { children, isLoading: childrenLoading } = useChildren(household?.id);
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    // Saved locations for the School picker sheet (#465). Same
    // graceful-loading rationale as the create screen — an empty list
    // while loading falls through to the plain TextInputSheet.
    const { locations } = useLocations(household?.id);

    const child = useMemo(
        () => (id && children ? children.find((c) => c.id === id) : null),
        [id, children],
    );

    // Load the junction-table rows (lives_with / allergies / medications)
    // for this child. They live in three separate tables so the form
    // needs them flat to seed.
    const [livesWith, setLivesWith] = useState<string[] | null>(null);
    const [allergies, setAllergies] = useState<ChildAllergy[] | null>(null);
    const [medications, setMedications] = useState<ChildMedication[] | null>(
        null,
    );
    useEffect(() => {
        if (!child) return;
        let cancelled = false;
        (async () => {
            const [lw, al, md] = await Promise.all([
                listChildLivingWith(child.id),
                listChildAllergies(child.id),
                listChildMedications(child.id),
            ]);
            if (cancelled) return;
            setLivesWith(lw);
            setAllergies(al);
            setMedications(md);
        })();
        return () => {
            cancelled = true;
        };
    }, [child]);

    const initialValues = useMemo<ChildFormValues | null>(() => {
        if (!child || livesWith === null || allergies === null || medications === null) {
            return null;
        }
        return {
            displayName: child.display_name,
            birthdate: child.birthdate ?? '',
            notes: child.notes ?? '',
            color: child.color,
            pronouns: child.pronouns ?? '',
            nickname: child.nickname ?? '',
            school: child.school ?? '',
            grade: child.grade ?? '',
            teacher: child.teacher ?? '',
            followsMainPattern: child.follows_main_pattern,
            pediatricianContactId: child.pediatrician_contact_id,
            caregiverVisibility: child.caregiver_visibility,
            livesWith,
            allergies: allergies.map((a) => ({
                id: a.id,
                label: a.label,
                severity: a.severity,
            })),
            medications: medications.map((m) => ({
                id: m.id,
                label: m.label,
                dose: m.dose ?? '',
            })),
        };
    }, [child, livesWith, allergies, medications]);

    if (
        authLoading ||
        householdsLoading ||
        childrenLoading ||
        membersLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!child) {
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
                            <ThemedText style={{ color: '#1F2940' }}>
                                Back to Settings
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    // Junction data still loading — show a loading screen rather than a
    // half-seeded form.
    if (!initialValues) return <LoadingScreen />;

    const handleSubmit = async (input: ChildFormSubmit) => {
        // 1. Scalar fields via updateChildBasics — every column in one
        //    update, including the legacy {display_name, birthdate,
        //    notes, color} set so we don't fork the write path.
        await updateChildBasics(child.id, {
            displayName: input.displayName,
            birthdate: input.birthdate || null,
            notes: input.notes || null,
            color: input.color ?? child.color,
            pronouns: input.pronouns,
            nickname: input.nickname,
            school: input.school,
            grade: input.grade,
            teacher: input.teacher,
            followsMainPattern: input.followsMainPattern,
            pediatricianContactId: input.pediatricianContactId,
            caregiverVisibility: input.caregiverVisibility,
        });
        // 2. Lives-with junction — bulk replace.
        await setChildLivingWith(child.id, input.livesWith);
        // 3. Allergies diff. Rows with an id we already had stay (no
        //    edit affordance yet); rows without an id are new inserts;
        //    rows present originally but absent now get deleted.
        const originalAllergyIds = new Set(
            (allergies ?? []).map((a) => a.id),
        );
        const draftAllergyIds = new Set(
            input.allergies.map((a) => a.id).filter((x): x is string => !!x),
        );
        for (const orig of allergies ?? []) {
            if (!draftAllergyIds.has(orig.id)) {
                await deleteChildAllergy(orig.id);
            }
        }
        for (const a of input.allergies) {
            if (a.id === null || !originalAllergyIds.has(a.id)) {
                await addChildAllergy({
                    childId: child.id,
                    label: a.label,
                    severity: a.severity,
                });
            }
        }
        // 4. Medications diff (same shape).
        const originalMedIds = new Set(
            (medications ?? []).map((m) => m.id),
        );
        const draftMedIds = new Set(
            input.medications.map((m) => m.id).filter((x): x is string => !!x),
        );
        for (const orig of medications ?? []) {
            if (!draftMedIds.has(orig.id)) {
                await deleteChildMedication(orig.id);
            }
        }
        for (const m of input.medications) {
            if (m.id === null || !originalMedIds.has(m.id)) {
                await addChildMedication({
                    childId: child.id,
                    label: m.label,
                    dose: m.dose || null,
                });
            }
        }
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
            members={members ?? []}
            locations={locations ?? []}
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
