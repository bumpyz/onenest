import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
    session: null,
    user: null,
    isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setIsLoading(false);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            // Deduplicate: Supabase fires this event on web whenever the tab regains
            // visibility (it does a "session recovery" check). If nothing meaningful
            // changed — same user id and same access token — skip the setState. Without
            // this guard, every tab-switch cascades through every hook that depends on
            // `session`, briefly forcing isLoading=true and unmounting child routes.
            setSession((prev) => {
                const samePresence = !!prev === !!nextSession;
                const sameUser = prev?.user?.id === nextSession?.user?.id;
                const sameToken = prev?.access_token === nextSession?.access_token;
                if (samePresence && sameUser && sameToken) return prev;
                return nextSession;
            });
            setIsLoading(false);
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    // Pause Supabase's auto-refresh while the app is backgrounded on native — saves battery
    // and avoids running refresh requests when the OS is throttling timers.
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                supabase.auth.startAutoRefresh();
            } else {
                supabase.auth.stopAutoRefresh();
            }
        });
        return () => sub.remove();
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ session, user: session?.user ?? null, isLoading }),
        [session, isLoading],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
