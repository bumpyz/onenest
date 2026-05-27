// Chip — pill-shaped tappable used for filters and toggles. This is the
// `CChip` from the handoff: rounded-full pill with optional leading color
// dot, optional active state (filled in accent), and small footprint.
//
// Used in: Lists filter strip (All · 12 / House / Kids / Errands), Calendar
// child filter (Everyone / Mei / Jin / Soph / Oliver), Quick-create kind
// picker, Notifications inbox filters.
//
// The active state fills the chip in accent and flips text to onAccent. The
// dot stays the member/child color even when active.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    label: string;
    /** Filled-in-accent state. */
    active?: boolean;
    /** Optional leading 8px color dot — typically a member/child color. */
    dot?: string;
    /** Trailing element — used for the cross-list "× remove" affordance and
     *  count suffixes. */
    trailing?: ReactNode;
    onPress?: () => void;
    disabled?: boolean;
};

export function Chip({ label, active = false, dot, trailing, onPress, disabled }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || !onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityState={{ selected: active, disabled }}
            style={({ pressed }) => [
                styles.pill,
                {
                    backgroundColor: active ? colors.accent : colors.backgroundInset,
                    borderColor: active ? colors.accent : colors.hair,
                },
                pressed && !disabled && styles.pressed,
            ]}>
            {dot ? (
                <View style={[styles.dot, { backgroundColor: dot }]} />
            ) : null}
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: active ? colors.onAccent : colors.text,
                    },
                ]}>
                {label}
            </ThemedText>
            {trailing}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    label: {
        fontSize: 12.5,
        fontWeight: '500',
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
