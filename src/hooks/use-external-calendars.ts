import { useCallback, useEffect, useState } from 'react';

import { getMyExternalCalendars, type ExternalCalendar } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export function useExternalCalendars() {
    // Depend on user id, not the full session — see use-households.ts for the rationale.
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    const [calendars, setCalendars] = useState<ExternalCalendar[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!userId) {
            setCalendars(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMyExternalCalendars();
            setCalendars(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setCalendars([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { calendars, isLoading, error, refetch };
}
