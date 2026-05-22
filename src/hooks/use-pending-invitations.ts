import { useCallback, useEffect, useState } from 'react';

import { getPendingInvitations, type Invitation } from '@/lib/db';

export function usePendingInvitations(householdId: string | undefined) {
    const [invitations, setInvitations] = useState<Invitation[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!householdId) {
            setInvitations(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getPendingInvitations(householdId);
            setInvitations(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setInvitations([]);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { invitations, isLoading, error, refetch };
}
