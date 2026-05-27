// ChildrenSheet — TaskDetail v2 field-edit sheet for the For row.
// Design source: screens-task-edit.jsx ChildrenSheet (~999-1060).
//
// Multi-select. Each row has a 32px CAvatar-style colored circle with the
// kid's initial, name (14/600), meta sub showing age/grade/custody week,
// and a 20px SQUARE checkbox.
//
// Meta sub today shows the kid's display_name + a placeholder hint —
// custody-week + age/grade detail relies on data we don't surface in
// the children table yet. Wiring those is a separate follow-up that
// matches the README's note "External co-parents see the task only for
// kids they share."

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChildBadge } from '@/components/child-badge';
import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { setTaskChildren, type Child, type Task } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

import { SquareCheck } from './radio-bubble';

export function ChildrenSheet({
    open,
    onClose,
    onSaved,
    task,
    children,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    task: Task;
    children: Child[];
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set(task.child_ids),
    );
    useEffect(() => {
        if (open) setSelectedIds(new Set(task.child_ids));
    }, [open, task.child_ids]);
    const [saving, setSaving] = useState(false);

    const toggle = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setTaskChildren(task.id, Array.from(selectedIds));
            onSaved();
            onClose();
        } catch (err) {
            console.error('children save failed', err);
        } finally {
            setSaving(false);
        }
    };

    // Dynamic primary label — "Save · Oliver" / "Save · 2 selected" / "Save · None".
    const primaryLabel = (() => {
        if (saving) return 'Saving…';
        if (selectedIds.size === 0) return 'Save · None';
        if (selectedIds.size === 1) {
            const id = Array.from(selectedIds)[0];
            const child = children.find((c) => c.id === id);
            return `Save · ${child?.display_name ?? 'Selected'}`;
        }
        return `Save · ${selectedIds.size} selected`;
    })();

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="For whom"
            sub="External co-parents see the task only for kids they share."
            height={500}
            primary={primaryLabel}
            onPrimary={handleSave}
            primaryDisabled={saving}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                {children.map((c, idx) => {
                    const isSelected = selectedIds.has(c.id);
                    const isLast = idx === children.length - 1;
                    return (
                        <Pressable
                            key={c.id}
                            onPress={() => toggle(c.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={c.display_name}
                            style={({ pressed }) => [
                                styles.row,
                                !isLast && {
                                    borderBottomColor: colors.hair,
                                    borderBottomWidth:
                                        StyleSheet.hairlineWidth,
                                },
                                isSelected && {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0x0e / 255,
                                    ),
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ChildBadge
                                name={c.display_name}
                                color={c.color}
                                size="md"
                            />
                            <View style={styles.rowBody}>
                                <ThemedText
                                    style={[
                                        styles.name,
                                        { color: colors.text },
                                    ]}>
                                    {c.display_name}
                                </ThemedText>
                                {/* Meta — age/grade/custody copy. The
                                    children table doesn't store age or
                                    grade today, so we fall back to a
                                    placeholder. Hook these up alongside
                                    the custody-week resolver when those
                                    land. */}
                                <ThemedText
                                    style={[
                                        styles.sub,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    Tap to {isSelected ? 'remove' : 'add'}
                                </ThemedText>
                            </View>
                            <SquareCheck
                                selected={isSelected}
                                accentColor={colors.accent}
                                onAccentColor={colors.onAccent}
                                inactiveColor={colors.inkFaint}
                            />
                        </Pressable>
                    );
                })}
                {children.length === 0 ? (
                    <View style={styles.empty}>
                        <ThemedText
                            style={{
                                color: colors.inkFaint,
                                fontSize: 13,
                                textAlign: 'center',
                            }}>
                            No children added to this household yet.
                        </ThemedText>
                    </View>
                ) : null}
            </View>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    rowBody: { flex: 1, minWidth: 0 },
    name: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    sub: {
        fontSize: 10.5,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    empty: {
        paddingVertical: 24,
        paddingHorizontal: 14,
    },
    pressed: { opacity: 0.7 },
});
