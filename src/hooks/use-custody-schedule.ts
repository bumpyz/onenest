import { useFocusEffect } from 'expo-router';
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

    // #491 finding #1: pattern saves on /custody/pattern weren't
    // reaching the Today strip / Family Hub hero. Adding a focus
    // refetch here means every consumer (CustodyStripToday,
    // /custody/schedule, /custody/view, Family Hub) picks up the new
    // schedule when the user navigates back to the screen rendering
    // them. The cost is one extra GET per tab focus — fine for a
    // single-row table.
    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch]),
    );

    return { schedule, isLoading, error, refetch };
}
