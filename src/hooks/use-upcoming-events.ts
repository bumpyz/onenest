import { addDays, startOfDay } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { getEventsForRange, type Event } from '@/lib/db';

/**
 * Today through end of tomorrow (start of today inclusive, start of day-after-tomorrow exclusive).
 * Powers the Home tab's list summary.
 */
export function useUpcomingEvents(householdId: string | undefined) {
    const [events, setEvents] = useState<Event[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setEvents(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const start = startOfDay(new Date());
            const end = addDays(start, 2);
            const data = await getEventsForRange(householdId, start, end);
            setEvents(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { events, isLoading, error, refetch };
}
