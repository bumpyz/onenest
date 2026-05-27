import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/providers/auth-provider';
import { ThemePreferenceProvider, useAppColorScheme } from '@/providers/theme-provider';

// Keep the splash screen visible until the font bundle is ready. The redesign
// is hard-locked to Geist + Geist Mono (every numeric / meta label uses the
// mono variant), so rendering a frame before the fonts load would FOUT the
// app for ~200ms in a way that's obviously wrong. We swallow the promise to
// avoid an unhandled rejection if SplashScreen.preventAutoHideAsync runs
// twice (Expo dev reloads can re-execute module side-effects).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
    // Each weight is loaded as its own font family name. RN doesn't pick weights
    // from a single family the way CSS does — you have to address the specific
    // file. The Typography tokens in theme.ts hard-reference these names so
    // styles like `Typography.titleHero` always pull `Geist-SemiBold` directly.
    const [fontsLoaded, fontsError] = useFonts({
        'Geist-Regular': require('../../assets/fonts/Geist-Regular.ttf'),
        'Geist-Medium': require('../../assets/fonts/Geist-Medium.ttf'),
        'Geist-SemiBold': require('../../assets/fonts/Geist-SemiBold.ttf'),
        'Geist-Bold': require('../../assets/fonts/Geist-Bold.ttf'),
        'GeistMono-Regular': require('../../assets/fonts/GeistMono-Regular.ttf'),
        'GeistMono-Medium': require('../../assets/fonts/GeistMono-Medium.ttf'),
        'GeistMono-SemiBold': require('../../assets/fonts/GeistMono-SemiBold.ttf'),
    });

    // Hide the splash once fonts load OR once they error out — better to show
    // the app with system fallback fonts than to hang the splash forever if a
    // font file is missing in dev. The hide is fire-and-forget; a thrown
    // promise here would kill the launch.
    useEffect(() => {
        if (fontsLoaded || fontsError) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [fontsLoaded, fontsError]);

    // Web-only: blur the active element on every pointerup. Pressables on
    // RN-Web retain DOM focus after a tap, and when that tap triggers
    // navigation (or opens a Modal) the leaving screen gets aria-hidden by
    // expo-router / react-native-web. Chromium then logs a noisy
    // "aria-hidden on an element because its descendant retained focus"
    // warning every time. Blurring on pointerup releases the focus before
    // the aria-hidden mutation happens. Keyboard activation (Enter on a
    // focused button) doesn't fire pointerup, so keyboard accessibility is
    // unaffected.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (typeof document === 'undefined') return;
        const onPointerUp = () => {
            const el = document.activeElement;
            if (el && typeof (el as HTMLElement).blur === 'function') {
                // Defer one frame so React's synthetic click handlers still
                // see the element as `event.currentTarget` if they read it.
                // Without this, some web Pressables would see `null` and
                // skip their onPress.
                requestAnimationFrame(() => {
                    (el as HTMLElement).blur();
                });
            }
        };
        document.addEventListener('pointerup', onPointerUp, { capture: true });
        return () => {
            document.removeEventListener('pointerup', onPointerUp, {
                capture: true,
            });
        };
    }, []);

    // Block the first render until we know one way or the other — prevents a
    // brief flash of system-font text before the bundle commits.
    if (!fontsLoaded && !fontsError) return null;

    // GestureHandlerRootView wraps the entire app so react-native-gesture-handler's
    // Swipeable / pan / tap handlers receive native gesture events on iOS + Android.
    // On web it's a no-op pass-through but keeping it at the top means the same tree
    // works across platforms — and the swipe-to-delete on Lists rows below needs
    // the root view present or the gesture never reaches the row.
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemePreferenceProvider>
                <ThemedNavigation>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="event/new" options={{ presentation: 'modal' }} />
                    {/* Event detail (read) at /event/[id]/index + form
                        at /event/[id]/edit. Phase 5 close-out (#409)
                        split the old single-file edit screen into a
                        read view + a separate form, mirroring the
                        Contact detail pattern. Both register as modals
                        (legacy callers route /event/[id] and inherit
                        modal presentation; tapping Edit on the detail
                        pushes /edit on top — modal-on-modal, same as
                        TaskDetail v2 did). */}
                    <Stack.Screen name="event/[id]/index" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="event/[id]/edit" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="custody/[date]" options={{ presentation: 'modal' }} />
                    {/* Custody surfaces v2 — /custody/schedule is the full-
                        screen viewer (replaces the legacy settings card);
                        /custody/pattern is the focused editor reached via
                        the Pattern button in the viewer's top bar. Both
                        push as regular screens (not modals) so users can
                        navigate between them with the back chevron. */}
                    <Stack.Screen name="custody/schedule" />
                    <Stack.Screen name="custody/pattern" />
                    <Stack.Screen name="location/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="location/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="child/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="child/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="contact/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="contact/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="list/new" options={{ presentation: 'modal' }} />
                    {/* /list/[id] split per Lists v2 spec
                        (design_handoff_fab_rule):
                          • /index — read-mode List detail (cards in the
                            "Your lists" row tap into this).
                          • /edit  — the legacy list-form (rename / recolor
                            / delete). Reached via long-press / right-click
                            on a list chip, and via an Edit affordance on
                            the detail screen.
                        Both modal-presented, same as before. */}
                    <Stack.Screen name="list/[id]/index" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="list/[id]/edit" options={{ presentation: 'modal' }} />
                    {/* Standalone task screens. Used by the Lists tab and the
                        Home FAB's "New task" chooser option. Event-linked
                        tasks still edit inside their event's form
                        (event/[id]) so the event form stays the single
                        source of truth for those.
                        Phase 11 split task/[id] into a detail view +
                        nested /edit route mirroring the contact/[id]
                        pattern. The parent screen registers as a modal;
                        the nested /edit child inherits modal presentation
                        automatically (same as contact/[id]/edit). */}
                    <Stack.Screen name="task/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
                    {/* Conflict resolver (v3 spec: every surface that
                        shows a conflict routes here — Event detail's
                        CONFLICT chip, Calendar block bug badge,
                        Notifications inbox row, etc.). Modal-presented
                        so users can dismiss back to the source surface
                        without losing their scroll/state. */}
                    <Stack.Screen name="conflict/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="join" />
                    <Stack.Screen name="oauth/microsoft" />
                    <Stack.Screen name="oauth/google" />
                </Stack>
            </ThemedNavigation>
        </ThemePreferenceProvider>
        </GestureHandlerRootView>
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
