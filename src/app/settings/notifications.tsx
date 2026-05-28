// /settings/notifications — per-kind notification toggles (#420, R3).
//
// One toggle row per notification kind. Default-on (absent row in
// notification_preferences = enabled). Toggling off writes a row
// with enabled=false; toggling back on deletes the row. The cron
// edge functions JOIN this table before sending pushes — disabled
// kinds get skipped.
//
// Wires to the Notifications SGroup nav row in main /settings.

import { Feather } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormSwitch, SGroup, SRow } from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import {
    listMyNotificationPreferences,
    setNotificationPreference,
    type NotificationKind,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type ToggleRow = {
    kind: NotificationKind;
    label: string;
    sublabel: string;
};

// Kinds the user can toggle. Ordered by user-perceived value
// (reminders > swaps > digest > meta). 'conflict' and 'invite' are
// always on — they're operational signals that would create UX
// dead-ends if muted (a conflict the user doesn't know about can't
// be resolved).
const TOGGLES: ToggleRow[] = [
    {
        kind: 'event_reminder',
        label: 'Event reminders',
        sublabel: 'Pre-event push notifications you set on each event.',
    },
    {
        kind: 'task_reminder',
        label: 'Task reminders',
        sublabel: 'Pre-due push reminders on tasks with reminders set.',
    },
    {
        kind: 'swap_request',
        label: 'Swap requests',
        sublabel: 'When a co-parent asks to swap a custody day.',
    },
    {
        kind: 'swap_decision',
        label: 'Swap decisions',
        sublabel: 'When a co-parent accepts or declines your swap.',
    },
    {
        kind: 'task_complete',
        label: 'Task completions',
        sublabel: "When someone in your household checks off a task you cared about.",
    },
    {
        kind: 'mention',
        label: 'Mentions',
        sublabel: 'When you\'re tagged in a task or note.',
    },
    {
        kind: 'digest',
        label: 'Sunday digest',
        sublabel: 'Weekly summary of the week ahead, every Sunday night.',
    },
];

export default function NotificationsSettingsScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();

    // Map kind → enabled. Absent = true (default-on).
    const [enabledMap, setEnabledMap] = useState<Map<string, boolean>>(
        new Map(),
    );
    const [loaded, setLoaded] = useState(false);
    const [savingKind, setSavingKind] = useState<NotificationKind | null>(null);

    const fetchPrefs = useCallback(async () => {
        try {
            const rows = await listMyNotificationPreferences();
            const map = new Map<string, boolean>();
            for (const r of rows) map.set(r.kind, r.enabled);
            setEnabledMap(map);
            setLoaded(true);
        } catch {
            setEnabledMap(new Map());
            setLoaded(true);
        }
    }, []);
    useEffect(() => {
        void fetchPrefs();
    }, [fetchPrefs]);
    useFocusEffect(
        useCallback(() => {
            void fetchPrefs();
        }, [fetchPrefs]),
    );

    if (authLoading || !loaded) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;

    const isEnabled = (kind: NotificationKind): boolean => {
        // Absent → default-on.
        if (!enabledMap.has(kind)) return true;
        return enabledMap.get(kind) ?? true;
    };

    const onToggle = async (kind: NotificationKind, next: boolean) => {
        setSavingKind(kind);
        // Optimistic local update so the switch responds instantly.
        setEnabledMap((prev) => {
            const m = new Map(prev);
            if (next) m.delete(kind);
            else m.set(kind, false);
            return m;
        });
        try {
            await setNotificationPreference(kind, next);
        } catch {
            // Roll back on failure.
            setEnabledMap((prev) => {
                const m = new Map(prev);
                if (next) m.set(kind, false);
                else m.delete(kind);
                return m;
            });
        } finally {
            setSavingKind(null);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View
                    style={[
                        styles.topBar,
                        { borderBottomColor: colors.hair },
                    ]}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.topBarIconBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather
                            name="chevron-left"
                            size={14}
                            color={colors.text}
                        />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.topBarTitle,
                            { color: colors.text },
                        ]}>
                        Notifications
                    </ThemedText>
                    <View style={styles.topBarIconBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    <ThemedText
                        type="small"
                        style={{
                            color: colors.textSecondary,
                            lineHeight: 19,
                            marginBottom: Spacing.three,
                        }}>
                        Mute specific kinds of pushes + Inbox rows. Conflict
                        warnings and invites are always on — they can&apos;t be
                        actioned if you don&apos;t see them.
                    </ThemedText>

                    <SGroup label="Push + Inbox">
                        {TOGGLES.map((t, idx) => (
                            <SRow
                                key={t.kind}
                                label={t.label}
                                right={
                                    <FormSwitch
                                        value={isEnabled(t.kind)}
                                        onValueChange={(next) =>
                                            onToggle(t.kind, next)
                                        }
                                        disabled={savingKind === t.kind}
                                    />
                                }
                                last={idx === TOGGLES.length - 1}
                            />
                        ))}
                    </SGroup>

                    {/* Sublabel block — design's SRow doesn't carry
                        descriptive copy, so we render the per-kind
                        explanation as a separate mono-spaced block
                        beneath the toggles. Reads like a glossary. */}
                    <View
                        style={[
                            styles.glossary,
                            { borderColor: colors.hair },
                        ]}>
                        {TOGGLES.map((t) => (
                            <View key={t.kind} style={styles.glossaryRow}>
                                <ThemedText
                                    style={[
                                        styles.glossaryTitle,
                                        {
                                            color: colors.inkSec,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    {t.label.toUpperCase()}
                                </ThemedText>
                                <ThemedText
                                    type="small"
                                    style={{
                                        color: colors.textSecondary,
                                        lineHeight: 18,
                                    }}>
                                    {t.sublabel}
                                </ThemedText>
                            </View>
                        ))}
                    </View>

                    <ThemedText
                        style={[
                            styles.footer,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        DEVICE PUSH PERMISSIONS ARE SEPARATE · iOS / ANDROID
                        SETTINGS
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    pressed: { opacity: 0.7 },

    scroll: {
        padding: Spacing.three,
        paddingBottom: Spacing.four,
    },

    glossary: {
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 14,
    },
    glossaryRow: {
        gap: 3,
    },
    glossaryTitle: {
        fontSize: 10,
        letterSpacing: 0.4,
    },

    footer: {
        marginTop: 24,
        fontSize: 10,
        letterSpacing: 0.3,
        textAlign: 'center',
    },
});
