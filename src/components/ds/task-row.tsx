// TaskRow — the single primitive for rendering a task in a card-grouped
// list, used by both the Lists tab and Home/Today. Lifted out of
// `src/app/(app)/lists.tsx` so the two surfaces share one row shape.
//
// Design source: direction-c-pro.jsx CTask (~1063-1110). Layout L→R:
//   • 16×16 checkbox
//   • Title (13.5 / 500 / -0.2 / lineHeight 18) + meta row
//   • Meta row: cross-list color-dot pills (tap to toggle membership) +
//     optional "Event" mono pill + relative mono due label
//     (today / tmrw / wed / -1d / mar 12) tinted alert for overdue
//   • "+ lists" dashed pill (when allLists provided + onToggleExpanded)
//   • Right-edge 22px primary-assignee avatar (or dashed "Anyone" placeholder)
//
// Expansion + swipe are opt-in. Lists turns them all on; Home/Today gets
// the same visual base without the gesture surface (no swipe panes; no
// inline list picker) — keeps the simpler surfaces simple while sharing
// the row's render contract so a future visual change touches one file.

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
    type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import type { List as TaskList, Task } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { UNASSIGNED_COLOR, colorForResponsible } from '@/lib/colors';
import { useAppColorScheme } from '@/providers/theme-provider';

/**
 * Relative compact due label per the design source — today / tmrw / wed /
 * -1d / mar 12 (all lowercase, mono-friendly). Overdue rows (negative diff)
 * render as `-Nd` so parents can colour them alert without recomputing.
 * Exported so callers can reuse the same compact format on related
 * surfaces (notifications, summaries, etc.).
 */
export function relativeDueLabel(due: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
        (dueDay.getTime() - today.getTime()) / 86400000,
    );
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tmrw';
    if (diffDays > 1 && diffDays <= 6) {
        return format(due, 'EEE').toLowerCase();
    }
    if (diffDays < 0) return `${diffDays}d`;
    return format(due, 'MMM d').toLowerCase();
}

export type TaskRowMember = { profile_id: string; display_name: string };

export function TaskRow({
    task,
    members,
    colorMap,
    allLists = [],
    activeListId = null,
    expanded = false,
    onToggleExpanded,
    onToggleList,
    onToggle,
    onTap,
    onDelete,
    onSnooze,
    isLast,
}: {
    task: Task;
    members: TaskRowMember[];
    /** profile_id → identity color, built once by the parent (memberColorMap). */
    colorMap: Map<string, string>;
    /** All household lists. When empty, cross-list pills + expand affordance
     *  are hidden — useful for surfaces (Home/Today) that don't surface
     *  list management. */
    allLists?: TaskList[];
    /** The list this row is being viewed under. Cross-list pills filter
     *  this id out so the active list doesn't render a redundant chip.
     *  Pass null on Home/Today (no list context) → every membership renders. */
    activeListId?: string | null;
    /** Local expanded state, lifted to the parent so it survives renders. */
    expanded?: boolean;
    /** Toggles the inline list picker panel below the row. Omit to hide the
     *  expand affordance entirely. */
    onToggleExpanded?: () => void;
    /** Tap a list pill (or a picker chip when expanded) → toggle membership.
     *  Required when allLists is non-empty. */
    onToggleList?: (listId: string) => void;
    /** Tap the checkbox → toggle complete. */
    onToggle: () => void;
    /** Tap the row body → open task detail. */
    onTap: () => void;
    /** Swipe-pane Delete (full reveal). Omit to disable the swipe surface
     *  entirely — the row stays tappable but no gesture pane reveals. */
    onDelete?: () => void;
    /** Swipe-pane "+1d" snooze (mid reveal). Omit + provide onDelete only
     *  to render a single Done/Delete pair if needed; passing both gives
     *  the full Done / +1d / Delete trio. */
    onSnooze?: () => void;
    /** True for the last row in its bucket card — suppresses the bottom
     *  hairline so it doesn't double up on the card's own border. */
    isLast?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const done = !!task.completed_at;
    const dueLabel = task.due_at
        ? relativeDueLabel(new Date(task.due_at))
        : null;
    // Overdue tinting matches the bucket-by-day cutoff used on Lists — any
    // due timestamp before today's midnight is overdue. Tied to a colour +
    // weight bump so the urgency reads at a glance.
    const isOverdue = (() => {
        if (!task.due_at || done) return false;
        const dueMs = new Date(task.due_at).getTime();
        const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
        return dueMs < startOfTodayMs;
    })();

    const primaryAssigneeId = task.assignee_profile_ids[0];
    const primaryAssigneeColor = primaryAssigneeId
        ? colorForResponsible(primaryAssigneeId, colorMap)
        : UNASSIGNED_COLOR;
    const primaryAssigneeMember = primaryAssigneeId
        ? members.find((m) => m.profile_id === primaryAssigneeId) ?? null
        : null;
    const primaryAssigneeInitial =
        primaryAssigneeMember?.display_name?.charAt(0).toUpperCase() ?? '?';

    // Swipe-to-action: render only when the parent opts in by providing
    // at least one swipe handler. Today's simpler surfaces pass nothing and
    // get a plain Pressable row; Lists provides Done/+1d/Delete and gets the
    // 3-panel reveal.
    const hasSwipe = !!(onDelete || onSnooze);
    const swipeableRef = useRef<SwipeableMethods | null>(null);
    const SWIPE_PANEL_WIDTH = 64;
    const renderRightActions = () => (
        <View style={styles.swipePanelGroup}>
            <Pressable
                onPress={() => {
                    swipeableRef.current?.close();
                    onToggle();
                }}
                accessibilityRole="button"
                accessibilityLabel={done ? 'Mark incomplete' : 'Mark done'}
                style={({ pressed }) => [
                    styles.swipePanel,
                    { backgroundColor: colors.accent, width: SWIPE_PANEL_WIDTH },
                    pressed && styles.pressed,
                ]}>
                <Feather name="check" size={18} color={colors.onAccent} />
                <ThemedText
                    style={[
                        styles.swipePanelLabel,
                        {
                            color: colors.onAccent,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    DONE
                </ThemedText>
            </Pressable>
            {onSnooze ? (
                <Pressable
                    onPress={() => {
                        swipeableRef.current?.close();
                        onSnooze();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Snooze one day"
                    style={({ pressed }) => [
                        styles.swipePanel,
                        { backgroundColor: colors.warn, width: SWIPE_PANEL_WIDTH },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="clock" size={18} color="#FFFFFF" />
                    <ThemedText
                        style={[
                            styles.swipePanelLabel,
                            {
                                color: '#FFFFFF',
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        +1D
                    </ThemedText>
                </Pressable>
            ) : null}
            {onDelete ? (
                <Pressable
                    onPress={() => {
                        swipeableRef.current?.close();
                        onDelete();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete task"
                    style={({ pressed }) => [
                        styles.swipePanel,
                        { backgroundColor: colors.alert, width: SWIPE_PANEL_WIDTH },
                        pressed && styles.pressed,
                    ]}>
                    <Feather name="trash-2" size={18} color={colors.onAccent} />
                    <ThemedText
                        style={[
                            styles.swipePanelLabel,
                            {
                                color: colors.onAccent,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        DEL
                    </ThemedText>
                </Pressable>
            ) : null}
        </View>
    );

    const showMetaRow =
        !!dueLabel ||
        !!task.event_id ||
        task.list_ids.some((lid) => lid !== activeListId) ||
        allLists.length > 0;

    const rowBody = (
        <Pressable
            onPress={onTap}
            style={({ pressed }) => [
                styles.taskRow,
                !isLast && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                done && { opacity: 0.65 },
                pressed && styles.pressed,
            ]}>
            <Pressable
                onPress={onToggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={
                    done ? 'Mark task incomplete' : 'Mark task complete'
                }
                style={({ pressed }) => [
                    styles.checkbox,
                    {
                        backgroundColor: done ? colors.accent : 'transparent',
                        borderColor: done ? colors.accent : colors.inkFaint,
                    },
                    pressed && styles.pressed,
                ]}>
                {done ? (
                    <Feather name="check" size={12} color={colors.onAccent} />
                ) : null}
            </Pressable>

            <View style={styles.taskBody}>
                <ThemedText
                    style={[
                        styles.taskTitle,
                        {
                            color: done ? colors.textSecondary : colors.text,
                        },
                        done && { textDecorationLine: 'line-through' },
                    ]}
                    numberOfLines={2}>
                    {task.title}
                </ThemedText>

                {showMetaRow ? (
                    <View style={styles.metaRow}>
                        {task.list_ids
                            .filter((lid) => lid !== activeListId)
                            .map((lid) => {
                                const l = allLists.find((x) => x.id === lid);
                                if (!l) return null;
                                return (
                                    <Pressable
                                        key={`meta-list-${lid}`}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            onToggleList?.(lid);
                                        }}
                                        // Disable the chip's own tap target
                                        // when the parent didn't provide a
                                        // toggle handler (Home/Today case) —
                                        // the chip stays informational and
                                        // taps fall through to the row's
                                        // own onTap.
                                        disabled={!onToggleList}
                                        accessibilityLabel={`Remove from ${l.name}`}
                                        style={({ pressed }) => [
                                            styles.listTagPill,
                                            {
                                                backgroundColor: withAlpha(
                                                    l.color,
                                                    0.13,
                                                ),
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <View
                                            style={[
                                                styles.listTagDot,
                                                { backgroundColor: l.color },
                                            ]}
                                        />
                                        <ThemedText
                                            style={[
                                                styles.listTagText,
                                                {
                                                    color: colors.inkSec,
                                                    fontFamily:
                                                        FontFamily.monoRegular,
                                                },
                                            ]}>
                                            {l.name}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        {task.event_id ? (
                            <View style={styles.listTagPlain}>
                                <ThemedText
                                    style={[
                                        styles.listTagText,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily:
                                                FontFamily.monoRegular,
                                        },
                                    ]}>
                                    Event
                                </ThemedText>
                            </View>
                        ) : null}
                        {dueLabel ? (
                            <ThemedText
                                style={[
                                    styles.listTagText,
                                    {
                                        color: isOverdue
                                            ? colors.alert
                                            : colors.textSecondary,
                                        fontFamily: isOverdue
                                            ? FontFamily.monoSemiBold
                                            : FontFamily.monoRegular,
                                    },
                                ]}>
                                {dueLabel}
                            </ThemedText>
                        ) : null}
                        {allLists.length > 0 && onToggleExpanded ? (
                            <Pressable
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onToggleExpanded();
                                }}
                                style={({ pressed }) => [
                                    styles.addListChip,
                                    {
                                        borderColor: colors.hair,
                                        borderStyle: expanded
                                            ? 'solid'
                                            : 'dashed',
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.listTagText,
                                        {
                                            color: colors.accent,
                                            fontFamily:
                                                FontFamily.sansSemiBold,
                                        },
                                    ]}>
                                    {expanded ? '× lists' : '+ lists'}
                                </ThemedText>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}

                {expanded && onToggleList ? (
                    <View
                        style={[
                            styles.listPickerPanel,
                            { borderColor: colors.hair },
                        ]}>
                        {allLists.map((l) => {
                            const selected = task.list_ids.includes(l.id);
                            return (
                                <Pressable
                                    key={`pick-${l.id}`}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        onToggleList(l.id);
                                    }}
                                    style={({ pressed }) => [
                                        styles.listTagPill,
                                        {
                                            backgroundColor: selected
                                                ? withAlpha(l.color, 0.13)
                                                : 'transparent',
                                            borderWidth:
                                                StyleSheet.hairlineWidth,
                                            borderColor: selected
                                                ? 'transparent'
                                                : colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View
                                        style={[
                                            styles.listTagDot,
                                            { backgroundColor: l.color },
                                        ]}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.listTagText,
                                            {
                                                color: selected
                                                    ? colors.inkSec
                                                    : colors.text,
                                                fontFamily:
                                                    FontFamily.monoRegular,
                                            },
                                        ]}>
                                        {l.name}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}
            </View>

            {primaryAssigneeId ? (
                <View
                    style={[
                        styles.taskAssigneeAvatar,
                        { backgroundColor: primaryAssigneeColor },
                    ]}>
                    <ThemedText
                        style={[
                            styles.taskAssigneeInitial,
                            { fontFamily: FontFamily.sansSemiBold },
                        ]}>
                        {primaryAssigneeInitial}
                    </ThemedText>
                </View>
            ) : (
                <View
                    style={[
                        styles.taskAssigneeAvatar,
                        styles.taskAssigneeAnyone,
                        { borderColor: colors.inkFaint },
                    ]}>
                    <ThemedText
                        style={[
                            styles.taskAssigneeInitial,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        ?
                    </ThemedText>
                </View>
            )}
        </Pressable>
    );

    if (!hasSwipe) return rowBody;

    return (
        <ReanimatedSwipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={96}>
            {rowBody}
        </ReanimatedSwipeable>
    );
}

const styles = StyleSheet.create({
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        position: 'relative',
    },
    checkbox: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1.2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskBody: { flex: 1, gap: 3 },
    taskTitle: {
        fontSize: 13.5,
        lineHeight: 18,
        letterSpacing: -0.2,
        fontFamily: FontFamily.sansMedium,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    listTagPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    listTagPlain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 1,
    },
    listTagDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    listTagText: {
        fontSize: 10,
        letterSpacing: -0.2,
    },
    addListChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    listPickerPanel: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: Spacing.two,
        padding: Spacing.two,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: Spacing.two,
    },
    taskAssigneeAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskAssigneeAnyone: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    taskAssigneeInitial: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    swipePanelGroup: { flexDirection: 'row' },
    swipePanel: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    swipePanelLabel: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    pressed: { opacity: 0.7 },
});
