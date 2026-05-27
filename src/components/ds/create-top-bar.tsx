// CreateTopBar — sticky chrome for every creation flow (Event / Task /
// List / Contact / AddChild / NewOverride).
//
// Design source: `screens-creation.jsx::CreateTopBar` + spec
// "1 · Sticky top bar" in
// docs/design-handoffs/onenest-spec-v1/design_handoff_creation_flows/README.md.
//
// Layout: Cancel (left, 14/500/inkSec) · centered title (14/600/-0.2) ·
// Save pill (right, 12.5/600 padded). Hairline bottom. Save pill flips
// between accent + onAccent (enabled) and inset + inkMuted with a
// hairline border (disabled).
//
// No bottom save bar exists for creates — the only exception is
// NewOverride, which adds a sticky summary bar separately. Every other
// creation surface commits via this top-bar Save pill.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    title: string;
    saveLabel?: string;
    saveDisabled?: boolean;
    /** Optional override for the cancel label. Defaults to "Cancel". */
    cancelLabel?: string;
    onCancel: () => void;
    onSave: () => void;
};

export function CreateTopBar({
    title,
    saveLabel = 'Save',
    saveDisabled = false,
    cancelLabel = 'Cancel',
    onCancel,
    onSave,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.bar,
                {
                    backgroundColor: colors.background,
                    borderBottomColor: colors.hair,
                },
            ]}>
            <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                hitSlop={8}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText
                    style={[
                        styles.cancel,
                        { color: colors.inkSec },
                    ]}>
                    {cancelLabel}
                </ThemedText>
            </Pressable>
            <ThemedText
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}>
                {title}
            </ThemedText>
            <Pressable
                onPress={onSave}
                disabled={saveDisabled}
                accessibilityRole="button"
                accessibilityLabel={saveLabel}
                accessibilityState={{ disabled: saveDisabled }}
                hitSlop={8}
                style={({ pressed }) => [
                    styles.savePill,
                    saveDisabled
                        ? {
                              backgroundColor: colors.backgroundInset,
                              borderColor: colors.hair,
                              borderWidth: StyleSheet.hairlineWidth,
                          }
                        : { backgroundColor: colors.accent },
                    pressed && !saveDisabled && styles.pressed,
                ]}>
                <ThemedText
                    style={[
                        styles.saveText,
                        {
                            color: saveDisabled
                                ? colors.inkFaint
                                : colors.onAccent,
                        },
                    ]}>
                    {saveLabel}
                </ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    cancel: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    savePill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 26,
    },
    saveText: {
        fontSize: 12.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
