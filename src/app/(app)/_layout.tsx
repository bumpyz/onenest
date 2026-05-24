import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholds } from '@/hooks/use-households';
import { usePushTokenRegistration } from '@/hooks/use-push-token-registration';
import { useAuth } from '@/providers/auth-provider';

// Single source of truth for the brand tint that highlights the active tab. Matches the
// slate-blue accent used everywhere else (buttons, picker selection, etc.). Keeping it
// inline rather than reaching into Colors here because the tab bar tint reads cleanest
// as a hex literal and never varies by theme.
const ACTIVE_TAB_COLOR = '#6F7FA5';

export default function AppLayout() {
    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();

    // Register an Expo push token (on native builds) so the sunday-summary edge function
    // has somewhere to deliver. Silent no-op on web / simulators.
    usePushTokenRegistration();

    if (authLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    if (householdsLoading) return <LoadingScreen />;
    if (!households || households.length === 0) {
        return <Redirect href="/create-household" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: ACTIVE_TAB_COLOR,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: 'Calendar',
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="calendar" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="lists"
                options={{
                    title: 'Lists',
                    // check-square reads as "checklist" without needing to fall back to
                    // FontAwesome — Feather's icon set is enough to keep this consistent
                    // with the other tabs.
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="check-square" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="settings" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
