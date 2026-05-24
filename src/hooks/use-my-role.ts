import { useMemo } from 'react';

import { useAuth } from '@/providers/auth-provider';
import type { HouseholdRole } from '@/lib/db';

import { useHouseholdMembers } from './use-household-members';

/**
 * Resolves the current user's role in the given household. Returns 'parent' /
 * 'caregiver' / 'viewer' once members have loaded, or null while we don't yet
 * know.
 *
 * Caregivers have a restricted UI (no creation paths, read-only event/task
 * detail, no custody/invite tools); callers branch on this to hide affordances.
 *
 * IMPORTANT: this is a defense-in-depth UX layer only — the server enforces the
 * real permission boundary through migration 0031's RLS policies and the
 * mark_task_complete RPC. Don't rely on this hook for security.
 */
export function useMyRole(householdId: string | undefined): {
    role: HouseholdRole | null;
    isParent: boolean;
    isCaregiver: boolean;
    isLoading: boolean;
} {
    const { user } = useAuth();
    const { members, isLoading } = useHouseholdMembers(householdId);

    return useMemo(() => {
        if (!householdId || !user || !members) {
            return { role: null, isParent: false, isCaregiver: false, isLoading };
        }
        const mine = members.find((m) => m.profile_id === user.id);
        const role = (mine?.role ?? null) as HouseholdRole | null;
        return {
            role,
            isParent: role === 'parent',
            isCaregiver: role === 'caregiver',
            isLoading,
        };
    }, [householdId, user, members, isLoading]);
}
