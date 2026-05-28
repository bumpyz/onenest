import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { getCustodyOverridesForRange, type CustodyOverride } from '@/lib/db';

/**
 * Fetches custody_overrides whose override_date falls in [rangeStart, rangeEnd] (inclusive
 * both ends — the table stores DATE values, no time component).
 */
export function useCustodyOverrides(
    householdId: string | undefined,
    rangeStart: Date | null,
    rangeEnd: Date | null,
) {
    const [overrides, setOverrides] = useState<CustodyOverride[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const startKey = rangeStart ? format(rangeStart, 'yyyy-MM-dd') : null;
    const endKey = rangeEnd ? format(rangeEnd, 'yyyy-MM-dd') : null;

    const refetch = useCallback(async () => {
        if (!householdId || !startKey || !endKey) {
            setOverrides(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getCustodyOverridesForRange(householdId, startKey, endKey);
            setOverrides(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setOverrides([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, startKey, endKey]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    // #494 finding: saving an override from /custody/[date] and
    // navigating back wasn't updating any surface that reads overrides
    // (Today strip, Family Hub hero, /custody/schedule, calendar
    // custody band). All those consumers read this hook, so refetching
    // on screen-focus is the single-point fix. Mirrors the pattern
    // applied to useCustodySchedule for #491 finding #1.
    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch]),
    );

    return { overrides, isLoading, error, refetch };
}
