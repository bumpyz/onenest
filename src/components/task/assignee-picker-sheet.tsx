// AssignSheet — TaskDetail v2 field-edit sheet for the Assigned to row.
// Design source: screens-task-edit.jsx AssignSheet (~630-718).
//
// Single-select per the design ("One person owns each task"). This is a
// shape change from the previous multi-select implementation — the DB still
// stores assignee_profile_ids as an array, but the sheet writes at most one
// id. Secondary action "Unassign" clears the selection.
//
// Auto-assign toggle (deferred backend): the design shows a toggle that,
// when ON, auto-assigns based on who's with the kid at the due time.
// That requires a custody-aware resolver server-side which isn't built
// yet. We render the toggle but the save handler emits a "coming soon"
// hint when it's flipped on — captures the UX intent without lying about
// the backend behavior.

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import {
    updateTask,
    type HouseholdMember,
    type Task,
} from '@/lib/db';
import { KNOB_SHADOW, withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

import { RadioBubble } from './radio-bubble';

export function AssigneePickerSheet({
    open,
    onClose,
    onSaved,
    task,
    members,
    currentUserId,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    task: Task;
    members: HouseholdMember[];
    currentUserId: string;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const colorMap = memberColorMap(members);

    // Seed with the first existing assignee — design's single-select shape.
    const [selected, setSelected] = useState<string | null>(
        task.assignee_profile_ids[0] ?? null,
    );
    const [autoAssign, setAutoAssign] = useState(false);
    useEffect(() => {
        if (open) {
            setSelected(task.assignee_profile_ids[0] ?? null);
            setAutoAssign(false);
        }
    }, [open, task.assignee_profile_ids]);
    const [saving, setSaving] = useState(false);

    const selectedMember = selected
        ? members.find((m) => m.profile_id === selected) ?? null
        : null;

    const handleSave = async () => {
        if (autoAssign) {
            // Backend deferred — surface honest hint and bail without
            // mutating the assignee.
            const msg =
                "Auto-assign is coming soon — for now, pick a person manually below.";
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined') window.alert(msg);
            } else {
                Alert.alert('Auto-assign', msg);
            }
            setAutoAssign(false);
            return;
        }
        setSaving(true);
        try {
            await updateTask(task.id, {
                title: task.title,
                notes: task.notes ?? undefined,
                eventId: task.event_id ?? undefined,
                dueAt: task.due_at,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: task.priority,
                assigneeProfileIds: selected ? [selected] : [],
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error('assignee save failed', err);
        } finally {
            setSaving(false);
        }
    };

    const handleUnassign = () => {
        setSelected(null);
    };

    // Dynamic primary label — "Save · Alex" or "Save · Unassigned".
    const primaryLabel = (() => {
        if (saving) return 'Saving…';
        if (autoAssign) return 'Save · Auto-assign';
        if (selectedMember) {
            const label =
                currentUserId === selectedMember.profile_id
                    ? 'Me'
                    : selectedMember.display_name;
            return `Save · ${label}`;
        }
        return 'Save · Unassigned';
    })();

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Assign to"
            sub="One person owns each task"
            height={500}
            primary={primaryLabel}
            onPrimary={handleSave}
            primaryDisabled={saving}
            secondary={selected ? 'Unassign' : undefined}
            onSecondary={handleUnassign}>
            {/* Person list card */}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                {members.map((m, idx) => {
                    const isSelected =
                        !autoAssign && selected === m.profile_id;
                    const isLast = idx === members.length - 1;
                    const isYou = currentUserId === m.profile_id;
                    const c = colorForResponsible(m.profile_id, colorMap);
                    const initial =
                        m.display_name?.charAt(0).toUpperCase() ?? '?';
                    return (
                        <Pressable
                            key={m.profile_id}
                            onPress={() => {
                                setAutoAssign(false);
                                setSelected(m.profile_id);
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={m.display_name}
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
                                    styles.avatar,
                                    { backgroundColor: c },
                                ]}>
                                <ThemedText style={styles.avatarText}>
                                    {initial}
                                </ThemedText>
                            </View>
                            <View style={styles.rowBody}>
                                <ThemedText
                                    style={[
                                        styles.name,
                                        { color: colors.text },
                                    ]}>
                                    {m.display_name}
                                    {isYou ? ' (you)' : ''}
                                </ThemedText>
                                {/* Sub-meta — design shows "N active tasks ·
                                    last active T". We don't have the per-
                                    member active-task count cached yet, so
                                    surface the role + a faint timestamp
                                    placeholder. Hooking this up is a
                                    separate task tracker item. */}
                                <ThemedText
                                    style={[
                                        styles.sub,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {(m.role ?? '').toString().toLowerCase() ||
                                        'member'}
                                </ThemedText>
                            </View>
                            <RadioBubble
                                selected={isSelected}
                                accentColor={colors.accent}
                                onAccentColor={colors.onAccent}
                                inactiveColor={colors.inkFaint}
                            />
                        </Pressable>
                    );
                })}
            </View>

            {/* Auto-assign hint card — dashed border, mid-strength. The
                toggle is a stub today; save handler shows a "coming soon"
                when ON. Captures the design's affordance without
                pretending the backend supports it. */}
            <Pressable
                onPress={() => setAutoAssign((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: autoAssign }}
                accessibilityLabel="Auto-assign"
                style={({ pressed }) => [
                    styles.autoCard,
                    { borderColor: colors.hair },
                    pressed && styles.pressed,
                ]}>
                <View
                    style={[
                        styles.autoIconBubble,
                        { backgroundColor: colors.backgroundInset },
                    ]}>
                    <ThemedText
                        style={[
                            styles.autoIconQ,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        ?
                    </ThemedText>
                </View>
                <View style={styles.autoBody}>
                    <ThemedText
                        style={[styles.autoText, { color: colors.inkSec }]}>
                        <ThemedText
                            style={{ fontWeight: '600', color: colors.text }}>
                            Auto-assign
                        </ThemedText>{' '}
                        — based on who&apos;s with the kid at the due time
                    </ThemedText>
                </View>
                <View
                    style={[
                        styles.toggle,
                        {
                            backgroundColor: autoAssign
                                ? colors.accent
                                : withAlpha(colors.inkFaint, 0.53),
                        },
                    ]}>
                    <View
                        style={[
                            styles.toggleKnob,
                            autoAssign && { left: 16 },
                        ]}>
                        {autoAssign ? (
                            <Feather
                                name="check"
                                size={10}
                                color={colors.accent}
                            />
                        ) : null}
                    </View>
                </View>
            </Pressable>
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
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    avatarText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
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
    autoCard: {
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    autoIconBubble: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    autoIconQ: { fontSize: 14, lineHeight: 16 },
    autoBody: { flex: 1, minWidth: 0 },
    autoText: { fontSize: 11.5, lineHeight: 16 },
    toggle: {
        width: 36,
        height: 22,
        borderRadius: 11,
        position: 'relative',
        flexShrink: 0,
    },
    toggleKnob: {
        position: 'absolute',
        top: 2,
        left: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFFFFF',
        ...KNOB_SHADOW,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
});
