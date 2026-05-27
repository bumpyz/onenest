// ListsSheet — TaskDetail v2 field-edit sheet for the In lists row.
// Design source: screens-task-edit.jsx ListsSheet (~912-997).
//
// Multi-select sheet. Each row has a 22×22 left swatch (list-color tinted
// bg + inner color dot), name (13.5/500), mono `N tasks` sub, and a
// 20px SQUARE checkbox (multi-select shape, vs RadioBubble's round).
//
// Search field at the top — local filter against list names. The `+ NEW`
// chip routes to /list/new (a separate create flow); we close the sheet
// and let the user come back to assign once the new list exists. A
// future enhancement could inline the create form per the spec, but the
// route already exists and reuse beats re-implementing.

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import {
    setTaskLists,
    type List as TaskList,
    type Task,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

import { SquareCheck } from './radio-bubble';

export function ListsSheet({
    open,
    onClose,
    onSaved,
    task,
    lists,
    taskCounts,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    task: Task;
    lists: TaskList[];
    /** Map of list_id → open-task count, surfaced in the sub-text per
     *  design (`12 tasks` etc.). Parent computes from useHouseholdTasks
     *  and threads it in to avoid a second hook here. */
    taskCounts?: Map<string, number>;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const router = useRouter();

    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set(task.list_ids),
    );
    const [query, setQuery] = useState('');
    useEffect(() => {
        if (open) {
            setSelectedIds(new Set(task.list_ids));
            setQuery('');
        }
    }, [open, task.list_ids]);
    const [saving, setSaving] = useState(false);

    const filteredLists = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return lists;
        return lists.filter((l) => l.name.toLowerCase().includes(q));
    }, [lists, query]);

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
            await setTaskLists(task.id, Array.from(selectedIds));
            onSaved();
            onClose();
        } catch (err) {
            console.error('lists save failed', err);
        } finally {
            setSaving(false);
        }
    };

    const handleNew = () => {
        onClose();
        router.push('/list/new');
    };

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="In lists"
            sub="Tasks can live in multiple lists. Uncheck to remove."
            height={580}
            primary={
                saving
                    ? 'Saving…'
                    : `Save · ${selectedIds.size} selected`
            }
            onPrimary={handleSave}
            primaryDisabled={saving}>
            {/* Search + + NEW */}
            <View
                style={[
                    styles.search,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <Feather name="search" size={13} color={colors.inkFaint} />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search lists…"
                    placeholderTextColor={colors.inkFaint}
                    style={[
                        styles.searchInput,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.monoRegular,
                        },
                    ]}
                />
                <Pressable
                    onPress={handleNew}
                    accessibilityRole="button"
                    accessibilityLabel="Create new list"
                    style={({ pressed }) => [
                        styles.newBtn,
                        {
                            backgroundColor: withAlpha(
                                colors.accent,
                                0x14 / 255,
                            ),
                        },
                        pressed && styles.pressed,
                    ]}>
                    <ThemedText
                        style={[
                            styles.newBtnText,
                            {
                                color: colors.accent,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        + NEW
                    </ThemedText>
                </Pressable>
            </View>

            {/* Lists card */}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                        marginTop: 12,
                    },
                ]}>
                {filteredLists.map((l, idx) => {
                    const isSelected = selectedIds.has(l.id);
                    const isLast = idx === filteredLists.length - 1;
                    const count = taskCounts?.get(l.id) ?? 0;
                    return (
                        <Pressable
                            key={l.id}
                            onPress={() => toggle(l.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={l.name}
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
                            <View
                                style={[
                                    styles.swatch,
                                    {
                                        backgroundColor: withAlpha(
                                            l.color,
                                            0x33 / 255,
                                        ),
                                        borderColor: withAlpha(
                                            l.color,
                                            0x55 / 255,
                                        ),
                                    },
                                ]}>
                                <View
                                    style={[
                                        styles.swatchDot,
                                        { backgroundColor: l.color },
                                    ]}
                                />
                            </View>
                            <View style={styles.rowBody}>
                                <ThemedText
                                    style={[
                                        styles.name,
                                        { color: colors.text },
                                    ]}>
                                    {l.name}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.sub,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {count} task{count === 1 ? '' : 's'}
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
                {filteredLists.length === 0 ? (
                    <View style={styles.empty}>
                        <ThemedText
                            style={{ color: colors.inkFaint, fontSize: 13 }}>
                            No lists match &ldquo;{query}&rdquo;.
                        </ThemedText>
                    </View>
                ) : null}
            </View>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        letterSpacing: -0.2,
        padding: 0,
    },
    newBtn: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    newBtnText: {
        fontSize: 9.5,
        letterSpacing: 0.3,
        fontWeight: '600',
    },
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
    swatch: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    swatchDot: { width: 8, height: 8, borderRadius: 4 },
    rowBody: { flex: 1, minWidth: 0 },
    name: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    sub: {
        fontSize: 10.5,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    empty: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    pressed: { opacity: 0.7 },
});
