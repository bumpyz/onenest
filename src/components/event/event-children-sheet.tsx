// EventChildrenSheet — field-edit sheet for the FOR row (kid multi-select).
// Mirrors the TaskDetail v2 ChildrenSheet shape.
//
// Save semantics (post-bug-fix):
//   The sheet does NOT write to the DB on its own. It pushes the user's
//   selection up to the parent via `onApply(ids)`, and the parent's
//   sticky "Save changes" button commits everything together. This
//   matches the pattern the user expects from the surrounding screen
//   (one Save button, all pending changes flush together) and avoids
//   the trap where the user closes the sheet via backdrop/X and loses
//   their selection silently. The old onSaved + inline updateEvent
//   flow was the bug — the user reported "adding a kid in the For
//   section doesn't save when clicking Save changes" because the
//   sheet's separate save button wasn't being noticed.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChildBadge } from '@/components/child-badge';
import { SheetShell } from '@/components/ds/sheet-shell';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { Child } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    open: boolean;
    onClose: () => void;
    /** Pushes the selected child ids to the parent. The parent stores
     *  this in a draft and commits via its own Save button. The sheet
     *  closes after invoking the callback — parent decides whether to
     *  refetch, re-render, etc. */
    onApply: (ids: string[]) => void;
    /** Initial selection — usually the parent's draft (when one exists)
     *  or `event.child_ids`. Read once when the sheet opens. */
    initialIds: string[];
    children: Child[];
};

export function EventChildrenSheet({
    open,
    onClose,
    onApply,
    initialIds,
    children: kids,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set(initialIds),
    );

    // Reset the sheet's local selection on every open. The deps
    // intentionally don't include `initialIds` — we want the open
    // event to be the trigger, not every parent-state change. Closing
    // and reopening the sheet should pull fresh from the parent.
    useEffect(() => {
        if (!open) return;
        setSelectedIds(new Set(initialIds));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const toggle = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleApply = () => {
        onApply(Array.from(selectedIds));
        onClose();
    };

    const summary =
        selectedIds.size === 0
            ? 'Apply · No kids tagged'
            : selectedIds.size === 1
              ? 'Apply · 1 kid'
              : `Apply · ${selectedIds.size} kids`;

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="For whom"
            sub="External co-parents see the event only for kids they share."
            primary={summary}
            secondary="Cancel"
            onPrimary={handleApply}
            onSecondary={onClose}
            height={500}>
            <View style={styles.list}>
                {kids.length === 0 ? (
                    <ThemedText
                        style={[styles.empty, { color: colors.textSecondary }]}>
                        No kids in this household yet. Add them in Settings →
                        Children to tag events to them.
                    </ThemedText>
                ) : null}
                {kids.map((k) => {
                    const selected = selectedIds.has(k.id);
                    return (
                        <Pressable
                            key={k.id}
                            onPress={() => toggle(k.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={k.display_name}
                            style={({ pressed }) => [
                                styles.row,
                                {
                                    backgroundColor: selected
                                        ? withAlpha(k.color, 0.13)
                                        : 'transparent',
                                    borderColor: selected ? k.color : colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ChildBadge
                                name={k.display_name}
                                color={k.color}
                                size="md"
                            />
                            <ThemedText
                                style={[styles.name, { color: colors.text }]}
                                numberOfLines={1}>
                                {k.display_name}
                            </ThemedText>
                            <View
                                style={[
                                    styles.check,
                                    {
                                        borderColor: selected
                                            ? colors.accent
                                            : colors.inkFaint,
                                        backgroundColor: selected
                                            ? colors.accent
                                            : 'transparent',
                                    },
                                ]}>
                                {selected ? (
                                    <ThemedText
                                        style={{
                                            color: colors.onAccent,
                                            fontSize: 12,
                                            fontWeight: '700',
                                        }}>
                                        ✓
                                    </ThemedText>
                                ) : null}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    list: { gap: Spacing.one },
    empty: { fontSize: 12, lineHeight: 18, paddingVertical: 16 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    name: { flex: 1, fontSize: 14, fontWeight: '500', letterSpacing: -0.2 },
    check: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
});
