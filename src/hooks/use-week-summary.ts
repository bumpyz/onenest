import { addDays, startOfDay } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getEventsForRange, getHouseholdBusyBlocks } from '@/lib/db';
import { computeWeekSummary, type WeekSummary } from '@/lib/summary';
import { useAuth } from '@/providers/auth-provider';

const HORIZON_DAYS = 7;

/**
 * Pulls the next HORIZON_DAYS days of events + every member's busy blocks and computes a
 * conflict/coverage summary. Used by the Home tab's "Next 7 days" overview card.
 */
export function useWeekSummary(householdId: string | undefined) {
    const { session } = useAuth();
    const [summary, setSummary] = useState<WeekSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const start = useMemo(() => startOfDay(new Date()), []);
    const end = useMemo(() => addDays(start, HORIZON_DAYS), [start]);

    const refetch = useCallback(async () => {
        if (!session || !householdId) {
            setSummary(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [events, busyBlocks] = await Promise.all([
                getEventsForRange(householdId, start, end),
                getHouseholdBusyBlocks(householdId, start, end),
            ]);
            setSummary(computeWeekSummary(events, busyBlocks));
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setSummary({ conflicts: [], unassignedEvents: [] });
        } finally {
            setIsLoading(false);
        }
    }, [session, householdId, start, end]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { summary, isLoading, error, refetch };
}
