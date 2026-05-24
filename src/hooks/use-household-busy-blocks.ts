import { addDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getHouseholdBusyBlocks, type HouseholdBusyBlock } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

/**
 * Returns all household members' opaque busy windows that overlap
 * [rangeStart, rangeStart + numDays). `numDays` defaults to 7 (week view); Day view passes
 * 1 and a future Month view passes ~42. The underlying RPC runs as SECURITY DEFINER and
 * returns no titles or descriptions — just times + the owner's profile_id, which is enough
 * to render colored "busy" overlays for each parent without leaking what they're doing.
 */
export function useHouseholdBusyBlocks(
    householdId: string | undefined,
    rangeStart: Date,
    numDays: number = 7,
) {
    // Depend on user id, not the full session — see use-households.ts for the rationale.
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    const [blocks, setBlocks] = useState<HouseholdBusyBlock[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const rangeEnd = useMemo(() => addDays(rangeStart, numDays), [rangeStart, numDays]);

    const refetch = useCallback(async () => {
        if (!userId || !householdId) {
            setBlocks(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getHouseholdBusyBlocks(householdId, rangeStart, rangeEnd);
            setBlocks(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setBlocks([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId, householdId, rangeStart, rangeEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { blocks, isLoading, error, refetch };
}
