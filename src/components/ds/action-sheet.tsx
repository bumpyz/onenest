// ActionSheet — generic bottom-sheet modal primitive. Used by:
//   • TaskDetail row pickers (Assigned to / Due / Reminder)
//   • TaskDetail kebab action menu (replaces the window.prompt web fallback)
//   • Future detail screens (event / child / hand-off) for the same row-tap
//     editing affordances
//
// Design intent: a translucent backdrop dim + a 20px-radius sheet sliding
// up from the bottom edge, capped at 85% screen height so the user can
// still see the screen above for context. Carries an optional title row
// (caps SANS label) and a drag-handle for tactile affordance — the handle
// is decorative on RN (the Modal's onRequestClose handles back-button /
// escape on web), but the user signal is the right one.
//
// Sheet children own their own padding + scrolling. Keeping the wrapper
// minimal lets pickers compose chip rows, date/time fields, and
// scrollable lists without fighting the sheet's layout.

import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { SHEET_SHADOW, blurActiveElement } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function ActionSheet({
    open,
    onClose,
    title,
    children,
}: {
    /** Controls visibility. Parent owns the state. */
    open: boolean;
    /** Called when the user taps the backdrop, the close button, or the
     *  system back button on Android. The sheet doesn't unmount itself —
     *  the parent handles `open=false`. */
    onClose: () => void;
    /** Optional caps-SANS title rendered in the sheet header. Omit for
     *  sheets that don't need a title row (e.g. plain action menus). */
    title?: string;
    /** Sheet body content. Owns its own padding + scrolling. */
    children: React.ReactNode;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();

    // Blur whatever was focused before the sheet opens — same Chromium
    // aria-hidden warning workaround the FAB sheet uses. Without this,
    // tapping the trigger element keeps it focused while the sheet's
    // Modal applies aria-hidden to the screen behind, and Chrome logs
    // a warning every open.
    useEffect(() => {
        if (open) blurActiveElement();
    }, [open]);

    return (
        <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent>
            <View style={styles.root}>
                <Pressable
                    onPress={onClose}
                    accessibilityLabel="Dismiss"
                    style={styles.backdrop}
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.background,
                            // Inset-aware home-indicator padding — fixes
                            // viewport audit #330 HIGH #2 (static 30px
                            // bottom-pad clipped the iOS gesture bar on
                            // 402×874 devices). Falls back to 16px when
                            // the inset is 0 (web / older devices).
                            paddingBottom: 16 + insets.bottom,
                        },
                    ]}>
                    {/* Drag handle — decorative anchor for the sheet's
                        gesture affordance. Real drag-to-dismiss is a
                        future enhancement; today the tap-backdrop / X
                        button cover dismissal. */}
                    <View style={styles.dragHandleWrap}>
                        <View
                            style={[
                                styles.dragHandle,
                                {
                                    backgroundColor:
                                        colors.inkFaint + '88',
                                },
                            ]}
                        />
                    </View>
                    {/* Header row — title (when provided) on the left,
                        close X on the right. Always renders because the
                        close button is always desired; title-less sheets
                        get a spacer in its slot to keep the X
                        right-aligned. */}
                    <View style={styles.header}>
                        {title ? (
                            <ThemedText
                                style={[
                                    styles.title,
                                    {
                                        color: colors.inkSec,
                                        fontFamily:
                                            FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {title.toUpperCase()}
                            </ThemedText>
                        ) : (
                            <View />
                        )}
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            style={({ pressed }) => [
                                styles.closeBtn,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather
                                name="x"
                                size={14}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>
                    {/* Body — pickers own their padding and scrolling. */}
                    <View style={styles.body}>{children}</View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.42)',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        // paddingBottom is set inline via `insets.bottom` so the iOS
        // home-indicator inset is honored on devices that report a real
        // safe-area value (audit #330 HIGH #2).
        // Cap so the sheet doesn't cover the entire screen — the user
        // should still see the rest of the screen for context.
        maxHeight: '85%',
        ...SHEET_SHADOW,
    },
    dragHandleWrap: {
        paddingTop: 8,
        paddingBottom: 8,
        alignItems: 'center',
    },
    dragHandle: { width: 36, height: 4, borderRadius: 2 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    title: {
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: { paddingHorizontal: 20, paddingTop: 4 },
    pressed: { opacity: 0.7 },
});
