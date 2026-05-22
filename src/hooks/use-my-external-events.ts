import { addDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMyExternalEventsForRange, type ExternalEvent } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

/**
 * Returns the current user's own external (paired-calendar) events whose time range overlaps
 * [weekStart, weekStart + 7 days). RLS guarantees we never receive other users' rows.
 */
export function useMyExternalEvents(weekStart: Date) {
    const { session } = useAuth();
    const [events, setEvents] = useState<ExternalEvent[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

    const refetch = useCallback(async () => {
        if (!session) {
            setEvents(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMyExternalEventsForRange(weekStart, weekEnd);
            setEvents(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [session, weekStart, weekEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { events, isLoading, error, refetch };
}
