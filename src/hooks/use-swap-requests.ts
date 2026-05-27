// useSwapRequests — lists pending swap requests for a household.
//
// Surfaces the data behind:
//   • Family Hub's warn-tinted banner (#372) — visible when status='pending'
//     and a row exists; tap routes to /custody/schedule's Pending section.
//   • The (future #399) dedicated review screen — same hook, paginated
//     via the `status` arg.
//
// The banner read is intentionally pull-only — the table doesn't yet
// have a realtime subscription. The Family Hub screen refetches on
// focus through `useFocusEffect`, which is enough for the banner's
// "show new asks within a few seconds of switching tabs" UX. A realtime
// channel is worth adding when #399 surfaces the responder UI.

import { useCallback, useEffect, useState } from 'react';

import {
    getSwapRequests,
    type SwapRequest,
    type SwapRequestStatus,
} from '@/lib/db';

export function useSwapRequests(
    householdId: string | undefined,
    status: SwapRequestStatus | 'all' = 'pending',
) {
    const [requests, setRequests] = useState<SwapRequest[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setRequests(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getSwapRequests(householdId, status);
            setRequests(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setRequests([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, status]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { requests, isLoading, error, refetch };
}
