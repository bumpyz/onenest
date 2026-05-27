import { addDays, format, startOfDay } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    getCustodyOverridesForRange,
    getCustodySchedule,
    getEventOccurrenceOverridesForRange,
    getEventsForRange,
    getHouseholdBusyBlocks,
    type CustodyOverride,
    type CustodySchedule,
    type Event,
    type EventOccurrenceOverride,
    type HouseholdBusyBlock,
} from '@/lib/db';
import { buildOverrideMap } from '@/lib/custody';
import { computeWeekSummary, type WeekSummary } from '@/lib/summary';
import { useAuth } from '@/providers/auth-provider';

/**
 * Bundle of the raw inputs computeWeekSummary needs. Returned alongside
 * `summary` so callers that need a *what-if* projection (e.g. EventDetail
 * recomputing the conflict ribbon against a draft child_ids selection
 * before the user has committed) can re-run the resolver with a
 * virtually-modified event without re-issuing the underlying fetches.
 * All fields are non-null after the hook's first successful refetch;
 * `null` only while loading or after an error.
 */
export type WeekSummaryInputs = {
    events: Event[];
    busyBlocks: HouseholdBusyBlock[];
    custodySchedule: CustodySchedule | null;
    custodyOverrides: Map<string, CustodyOverride>;
    occurrenceOverrides: Map<string, EventOccurrenceOverride>;
};

const HORIZON_DAYS = 7;

/**
 * Pulls the next HORIZON_DAYS days of events + every member's busy blocks and computes a
 * conflict/coverage summary. Used by the Home tab's "Next 7 days" overview card.
 *
 * Also pulls the custody schedule + custody overrides + per-occurrence event overrides
 * for the window so alternation events resolve to their effective parent in the summary.
 * Without those, alternation events (which carry responsible_profile_id=null in storage)
 * appeared in "unassigned" even when the schedule unambiguously assigned them.
 */
export function useWeekSummary(householdId: string | undefined) {
    // Depend on user id, not the full session — see use-households.ts for the rationale.
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    const [summary, setSummary] = useState<WeekSummary | null>(null);
    const [inputs, setInputs] = useState<WeekSummaryInputs | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const start = useMemo(() => startOfDay(new Date()), []);
    const end = useMemo(() => addDays(start, HORIZON_DAYS), [start]);
    // Custody / occurrence-override fetches want an INCLUSIVE end date. Subtracting a
    // millisecond off `end` would work too, but using HORIZON_DAYS-1 days from start is
    // cleaner intent.
    const endInclusive = useMemo(
        () => addDays(start, HORIZON_DAYS - 1),
        [start],
    );

    const refetch = useCallback(async () => {
        if (!userId || !householdId) {
            setSummary(null);
            setInputs(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // Range fetchers want YYYY-MM-DD strings inclusive on both ends.
            const startKey = format(start, 'yyyy-MM-dd');
            const endKey = format(endInclusive, 'yyyy-MM-dd');
            const [
                events,
                busyBlocks,
                custodySchedule,
                custodyOverrideRows,
                occurrenceOverrideRows,
            ] = await Promise.all([
                getEventsForRange(householdId, start, end),
                getHouseholdBusyBlocks(householdId, start, end),
                getCustodySchedule(householdId),
                getCustodyOverridesForRange(householdId, startKey, endKey),
                getEventOccurrenceOverridesForRange(
                    householdId,
                    startKey,
                    endKey,
                ),
            ]);
            const custodyOverrides = buildOverrideMap(custodyOverrideRows);
            // Build the resolver's expected Map<"eventId|YYYY-MM-DD", row> shape from
            // the flat array the fetcher returns.
            const occurrenceOverrides = new Map<string, EventOccurrenceOverride>();
            for (const row of occurrenceOverrideRows) {
                occurrenceOverrides.set(
                    `${row.event_id}|${row.occurrence_date}`,
                    row,
                );
            }
            setSummary(
                computeWeekSummary(
                    events,
                    busyBlocks,
                    custodySchedule,
                    custodyOverrides,
                    occurrenceOverrides,
                ),
            );
            setInputs({
                events,
                busyBlocks,
                custodySchedule,
                custodyOverrides,
                occurrenceOverrides,
            });
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setSummary({ conflicts: [], unassignedEvents: [] });
            setInputs(null);
        } finally {
            setIsLoading(false);
        }
    }, [userId, householdId, start, end, endInclusive]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { summary, inputs, isLoading, error, refetch };
}
