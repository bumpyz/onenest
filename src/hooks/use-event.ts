import { useCallback, useEffect, useState } from 'react';

import { getEvent, type Event } from '@/lib/db';

export function useEvent(id: string | undefined) {
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!id) {
            setEvent(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getEvent(id);
            setEvent(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setEvent(null);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { event, isLoading, error, refetch };
}
