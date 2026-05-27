// DetailRow — label-left / value-right row used inside detail screens'
// read-mode SGroups. Distinct from SRow (which uses a 14/500 sentence-
// case label) — DetailRow uses a mono caps-tier label (11/inkMuted),
// designed for the "field: value" tabular look of detail surfaces.
//
// Design source: `screens-extra.jsx::EDRow` (used inside EventDetail's
// Who / For / Location / Attached list section cards). Mirrors the row
// padding (12/14) and hairline-bottom divider that `last` suppresses.
//
// Optionally tappable — pass `onPress` to wrap the body in a Pressable.
// The inline-edit pattern from TaskDetail v2 (#369) made the detail rows
// tappable as the entry to field-edit sheets (DueDateSheet, AssignSheet,
// etc.). EventDetail multi-responsible uses the same pattern: tapping
// the Responsible row opens EventResponsibleSheet. Without `onPress` the
// row stays static (matches the original read-only contract).

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function DetailRow({
    label,
    right,
    last,
    onPress,
    accessibilityLabel,
}: {
    /** Label rendered on the left. Mono 11/inkMuted per design. */
    label: string;
    /** Right-aligned value — a React node so callers can drop chips,
     *  avatars, etc. without forking the component. */
    right?: React.ReactNode;
    /** True for the last row in its card — suppresses the bottom
     *  hairline so it doesn't double the card's own bottom border. */
    last?: boolean;
    /** When provided, wraps the row in a Pressable. Used by EventDetail's
     *  Responsible row to open EventResponsibleSheet, mirroring the
     *  TaskDetail v2 inline-edit pattern. */
    onPress?: () => void;
    /** Override the a11y label for tappable rows (defaults to `label`). */
    accessibilityLabel?: string;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const body = (
        <View
            style={[
                styles.row,
                !last && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: colors.textSecondary,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {label}
            </ThemedText>
            {right ?? null}
        </View>
    );

    if (!onPress) return body;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            style={({ pressed }) => [pressed && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    label: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
