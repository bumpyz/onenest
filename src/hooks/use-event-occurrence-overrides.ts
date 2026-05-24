import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    getEventOccurrenceOverridesForRange,
    type EventOccurrenceOverride,
} from '@/lib/db';

/**
 * Returns per-event, per-date responsible-parent overrides for any of the household's
 * events whose occurrence_date falls in [rangeStart, rangeEnd]. Mirrors the
 * useCustodyOverrides shape — same date math, similar refetch flow.
 *
 * The returned `overrideMap` is keyed by "event_id|YYYY-MM-DD" for O(1) lookup from the
 * recurrence resolver, since each event instance is identified by that pair.
 */
export function useEventOccurrenceOverrides(
    householdId: string | undefined,
    rangeStart: Date,
    rangeEnd: Date,
) {
    const startYmd = format(rangeStart, 'yyyy-MM-dd');
    const endYmd = format(rangeEnd, 'yyyy-MM-dd');

    const [overrides, setOverrides] = useState<EventOccurrenceOverride[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setOverrides(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getEventOccurrenceOverridesForRange(
                householdId,
                startYmd,
                endYmd,
            );
            setOverrides(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setOverrides([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, startYmd, endYmd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const overrideMap = useMemo(() => {
        const map = new Map<string, EventOccurrenceOverride>();
        for (const o of overrides ?? []) {
            map.set(`${o.event_id}|${o.occurrence_date}`, o);
        }
        return map;
    }, [overrides]);

    return { overrides, overrideMap, isLoading, error, refetch };
}
