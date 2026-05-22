import { addDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getEventsForRange, type Event } from '@/lib/db';

// Fetches events whose start time falls within [weekStart, weekStart + 7 days).
// Refetch is exposed so screens can refresh after navigation events (e.g. coming back from a create modal).
export function useEvents(householdId: string | undefined, weekStart: Date) {
    const [events, setEvents] = useState<Event[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setEvents(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getEventsForRange(householdId, weekStart, weekEnd);
            setEvents(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, weekStart, weekEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { events, isLoading, error, refetch };
}
