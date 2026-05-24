import { useCallback, useEffect, useState } from 'react';

import { getHouseholdTasks, type Task } from '@/lib/db';

/**
 * Pulls every task in the household for the Lists tab. Unlike use-upcoming-tasks (which
 * windows by due date and excludes completed tasks), this pulls the full set so the
 * Lists tab can group by list_id and let the user scroll back through completed work.
 *
 * Pass openOnly=true to skip completed tasks (useful for a future "hide completed"
 * toggle). Default false keeps parity with how Reminders.app + most todo UIs behave.
 */
export function useHouseholdTasks(
    householdId: string | undefined,
    options: { openOnly?: boolean } = {},
) {
    const { openOnly = false } = options;
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setTasks(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getHouseholdTasks(householdId, { openOnly });
            setTasks(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, openOnly]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { tasks, isLoading, error, refetch };
}
