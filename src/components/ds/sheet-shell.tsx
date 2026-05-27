// SheetShell — the canonical bottom-sheet primitive for the TaskDetail v2
// design (screens-task-edit.jsx ~46-117). Replaces the prior ActionSheet
// with a richer shell: title row (title + sub + close X), scrollable
// content, and an optional footer with dynamic save labels.
//
// Used by every TaskDetail field-edit sheet (Due, Reminder, Assign,
// Priority, Recurring, Lists, Children) and the TaskOverflowSheet. Future
// detail screens (event, child, hand-off) consume the same primitive so
// the modal surface vocabulary stays consistent.
//
// Footer chip shape — design uses dual chips: a fixed-width secondary on
// the left (Cancel / Clear / Unassign) and an accent primary on the right
// (Save · Tonight 21:00). The primary chip's label is dynamic — callers
// pass the full string so users can see what they're committing to.
//
// Animation: native Modal `animationType="slide"` already gives us the
// bottom-anchored slide-in. The 280ms cubic-bezier called out in the
// README is iOS-native at present; if we ever switch to a Reanimated-based
// sheet we can match the curve exactly.

import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
    type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { SHEET_SHADOW, blurActiveElement } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export function SheetShell({
    open,
    onClose,
    title,
    sub,
    children,
    primary,
    secondary,
    onPrimary,
    onSecondary,
    /** Sheet body height in px. Design spec uses 460/500/540/560/580 per
     *  sheet kind. */
    height = 460,
    /** Disable the primary action — usually because the value matches the
     *  initial state (no-op save). The button stays visible but greyed out
     *  so users see what would happen if they made a change. */
    primaryDisabled = false,
}: {
    open: boolean;
    onClose: () => void;
    /** Caps-style label rendered in the title row's bold slot. */
    title: string;
    /** Optional sub-text below the title — context for what the sheet does. */
    sub?: string;
    children: React.ReactNode;
    /** Right-side accent primary chip label. Pass the full dynamic string —
     *  "Save · Tonight 21:00", "Save · 2 selected", etc. Omit to hide. */
    primary?: string;
    /** Left-side secondary chip label — Cancel / Clear / Unassign. Omit
     *  if there's no destructive escape from the sheet. */
    secondary?: string;
    /** Fired when the primary chip is tapped. Caller is responsible for
     *  closing the sheet after a successful save. */
    onPrimary?: () => void;
    /** Fired when the secondary chip is tapped. Caller decides whether
     *  this also closes the sheet (Clear may stay open to let the user
     *  pick a new value; Cancel typically closes). */
    onSecondary?: () => void;
    height?: number;
    primaryDisabled?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Blur whatever was focused before the sheet opens — same Chromium
    // aria-hidden warning workaround the FAB sheet uses.
    useEffect(() => {
        if (open) blurActiveElement();
    }, [open]);

    // Web-only: bind Escape-to-close. RN-Web's <Modal onRequestClose>
    // handles Android hardware back but doesn't reliably fire on browser
    // Escape across all Expo versions — the console-noise triage agent
    // surfaced Escape as a real reliability gap. Belt-and-braces: bind a
    // window keydown listener while the sheet is open and unbind on
    // close. Native platforms keep the `onRequestClose` path.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!open) return;
        if (typeof window === 'undefined') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        // Capture phase so we beat any nested handler that might
        // preventDefault on Escape.
        window.addEventListener('keydown', onKey, true);
        return () =>
            window.removeEventListener('keydown', onKey, true);
    }, [open, onClose]);

    const sheetStyle: ViewStyle = {
        ...styles.sheet,
        backgroundColor: colors.backgroundElement,
        borderTopColor: colors.hair,
        height,
    };

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
                <View style={sheetStyle}>
                    {/* Drag handle — 36x4 decorative anchor for the
                        gesture affordance. iOS standard. */}
                    <View style={styles.dragHandleWrap}>
                        <View
                            style={[
                                styles.dragHandle,
                                { backgroundColor: colors.inkFaint },
                            ]}
                        />
                    </View>

                    {/* Title row — title + sub on the left, 28x28 round
                        close X on the right. Border-bottom hairline
                        separates the row from the content. */}
                    <View
                        style={[
                            styles.titleRow,
                            { borderBottomColor: colors.hair },
                        ]}>
                        <View style={styles.titleBody}>
                            <ThemedText
                                style={[
                                    styles.title,
                                    { color: colors.text },
                                ]}
                                numberOfLines={1}>
                                {title}
                            </ThemedText>
                            {sub ? (
                                <ThemedText
                                    style={[
                                        styles.sub,
                                        { color: colors.inkFaint },
                                    ]}
                                    numberOfLines={2}>
                                    {sub}
                                </ThemedText>
                            ) : null}
                        </View>
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            style={({ pressed }) => [
                                styles.closeBtn,
                                {
                                    backgroundColor: colors.backgroundInset,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather name="x" size={12} color={colors.inkSec} />
                        </Pressable>
                    </View>

                    {/* Content — sheet body owns its own per-section
                        padding; we just constrain the scroll area. */}
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentInner}
                        keyboardShouldPersistTaps="handled">
                        {children}
                    </ScrollView>

                    {/* Footer — dual chip row when either label is set. */}
                    {primary || secondary ? (
                        <View
                            style={[
                                styles.footer,
                                { borderTopColor: colors.hair },
                            ]}>
                            {secondary ? (
                                <Pressable
                                    onPress={onSecondary}
                                    accessibilityRole="button"
                                    accessibilityLabel={secondary}
                                    style={({ pressed }) => [
                                        styles.secondaryBtn,
                                        {
                                            backgroundColor:
                                                colors.backgroundInset,
                                            borderColor: colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.secondaryBtnText,
                                            { color: colors.text },
                                        ]}>
                                        {secondary}
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                            {primary ? (
                                <Pressable
                                    onPress={onPrimary}
                                    disabled={primaryDisabled}
                                    accessibilityRole="button"
                                    accessibilityLabel={primary}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        {
                                            backgroundColor: colors.accent,
                                        },
                                        primaryDisabled && { opacity: 0.4 },
                                        pressed &&
                                            !primaryDisabled &&
                                            styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.primaryBtnText,
                                            { color: colors.onAccent },
                                        ]}>
                                        {primary}
                                    </ThemedText>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}
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
        borderTopWidth: StyleSheet.hairlineWidth,
        ...SHEET_SHADOW,
        // height is set per-instance via the height prop.
    },
    dragHandleWrap: {
        paddingTop: 8,
        alignItems: 'center',
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    // Title row — padding `10px 16px 8px`, hairline bottom border.
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    titleBody: { flex: 1, minWidth: 0 },
    title: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    sub: {
        fontSize: 11.5,
        marginTop: 2,
        lineHeight: 16,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    // Content area — flex:1 lets it absorb the remaining sheet height
    // between the title row and the footer.
    content: { flex: 1 },
    contentInner: {
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    // Footer — padding `10px 16px 28px`, hairline top border.
    footer: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 28,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    secondaryBtn: {
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    secondaryBtnText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    primaryBtn: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
