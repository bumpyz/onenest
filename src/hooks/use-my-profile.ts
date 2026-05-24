import { useCallback, useEffect, useState } from 'react';

import { getMyProfile, type Profile } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

/**
 * Returns the current user's profile row. Refetches when the signed-in user changes.
 * Used by Settings (default-timezone card) and by event/new (pre-fills the new event's
 * tz from profile.default_timezone, falling back to the device tz if null).
 *
 * Depends on user id, not the full session — see use-households.ts for the rationale.
 */
export function useMyProfile() {
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!userId) {
            setProfile(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMyProfile();
            setProfile(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setProfile(null);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { profile, isLoading, error, refetch };
}
