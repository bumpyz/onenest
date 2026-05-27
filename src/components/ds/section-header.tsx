// SectionHeader — uppercase tracked mono label used above grouped content.
// Renders as caps + monospace + 0.4 letter-spacing per the redesign spec.
// This is the "OVERDUE" / "TODAY" / "THIS WEEK" / "PEOPLE · 4" pattern that
// appears above every grouped list across the new design (Lists, Family Hub,
// Settings, Notifications, etc.).
//
// Two variants: plain ("OVERDUE") and with-trailing-count ("OVERDUE  3") where
// the count sits on the right and is also mono. The count slot also accepts
// arbitrary right-aligned content for "+ INVITE" style affordances.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    label: string;
    /** Trailing mono number on the right ("3" overdue, "4" people). Pass a string
     *  so callers can format with units if needed ("· 4"). */
    count?: string | number;
    /** Arbitrary right-aligned slot, mutually exclusive with `count`. Pass a
     *  Pressable here for "+ INVITE" / "VIEW →" style affordances. */
    rightSlot?: ReactNode;
};

export function SectionHeader({ label, count, rightSlot }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={styles.row}>
            <ThemedText
                style={[
                    Typography.sectionHeader,
                    { color: colors.textSecondary },
                ]}>
                {label}
            </ThemedText>
            {rightSlot ?? (count != null ? (
                <ThemedText
                    style={[
                        styles.count,
                        {
                            color: colors.textSecondary,
                            // Mono Medium for the count — the section label uses
                            // SemiBold for primary emphasis, the count sits in
                            // the lighter weight as supporting meta.
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {count}
                </ThemedText>
            ) : null)}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.one,
        paddingBottom: Spacing.two,
    },
    count: {
        fontSize: 11,
        letterSpacing: 0.2,
    },
});
