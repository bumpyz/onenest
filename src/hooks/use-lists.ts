import { useCallback, useEffect, useState } from 'react';

import { getLists, type List } from '@/lib/db';

/**
 * Loads the household's task lists, ordered by sort_order then created_at. Same shape
 * as use-children / use-locations — idle while householdId is undefined, refetch()
 * exposed so screens can refresh after returning from the add/edit modal.
 *
 * The default "Inbox" (created by trigger) lands first via sort_order=0; user-created
 * lists follow.
 */
export function useLists(householdId: string | undefined) {
    const [lists, setLists] = useState<List[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setLists(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getLists(householdId);
            setLists(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLists([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { lists, isLoading, error, refetch };
}
