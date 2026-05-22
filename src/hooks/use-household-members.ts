import { useCallback, useEffect, useState } from 'react';

import { getHouseholdMembers, type HouseholdMember } from '@/lib/db';

export function useHouseholdMembers(householdId: string | undefined) {
    const [members, setMembers] = useState<HouseholdMember[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setMembers(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getHouseholdMembers(householdId);
            setMembers(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setMembers([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { members, isLoading, error, refetch };
}
