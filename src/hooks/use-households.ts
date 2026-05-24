import { useCallback, useEffect, useState } from 'react';

import { getMyHouseholds, type Household } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export function useHouseholds() {
    // Depend on user id, NOT the full session object — Supabase's auth client mutates
    // the session reference on every token refresh (and on every tab focus on web), which
    // would otherwise refire this hook and briefly unmount any child route that gates on
    // `households` being loaded (e.g. the event form). The supabase client carries the
    // current token internally for the actual API call.
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    const [households, setHouseholds] = useState<Household[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!userId) {
            setHouseholds(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMyHouseholds();
            setHouseholds(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setHouseholds([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { households, isLoading, error, refetch };
}
