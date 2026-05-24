import { useCallback, useEffect, useState } from 'react';

import { getEventTasks, type Task } from '@/lib/db';

/**
 * Loads tasks attached to one event. Returns null when eventId is undefined (the form
 * is in create-new mode and the event doesn't exist yet — caller manages local state).
 */
export function useEventTasks(eventId: string | undefined) {
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!eventId) {
            setTasks(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getEventTasks(eventId);
            setTasks(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { tasks, isLoading, error, refetch };
}
