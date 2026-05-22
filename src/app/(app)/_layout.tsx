import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholds } from '@/hooks/use-households';
import { useAuth } from '@/providers/auth-provider';

export default function AppLayout() {
    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();

    if (authLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (householdsLoading) return <LoadingScreen />;
    if (!households || households.length === 0) {
        return <Redirect href="/create-household" />;
    }

    return (
        <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        </Tabs>
    );
}
