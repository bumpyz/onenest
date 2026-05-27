// QuickCreateSheet — Phase 12 design (screens-extra-5.jsx QuickCreateSheet
// at line 447). Replaces the existing FabMenuItem-based menu on Home: a
// bottom-sheet modal with an AI parse-paste scaffold (deferred #303), a
// 2x2 grid of primary kinds (Event / Task / List / Contact), and a slim-row
// section for less-common actions (Custody override, Reminder).
//
// Why a separate component rather than baking into Home:
//   • Modal is a screen-level overlay; co-locating with Home crowded the
//     ~640-line index.tsx with another ~250 lines of sheet UI + handlers.
//   • Other screens may want to invoke it later (e.g. a "+ New" item from
//     a long-press on the tab bar) — this keeps it portable.

import { format } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { CHILDREN_PALETTE, PARENT_PALETTE } from '@/lib/colors';
import { SHEET_SHADOW, blurActiveElement } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export function QuickCreateSheet({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();

    // Blur the FAB that opened the sheet so the soon-to-be-aria-hidden
    // page behind doesn't retain DOM focus (Chromium aria-hidden warning).
    useEffect(() => {
        if (open) blurActiveElement();
    }, [open]);

    // Navigate to a route + dismiss the sheet. Using router.push (not
    // replace) so the user can back out of the destination back to Home
    // with the FAB still in scope.
    const go = (
        href:
            | '/event/new'
            | '/task/new'
            | '/list/new'
            | '/contact/new'
            | `/custody/${string}`,
    ) => {
        onClose();
        router.push(href);
    };

    const showComingSoon = (title: string, msg: string) => {
        onClose();
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
        } else {
            Alert.alert(title, msg);
        }
    };

    // Use canonical member / accent / category colors per the design's
    // visual rhythm — primary kinds get tinted-corner cards differentiated
    // by hue so the grid reads as four distinct affordances at a glance.
    // Pulling from PARENT_PALETTE and CHILDREN_PALETTE keeps the colors
    // consistent with the rest of the app.
    const eventColor = PARENT_PALETTE[0]; // slate blue
    const taskColor = colors.accent; // theme accent
    const listColor = CHILDREN_PALETTE[2]; // soft heather (used for list chips elsewhere)
    const contactColor = PARENT_PALETTE[1]; // warm terracotta
    const custodyColor = PARENT_PALETTE[3]; // forest
    const reminderColor = PARENT_PALETTE[5]; // sky blue

    return (
        <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent>
            <View style={styles.modalRoot}>
                <Pressable
                    onPress={onClose}
                    accessibilityLabel="Dismiss"
                    style={[
                        styles.backdrop,
                        { backgroundColor: 'rgba(0,0,0,0.42)' },
                    ]}
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.background,
                            // Inset-aware home-indicator padding (audit
                            // #330 HIGH #2). The static 30px paddingBottom
                            // clipped iOS's gesture bar at 402×874; falls
                            // back to 16px when no inset is reported.
                            paddingBottom: 16 + insets.bottom,
                        },
                    ]}>
                    {/* Drag handle */}
                    <View style={styles.dragHandleWrap}>
                        <View
                            style={[
                                styles.dragHandle,
                                { backgroundColor: colors.inkFaint + '88' },
                            ]}
                        />
                    </View>

                    <ScrollView
                        style={{ flexGrow: 0 }}
                        contentContainerStyle={styles.scroll}
                        showsVerticalScrollIndicator={false}>
                        {/* AI parse-paste scaffold. Tapping opens a "coming
                            soon" — wires to #303 (LLM integration) when
                            that lands. The accent-bordered card mirrors
                            the design's "fast path" affordance. */}
                        <View style={styles.sectionWrap}>
                            <Pressable
                                onPress={() =>
                                    showComingSoon(
                                        'Paste anything',
                                        "OneNest will parse pasted text into events, tasks, or reminders. We're building this — for now, pick a kind below.",
                                    )
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Paste anything (coming soon)"
                                style={({ pressed }) => [
                                    styles.parsePasteCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.accent,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <View
                                    style={[
                                        styles.parsePasteIconTile,
                                        { backgroundColor: colors.accent + '22' },
                                    ]}>
                                    <Feather name="zap" size={16} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <ThemedText
                                        style={[
                                            styles.parsePasteTitle,
                                            { color: colors.text },
                                        ]}>
                                        Paste anything
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.parsePasteSub,
                                            {
                                                color: colors.inkSec,
                                                fontFamily: FontFamily.monoMedium,
                                            },
                                        ]}
                                        numberOfLines={1}>
                                        &ldquo;dentist jin tue 9am&rdquo; · &ldquo;buy
                                        paper towels&rdquo;
                                    </ThemedText>
                                </View>
                                <View
                                    style={[
                                        styles.parsePasteBadge,
                                        { backgroundColor: colors.accent + '22' },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.parsePasteBadgeText,
                                            {
                                                color: colors.accent,
                                                fontFamily: FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        SOON
                                    </ThemedText>
                                </View>
                            </Pressable>
                        </View>

                        {/* Divider — "OR PICK A KIND" */}
                        <View style={styles.dividerRow}>
                            <View
                                style={[styles.dividerLine, { backgroundColor: colors.hair }]}
                            />
                            <ThemedText
                                style={[
                                    styles.dividerLabel,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                OR PICK A KIND
                            </ThemedText>
                            <View
                                style={[styles.dividerLine, { backgroundColor: colors.hair }]}
                            />
                        </View>

                        {/* 2x2 grid */}
                        <View style={styles.gridWrap}>
                            <View style={styles.gridRow}>
                                <QCOption
                                    title="Event"
                                    sub="Calendar entry · time, who, where"
                                    color={eventColor}
                                    icon="calendar"
                                    onPress={() => go('/event/new')}
                                    colors={colors}
                                />
                                <QCOption
                                    title="Task"
                                    sub="To-do item · assign, due"
                                    color={taskColor}
                                    icon="check-square"
                                    onPress={() => go('/task/new')}
                                    colors={colors}
                                />
                            </View>
                            <View style={styles.gridRow}>
                                <QCOption
                                    title="List"
                                    sub="New task list · color + sharing"
                                    color={listColor}
                                    icon="list"
                                    onPress={() => go('/list/new')}
                                    colors={colors}
                                />
                                <QCOption
                                    title="Contact"
                                    sub="Doctor, coach, teacher…"
                                    color={contactColor}
                                    icon="book"
                                    onPress={() => go('/contact/new')}
                                    colors={colors}
                                />
                            </View>
                        </View>

                        {/* Less-common slim rows */}
                        <View style={styles.sectionWrap}>
                            <View
                                style={[
                                    styles.slimCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <QCSlimRow
                                    title="Custody override"
                                    sub="One-time swap for a date"
                                    icon="repeat"
                                    iconColor={custodyColor}
                                    onPress={() => {
                                        // Open today's custody-date modal; user can
                                        // then change date from there. Better than
                                        // forcing a date picker before getting to
                                        // the override editor.
                                        const today = format(new Date(), 'yyyy-MM-dd');
                                        go(`/custody/${today}`);
                                    }}
                                    colors={colors}
                                />
                                <QCSlimRow
                                    title="Reminder"
                                    sub="Standalone notification, no event"
                                    icon="bell"
                                    iconColor={reminderColor}
                                    onPress={() =>
                                        showComingSoon(
                                            'Standalone reminders',
                                            "Standalone reminders aren't available yet — for now, add a task with a due date for similar behavior.",
                                        )
                                    }
                                    colors={colors}
                                    last
                                />
                            </View>
                        </View>

                        {/* Cancel */}
                        <View style={styles.sectionWrap}>
                            <Pressable
                                onPress={onClose}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel"
                                style={({ pressed }) => [
                                    styles.cancelCard,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[styles.cancelText, { color: colors.inkSec }]}>
                                    Cancel
                                </ThemedText>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function QCOption({
    title,
    sub,
    color,
    icon,
    onPress,
    colors,
}: {
    title: string;
    sub: string;
    color: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={({ pressed }) => [
                styles.qcOption,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                },
                pressed && styles.pressed,
            ]}>
            {/* Tinted corner accent — pinned top-right, slightly clipped
                by overflow: hidden on the parent. Reads as "this card has
                an identity color" without dominating. */}
            <View
                style={[
                    styles.qcOptionCorner,
                    { backgroundColor: color + '18' },
                ]}
            />
            <View style={{ position: 'relative' }}>
                <View
                    style={[
                        styles.qcOptionIconTile,
                        { backgroundColor: color + '22' },
                    ]}>
                    <Feather name={icon} size={18} color={color} />
                </View>
                <ThemedText style={[styles.qcOptionTitle, { color: colors.text }]}>
                    {title}
                </ThemedText>
                <ThemedText
                    style={[styles.qcOptionSub, { color: colors.textSecondary }]}
                    numberOfLines={2}>
                    {sub}
                </ThemedText>
            </View>
        </Pressable>
    );
}

function QCSlimRow({
    title,
    sub,
    icon,
    iconColor,
    onPress,
    last,
    colors,
}: {
    title: string;
    sub: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    iconColor: string;
    onPress: () => void;
    last?: boolean;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={({ pressed }) => [
                styles.qcSlimRow,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            <View
                style={[
                    styles.qcSlimIcon,
                    { backgroundColor: colors.backgroundInset },
                ]}>
                <Feather name={icon} size={16} color={iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText
                    style={[styles.qcSlimTitle, { color: colors.text }]}>
                    {title}
                </ThemedText>
                <ThemedText
                    style={[styles.qcSlimSub, { color: colors.textSecondary }]}
                    numberOfLines={1}>
                    {sub}
                </ThemedText>
            </View>
            <Feather name="chevron-right" size={14} color={colors.inkFaint} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        // paddingBottom is set inline via `insets.bottom` so the iOS
        // home-indicator inset is honored on real devices (audit #330
        // HIGH #2).
        // Sheet height is content-driven; max so it never covers the home
        // header (the dim-Home preview in the design hints at this — most
        // of the time the sheet sits around 60% of screen height).
        maxHeight: '85%',
        ...SHEET_SHADOW,
    },

    dragHandleWrap: {
        paddingTop: 8,
        paddingBottom: 14,
        alignItems: 'center',
    },
    dragHandle: { width: 36, height: 4, borderRadius: 2 },

    scroll: { paddingBottom: 8 },

    sectionWrap: { paddingHorizontal: 16, paddingBottom: 14 },

    // ── Parse-paste card
    parsePasteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 13,
        borderRadius: 12,
        borderWidth: 1,
    },
    parsePasteIconTile: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    parsePasteTitle: {
        fontSize: 12.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    parsePasteSub: {
        fontSize: 11,
        letterSpacing: -0.2,
        marginTop: 1,
    },
    parsePasteBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
    },
    parsePasteBadgeText: {
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // ── Divider
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 24,
        paddingBottom: 12,
    },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerLabel: {
        fontSize: 9.5,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // ── Grid
    gridWrap: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
    gridRow: { flexDirection: 'row', gap: 8 },
    qcOption: {
        flex: 1,
        padding: 14,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 110,
    },
    qcOptionCorner: {
        position: 'absolute',
        top: -16,
        right: -16,
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    qcOptionIconTile: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    qcOptionTitle: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    qcOptionSub: {
        fontSize: 11,
        lineHeight: 15,
        marginTop: 2,
    },

    // ── Slim card + rows
    slimCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    qcSlimRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: Spacing.three,
    },
    qcSlimIcon: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qcSlimTitle: {
        fontSize: 13.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    qcSlimSub: { fontSize: 11, marginTop: 1 },

    // ── Cancel
    cancelCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
    },
    cancelText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },

    pressed: { opacity: 0.7 },
});
