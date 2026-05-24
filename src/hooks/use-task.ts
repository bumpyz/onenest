import { useCallback, useEffect, useState } from 'react';

import { getTask, type Task } from '@/lib/db';

/**
 * Fetches a single task by id (with assignees attached). Same shape as use-event.
 * Refetch exposed so the edit modal can refresh after saving without rerouting.
 */
export function useTask(id: string | undefined) {
    const [task, setTask] = useState<Task | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!id) {
            setTask(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getTask(id);
            setTask(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setTask(null);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { task, isLoading, error, refetch };
}
