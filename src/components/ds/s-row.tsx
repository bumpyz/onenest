// SRow — a single label/value row inside an SGroup card. Three flavors,
// triggered by props:
//
//   * Display only:     <SRow label="Phone" right={<Text>555-…</Text>} />
//   * With chevron:     <SRow label="Due" right={…} chevron onPress={…} />
//   * Last in card:     pass `last` to suppress the bottom hairline so it
//                       doesn't double up on the card's own bottom edge.
//
// Design source: direction-c-pro.jsx ~933+ where `SRow` is a chip-pattern
// used by every Settings sub-route and every detail screen. Spacing /
// typography / divider all baked in here so callers can't drift from spec.
//
// Tappable rows render the same hairline divider but wrap the body in a
// Pressable. The chevron is its own optional glyph — having `onPress`
// without a chevron is allowed (e.g. checkbox rows) but `chevron` without
// `onPress` is a code smell flagged by an a11y note in the prop docs.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function SRow({
    label,
    right,
    chevron,
    onPress,
    last,
    accessibilityLabel,
}: {
    /** Row label rendered on the left. Design typography: 14/500/-0.2. */
    label: string;
    /** Right-aligned value — a React node so callers can drop mono text,
     *  avatar stacks, tag pills, etc. without forking the component. */
    right?: React.ReactNode;
    /** Renders a trailing chevron. Implies tappability — pair with onPress
     *  so screen readers and pointer affordances align. */
    chevron?: boolean;
    /** Wraps the row body in a Pressable. Without it, the row is static. */
    onPress?: () => void;
    /** True for the last row in its card — suppresses the bottom hairline
     *  divider so it doesn't double the card's own bottom border. */
    last?: boolean;
    /** A11y label for tappable rows. Defaults to `label` if omitted. */
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
                style={[styles.label, { color: colors.text }]}
                numberOfLines={1}>
                {label}
            </ThemedText>
            {right ?? null}
            {chevron ? (
                <Feather
                    name="chevron-right"
                    size={12}
                    color={colors.inkFaint}
                    style={styles.chevron}
                />
            ) : null}
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
    // Design source uses `padding: '13px 14px'` and a `0.5px hair` bottom
    // border. Border-bottom lives inside the row (not as an external
    // divider) so `last` can suppress it without a sibling primitive.
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    // 14/500/-0.2 — design's SRow label spec. flex:1 makes the right slot
    // hug the trailing edge regardless of label length, and numberOfLines
    // on the label keeps long copy from pushing the value off the row.
    label: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
        flex: 1,
    },
    // 4px gap between right-value and chevron, matching the design's
    // visual rhythm where the chevron sits just outside the value.
    chevron: { marginLeft: 4 },
    pressed: { opacity: 0.7 },
});
