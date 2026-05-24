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

// Tab labels are off on every platform. The icons (home, calendar,
// check-square, settings) read unambiguously on their own — modern mobile
// apps (Instagram, Mail, Apollo, etc.) ship icon-only bottom bars for the
// same reason. As a bonus this dodges the react-navigation/bottom-tabs web
// descender-clipping bug on narrow viewports (DevTools mobile mode, iPhone
// 14 Pro Max width) where the label box clips "g" / "y" pixels regardless
// of line-height overrides. Title strings on each Tabs.Screen below still
// power the screen heading + accessibility labels — only the visible chrome
// at the bottom drops them.
//
// `tabBarShowLabel: false` is a react-navigation/bottom-tabs option; the
// Platform.select shim above is gone now.

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
                tabBarShowLabel: false,
                // Zero the bar's own paddingTop/paddingBottom so the items
                // can center within its full height. Without this, the bar
                // has built-in bottom padding (intended for the home-
                // indicator safe area on iOS, which evaluates to 0 in web/
                // DevTools but the padding rule still applies) that shrinks
                // the available column from the bottom, pulling the
                // justify-centered icon higher than the bar's geometric
                // center.
                tabBarStyle: { paddingTop: 0, paddingBottom: 0 },
                tabBarItemStyle: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingTop: 0,
                    paddingBottom: 0,
                },
                // marginTop: 'auto' + marginBottom: 'auto' is the CSS flexbox
                // trick for centering a single flex child along the main
                // axis — it absorbs any leftover space symmetrically. More
                // reliable than fighting react-navigation's internal label-
                // slot reservation, which keeps the icon top-anchored even
                // when the label is hidden via tabBarShowLabel: false.
                tabBarIconStyle: { marginTop: 'auto', marginBottom: 'auto' },
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
