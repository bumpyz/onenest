import { useCallback, useEffect, useState } from 'react';

import { getCustodySchedule, type CustodySchedule } from '@/lib/db';

export function useCustodySchedule(householdId: string | undefined) {
    const [schedule, setSchedule] = useState<CustodySchedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setSchedule(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getCustodySchedule(householdId);
            setSchedule(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setSchedule(null);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { schedule, isLoading, error, refetch };
}
