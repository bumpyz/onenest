import { addDays } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getEventsForRange, type Event } from '@/lib/db';

// Fetches events whose start time falls within [rangeStart, rangeStart + numDays).
// `numDays` defaults to 7 to preserve the original week-view semantics; Day view passes 1
// and a future Month view passes ~42. Refetch is exposed so screens can refresh after
// navigation events (e.g. coming back from a create modal).
export function useEvents(
    householdId: string | undefined,
    rangeStart: Date,
    numDays: number = 7,
) {
    const [events, setEvents] = useState<Event[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const rangeEnd = useMemo(() => addDays(rangeStart, numDays), [rangeStart, numDays]);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setEvents(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getEventsForRange(householdId, rangeStart, rangeEnd);
            setEvents(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, rangeStart, rangeEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    // Refetch when the consuming screen regains focus — picks up
    // server-side changes that happen while we're on a different
    // screen. The custody override editor (#500) reassigns events
    // server-side on save; without this hook the calendar would
    // still show stale responsible assignments after the user
    // navigates back.
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch]),
    );

    return { events, isLoading, error, refetch };
}
