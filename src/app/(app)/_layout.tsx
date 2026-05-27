import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useHouseholds } from '@/hooks/use-households';
import { usePushTokenRegistration } from '@/hooks/use-push-token-registration';
import { useAppColorScheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';

// Bottom nav — custom renderer.
//
// react-navigation's built-in BottomTabBar fought every layout override I
// tried: setting `height` clipped descenders, removing it produced wildly
// different sizes across viewports, and labelStyle.lineHeight wasn't
// enough to keep glyphs uncropped. Custom render lets me lay out icon +
// label myself — every pixel of padding, gap, and label box dimensions
// is explicit, no internal react-navigation defaults to fight.
//
// Visual spec from design (CBottomNav in `direction-c-pro.jsx`):
//   • Bar: nominal height 80; design padding '10px 16px 28px' + 0.5px
//     hair border. Real rendered height at 402×874 is ~97px native (the
//     home-indicator safe-area inset adds to the bottom pad) and ~63px
//     web (no safe-area inset). Anything that reserves FAB / scroll
//     clearance should reference the actual rendered height, not the
//     nominal 80 (audit #330 LOW #1).
//   • Items: column, alignItems center, gap 3 between icon and label
//   • Icon: 20×20, ink active / inkFaint inactive
//   • Label: fontSize 9.5 (we use 10 — RN-Web text metrics differ),
//     fontWeight 600, sans, letterSpacing -0.1
//   • No accent in the bar — accent is reserved for FAB / today / chips.

type TabRoute = {
    key: string;
    name: string;
    label: string;
    icon: ComponentProps<typeof Feather>['name'];
};

// Phase 6.7 — 5-tab model per the updated handoff
// (design-handoffs/settings-subroutes-v2/README.md — "Change 1 · Bottom tab bar").
// Contacts gets promoted back to a top-level tab after Phase 6.1 buried it
// under Family Hub Manage made it too hard to reach. New order:
// Today / Calendar / Lists / Contacts / Family. Settings stays hidden (still
// reached from Family → Manage → Settings).
//
// Icon choice for Contacts: `book` is the closest Feather glyph to the
// address-book card the design spec shows (paths in README's "Change 1").
// Tried `users` (collides with Family) and `user` (too thin); `book` reads
// as "list of people" alongside the calendar/check-square neighbors.
const TAB_DEFS: Record<string, { label: string; icon: ComponentProps<typeof Feather>['name'] }> = {
    index: { label: 'Today', icon: 'home' },
    calendar: { label: 'Calendar', icon: 'calendar' },
    lists: { label: 'Lists', icon: 'check-square' },
    contacts: { label: 'Contacts', icon: 'book' },
    family: { label: 'Family', icon: 'users' },
};

// Tab bar receives the full BottomTabBarProps from @react-navigation/bottom-tabs.
// That package isn't a direct dep (pulled transitively via expo-router), so
// rather than installing it just for the types we accept the props loosely.
// We only touch state.routes / state.index / navigation.emit / navigation.navigate,
// all of which are stable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTabBar({ state, navigation }: any) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();

    // Visible tabs in order. Filter the route list against TAB_DEFS so any
    // hidden / dev-only routes don't render a tab cell.
    const tabs: TabRoute[] = (state.routes as Array<{ key: string; name: string }>)
        .map((r) => {
            const def = TAB_DEFS[r.name];
            return def ? { key: r.key, name: r.name, ...def } : null;
        })
        .filter((t): t is TabRoute => t !== null);

    return (
        <View
            style={[
                styles.bar,
                {
                    backgroundColor: colors.background,
                    borderTopColor: colors.hair,
                    // Safe-area bottom inset on native iOS (home indicator).
                    // On web RN's useSafeAreaInsets returns 0; the explicit
                    // BAR_BOTTOM_PAD below ensures we always have breathing
                    // room above the label regardless.
                    paddingBottom: BAR_BOTTOM_PAD + insets.bottom,
                },
            ]}>
            {tabs.map((tab, i) => {
                const isActive = state.index === i;
                const tintColor = isActive ? colors.text : colors.inkFaint;
                return (
                    <Pressable
                        key={tab.key}
                        onPress={() => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: tab.key,
                                canPreventDefault: true,
                            });
                            if (!isActive && !event.defaultPrevented) {
                                navigation.navigate(tab.name as never);
                            }
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={tab.label}
                        style={styles.tab}>
                        <Feather name={tab.icon} size={20} color={tintColor} />
                        <ThemedText
                            numberOfLines={1}
                            style={[
                                styles.label,
                                { color: tintColor },
                            ]}>
                            {tab.label}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </View>
    );
}

// Layout constants — every pixel is explicit so there's no react-navigation
// internal default to wrestle. Aim for the design's 80px target visually:
// 10 top + 20 icon + 3 gap + ~16 label box + 14 bottom = ~63 + safe-area inset.
// On a real iPhone with ~34px home indicator inset, that's ~97px total. On
// web (no inset), ~63px. Both feel right for the design's intent.
const BAR_TOP_PAD = 10;
const BAR_BOTTOM_PAD = 14;
const ICON_LABEL_GAP = 3;
const LABEL_FONT_SIZE = 10;
const LABEL_LINE_HEIGHT = 16;

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
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <CustomTabBar {...props} />}>
            <Tabs.Screen name="index" options={{ title: 'Today' }} />
            <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
            <Tabs.Screen name="lists" options={{ title: 'Lists' }} />
            <Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />
            <Tabs.Screen name="family" options={{ title: 'Family' }} />
            {/* Phase 6.7: Contacts promoted back to a top-level tab (above);
                Settings stays hidden — reached from Family → Manage → Settings.
                `href: null` keeps `router.push('/settings')` working without
                rendering a tab cell. */}
            <Tabs.Screen name="settings" options={{ title: 'Settings', href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        // alignItems: 'flex-start' matches the design's `alignItems: 'flex-start'`
        // — items hug the top of the bar; the asymmetric 10/14 padding plus safe-
        // area gives all the bottom breathing room.
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        paddingTop: BAR_TOP_PAD,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    tab: {
        alignItems: 'center',
        gap: ICON_LABEL_GAP,
        // No minWidth — flex sibling 'space-around' spaces them evenly.
        // Vertical padding 0 — the bar's top padding + the tab content
        // height define total bar height.
    },
    label: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: LABEL_FONT_SIZE,
        letterSpacing: -0.1,
        // Explicit lineHeight = full label-box height. Containing the box
        // (rather than letting RN-Web's auto leading add invisible space)
        // is the only way to guarantee no descender clipping. 16px is
        // generous — fits 'y', 'g', 'p' at fontSize 10 with cushion.
        lineHeight: LABEL_LINE_HEIGHT,
        // Force textAlign center so multi-word labels (unlikely here, all
        // single-word) center under the icon if they ever wrap.
        textAlign: 'center',
    },
});
