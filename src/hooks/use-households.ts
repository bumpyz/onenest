import { useCallback, useEffect, useState } from 'react';

import { getMyHouseholds, type Household } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export function useHouseholds() {
    const { session } = useAuth();
    const [households, setHouseholds] = useState<Household[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!session) {
            setHouseholds(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMyHouseholds();
            setHouseholds(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setHouseholds([]);
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { households, isLoading, error, refetch };
}
