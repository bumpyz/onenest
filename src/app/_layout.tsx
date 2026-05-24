import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/providers/auth-provider';
import { ThemePreferenceProvider, useAppColorScheme } from '@/providers/theme-provider';

export default function RootLayout() {
    return (
        <ThemePreferenceProvider>
            <ThemedNavigation>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="event/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="custody/[date]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="location/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="location/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="child/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="child/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="list/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="list/[id]" options={{ presentation: 'modal' }} />
                    {/* Standalone task editor + creator. Used by the Lists tab and the
                        Home FAB's "New task" chooser option. Event-linked tasks edit
                        inside their event's form (event/[id]) instead so the event
                        form stays the single source of truth for those. */}
                    <Stack.Screen name="task/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="join" />
                    <Stack.Screen name="oauth/microsoft" />
                    <Stack.Screen name="oauth/google" />
                </Stack>
            </ThemedNavigation>
        </ThemePreferenceProvider>
    );
}

// Reads the resolved scheme from the preference provider and applies it to React Navigation's
// theme (status bar, default backgrounds). Sits inside the preference provider so it can use
// the context.
function ThemedNavigation({ children }: { children: ReactNode }) {
    const scheme = useAppColorScheme();
    return (
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
    );
}
