import { Redirect, useRouter } from 'expo-router';

import {
    ChildForm,
    type ChildFormSubmit,
    type ChildFormValues,
} from '@/components/child-form';
import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLocations } from '@/hooks/use-locations';
import {
    addChild,
    addChildAllergy,
    addChildMedication,
    setChildLivingWith,
    updateChildBasics,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export default function NewChildScreen() {
    const router = useRouter();
    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    // Saved locations feed the School picker sheet (#465). We don't
    // block the form on locations loading — an empty list while
    // loading or for a fresh household just falls back to the plain
    // TextInputSheet path; once loaded the picker switches in
    // seamlessly on next open.
    const { locations } = useLocations(household?.id);

    if (authLoading || householdsLoading || membersLoading) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    // Default seeding per spec 07.2:
    //   • Lives with = current user only (co-parent must be tapped on)
    //   • Follows main pattern = on
    //   • Caregiver visibility = assigned_only
    //   • Color = null (DB trigger picks)
    const INITIAL: ChildFormValues = {
        displayName: '',
        birthdate: '',
        notes: '',
        color: null,
        pronouns: '',
        nickname: '',
        school: '',
        grade: '',
        teacher: '',
        followsMainPattern: true,
        pediatricianContactId: null,
        caregiverVisibility: 'assigned_only',
        livesWith: [user.id],
        allergies: [],
        medications: [],
    };

    const handleSubmit = async (input: ChildFormSubmit) => {
        // 1. Insert the children row first so we have an id for the
        //    junctions to FK against.
        const created = await addChild(
            household.id,
            input.displayName,
            input.birthdate || null,
            input.notes || null,
            input.color,
        );
        // 2. Patch the v2 fields that addChild's legacy signature
        //    doesn't take. We do this as a follow-up update rather
        //    than extending addChild because the legacy signature is
        //    still used elsewhere.
        await updateChildBasics(created.id, {
            pronouns: input.pronouns,
            nickname: input.nickname,
            school: input.school,
            grade: input.grade,
            teacher: input.teacher,
            followsMainPattern: input.followsMainPattern,
            pediatricianContactId: input.pediatricianContactId,
            caregiverVisibility: input.caregiverVisibility,
        });
        // 3. Lives-with junction.
        if (input.livesWith.length > 0) {
            await setChildLivingWith(created.id, input.livesWith);
        }
        // 4. Allergies + medications — insert each.
        for (const a of input.allergies) {
            await addChildAllergy({
                childId: created.id,
                label: a.label,
                severity: a.severity,
            });
        }
        for (const m of input.medications) {
            await addChildMedication({
                childId: created.id,
                label: m.label,
                dose: m.dose || null,
            });
        }
        router.back();
    };

    return (
        <ChildForm
            headerTitle="Add child"
            initialValues={INITIAL}
            members={members ?? []}
            locations={locations ?? []}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
