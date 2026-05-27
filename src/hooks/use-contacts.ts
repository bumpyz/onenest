import { useCallback, useEffect, useState } from 'react';

import { getContacts, type Contact } from '@/lib/db';

/**
 * Loads the household's contacts (quick-dial directory). Same shape as
 * use-children / use-locations: idle while householdId is undefined,
 * refetches on id change, exposes refetch() so the Contacts tab can refresh
 * after returning from the add / edit modal.
 */
export function useContacts(householdId: string | undefined) {
    const [contacts, setContacts] = useState<Contact[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setContacts(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getContacts(householdId);
            setContacts(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setContacts([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { contacts, isLoading, error, refetch };
}
