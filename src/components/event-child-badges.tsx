// Renders the row of ChildBadges that prefix an event's title on Calendar and Home.
// Shared between both surfaces so a tweak (sizing, overflow rules, accessibility) lands
// in one place. Returns null when there are no children to show — callers don't need to
// guard the empty case themselves.

import { StyleSheet, View } from 'react-native';

import { ChildBadge } from '@/components/child-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Child } from '@/lib/db';

type Props = {
    /** All children in the household. We look up each child_id against this list. */
    allChildren: Child[];
    /** child_ids on the event being rendered. */
    childIds: string[];
    /** Badge size — defaults to sm (16px), which fits inline with a 14-16pt title. */
    size?: 'sm' | 'md';
    /** Max badges before collapsing to "+N more". Set higher on Home where rows are wider. */
    maxVisible?: number;
};

export function EventChildBadges({
    allChildren,
    childIds,
    size = 'sm',
    maxVisible = 3,
}: Props) {
    if (!childIds || childIds.length === 0) return null;

    // Map ids to children. Skip any unresolvable ones (e.g. child was deleted but the
    // join row hadn't cascaded yet) so the badge row doesn't show ghosts.
    const resolved: Child[] = [];
    for (const id of childIds) {
        const c = allChildren.find((cc) => cc.id === id);
        if (c) resolved.push(c);
    }
    if (resolved.length === 0) return null;

    const visible = resolved.slice(0, maxVisible);
    const overflow = resolved.length - visible.length;

    return (
        <View style={styles.row}>
            {visible.map((c) => (
                <ChildBadge key={c.id} name={c.display_name} color={c.color} size={size} />
            ))}
            {overflow > 0 ? (
                <ThemedText type="small" style={styles.overflowText}>
                    +{overflow}
                </ThemedText>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    overflowText: {
        fontWeight: '600',
        marginLeft: Spacing.one,
    },
});
