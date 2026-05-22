import { addDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getHouseholdBusyBlocks, type HouseholdBusyBlock } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

/**
 * Returns all household members' opaque busy windows that overlap [weekStart, weekStart+7).
 * The underlying RPC runs as SECURITY DEFINER and returns no titles or descriptions —
 * just times + the owner's profile_id, which is enough to render colored "busy" overlays
 * for each parent without leaking what they're actually doing.
 */
export function useHouseholdBusyBlocks(householdId: string | undefined, weekStart: Date) {
    const { session } = useAuth();
    const [blocks, setBlocks] = useState<HouseholdBusyBlock[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

    const refetch = useCallback(async () => {
        if (!session || !householdId) {
            setBlocks(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getHouseholdBusyBlocks(householdId, weekStart, weekEnd);
            setBlocks(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setBlocks([]);
        } finally {
            setIsLoading(false);
        }
    }, [session, householdId, weekStart, weekEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { blocks, isLoading, error, refetch };
}
