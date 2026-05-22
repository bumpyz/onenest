import { useCallback, useEffect, useState } from 'react';

import { getHouseholdLocations, type Location } from '@/lib/db';

export function useLocations(householdId: string | undefined) {
    const [locations, setLocations] = useState<Location[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setLocations(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getHouseholdLocations(householdId);
            setLocations(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLocations([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { locations, isLoading, error, refetch };
}
