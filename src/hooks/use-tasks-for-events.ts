import { useCallback, useEffect, useMemo, useState } from 'react';

import { getTasksForEvents, type Task } from '@/lib/db';

/**
 * Batch-loads ALL tasks (open + completed) for the given event IDs in one
 * round-trip, then returns them both as a flat list and grouped by event.
 *
 * Used by Home's TimelineCard to feed each event row's done/total counter
 * and (when expanded) the inline task list. Per-event grouping is exposed
 * as a Map so the consumer can do O(1) lookups in render. Memoizes on the
 * sorted-joined eventIds string so passing a fresh array reference every
 * render doesn't trigger a refetch — only an actual id-set change does.
 */
export function useTasksForEvents(eventIds: string[]) {
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Stable cache key for the id set — sort + join so [a,b] === [b,a] for
    // the effect's perspective. Empty array → empty key → no fetch.
    const cacheKey = useMemo(
        () => [...eventIds].sort().join(','),
        [eventIds],
    );

    const refetch = useCallback(async () => {
        if (!cacheKey) {
            setTasks([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const ids = cacheKey.split(',');
            const data = await getTasksForEvents(ids);
            setTasks(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    }, [cacheKey]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    // Group by event_id for O(1) per-row lookup. Null event_id tasks (which
    // the IN-query wouldn't return anyway) get filtered just in case.
    const byEvent = useMemo(() => {
        const m = new Map<string, Task[]>();
        for (const t of tasks ?? []) {
            if (!t.event_id) continue;
            const list = m.get(t.event_id);
            if (list) list.push(t);
            else m.set(t.event_id, [t]);
        }
        return m;
    }, [tasks]);

    return { tasks: tasks ?? [], byEvent, isLoading, error, refetch };
}
