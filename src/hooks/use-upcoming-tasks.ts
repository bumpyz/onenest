import { addDays, isSameDay, startOfDay } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUpcomingTasks, type Task } from '@/lib/db';

export type UpcomingTasksBuckets = {
    /** Incomplete tasks due today. */
    today: Task[];
    /** Incomplete tasks due in the next 7 days, excluding today. */
    thisWeek: Task[];
    /** Incomplete tasks with no due date but assigned (or anyone). */
    undated: Task[];
};

/**
 * Pulls incomplete tasks for the household over today + the next 6 days, plus any
 * undated tasks. Splits into Today / This week / Undated buckets so the Home digest
 * doesn't have to re-shape on every render. Refetches via the returned refetch().
 */
export function useUpcomingTasks(householdId: string | undefined) {
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const rangeStart = useMemo(() => startOfDay(new Date()), []);
    // 7-day horizon ending at the end of day-6 — endOfDay would import more from date-fns
    // for marginal precision. Adding 7 days from start-of-today and subtracting one ms
    // lands on 23:59:59.999 of day 6.
    const rangeEnd = useMemo(
        () => new Date(addDays(rangeStart, 7).getTime() - 1),
        [rangeStart],
    );

    const refetch = useCallback(async () => {
        if (!householdId) {
            setTasks(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getUpcomingTasks(householdId, rangeStart, rangeEnd, {
                includeUndated: true,
            });
            setTasks(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, rangeStart, rangeEnd]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const buckets = useMemo<UpcomingTasksBuckets>(() => {
        const today: Task[] = [];
        const thisWeek: Task[] = [];
        const undated: Task[] = [];
        for (const t of tasks ?? []) {
            if (!t.due_at) {
                undated.push(t);
                continue;
            }
            const due = new Date(t.due_at);
            if (isSameDay(due, rangeStart)) today.push(t);
            else thisWeek.push(t);
        }
        return { today, thisWeek, undated };
    }, [tasks, rangeStart]);

    return { tasks, buckets, isLoading, error, refetch };
}
