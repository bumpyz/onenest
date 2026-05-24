import { addDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMyExternalEventsForRange, type ExternalEvent } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

/**
 * Returns the current user's own external (paired-calendar) events whose time range overlaps
 * [rangeStart, rangeStart + numDays). `numDays` defaults to 7 (week view); Day view passes 1
 * and a future Month view passes ~42. RLS guarantees we never receive other users' rows.
 */
export function useMyExternalEvents(rangeStart: Date, numDays: number = 7) {
    // Depend on user id, not the full session — see use-households.ts for the rationale.
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    const [events, setEvents] = useState<ExternalEvent[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const rangeEnd = useMemo(() => addDays(rangeStart, numDays), [rangeStart, numDays]);

    const refetch = useCallback(async () => {
        if (!userId) {
            setEvents(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMyExternalEventsForRange(rangeStart, rangeEnd);
            setEvents(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId, rangeStart, rangeEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { events, isLoading, error, refetch };
}
