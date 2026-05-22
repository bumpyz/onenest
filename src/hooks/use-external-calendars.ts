import { useCallback, useEffect, useState } from 'react';

import { getMyExternalCalendars, type ExternalCalendar } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export function useExternalCalendars() {
    const { session } = useAuth();
    const [calendars, setCalendars] = useState<ExternalCalendar[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!session) {
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
    }, [session]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { calendars, isLoading, error, refetch };
}
