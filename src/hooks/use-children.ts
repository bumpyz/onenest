import { useCallback, useEffect, useState } from 'react';

import { getHouseholdChildren, type Child } from '@/lib/db';

/**
 * Loads the household's children list. Same pattern as use-locations: idle while
 * householdId is undefined, refetches when the id changes, exposes a refetch() for
 * screens to call after returning from the add/edit modal.
 */
export function useChildren(householdId: string | undefined) {
    const [children, setChildren] = useState<Child[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setChildren(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getHouseholdChildren(householdId);
            setChildren(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setChildren([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { children, isLoading, error, refetch };
}
