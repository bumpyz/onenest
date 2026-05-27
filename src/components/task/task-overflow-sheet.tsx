// TaskOverflowSheet — the ••• kebab destination on TaskDetail v2.
// Design source: screens-task-edit.jsx TaskOverflowSheet + OverflowRow
// (~373-502).
//
// Three grouped action cards inside one sheet:
//   Group 1 (primary):     Share / Duplicate / Convert to event / Move /
//                          Pin to top
//   Group 2 (secondary):   Archive without completing / Export as PDF
//   Group 3 (destructive): Delete task — faint alert-tinted card border
//
// Most actions are deferred (Share/Duplicate/Convert/Pin/Archive/Export)
// because they need backend support we haven't built yet. Each renders
// per the design and surfaces a "coming soon" alert on tap so users
// understand the affordance without us pretending the feature exists.
// Delete is fully wired (calls the existing deleteTask helper).
//
// Move opens the ListsSheet — same multi-select as the In lists row tap,
// just framed as "move" for the common "wrong-list" mental model.

import { Feather } from '@expo/vector-icons';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { deleteTask, type Task } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export function TaskOverflowSheet({
    open,
    onClose,
    onDeleted,
    onMoveToList,
    task,
}: {
    open: boolean;
    onClose: () => void;
    /** Called after a successful delete so the parent can navigate away. */
    onDeleted: () => void;
    /** Tap-through to the parent's ListsSheet open handler — the design's
     *  "Move to another list" is a wrapper around the same multi-select. */
    onMoveToList: () => void;
    task: Task;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Generic "coming soon" handler factory — same Alert pattern for every
    // deferred action.
    const showComingSoon = (title: string, body: string) => {
        onClose();
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                window.alert(`${title}\n\n${body}`);
            }
        } else {
            Alert.alert(title, body);
        }
    };

    const handleDelete = async () => {
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm(
                      'Delete this task?\n\nRemoves for everyone · cannot be undone.',
                  )
                : await new Promise<boolean>((resolve) => {
                      Alert.alert(
                          'Delete this task?',
                          'Removes for everyone · cannot be undone.',
                          [
                              {
                                  text: 'Cancel',
                                  style: 'cancel',
                                  onPress: () => resolve(false),
                              },
                              {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => resolve(true),
                              },
                          ],
                      );
                  });
        if (!confirmed) return;
        try {
            await deleteTask(task.id);
            onDeleted();
            onClose();
        } catch (err) {
            console.error('delete task failed', err);
            const msg =
                errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't delete: ${msg}`);
            else Alert.alert("Couldn't delete", msg);
        }
    };

    const handleMove = () => {
        onClose();
        // Defer the parent's sheet-open so the Modal stack tears down
        // cleanly first — opening a second Modal mid-close on web flickers.
        setTimeout(onMoveToList, 100);
    };

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title={task.title}
            sub="Task actions"
            height={580}
            secondary="Cancel"
            onSecondary={onClose}>
            {/* Group 1 — Primary actions */}
            <View
                style={[
                    styles.group,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <OverflowRow
                    icon="share-2"
                    label="Share task"
                    sub="Copy link · message · email"
                    onPress={() =>
                        showComingSoon(
                            'Share',
                            'Share-to-message and email handoff are coming soon. For now, copy the task link from your browser.',
                        )
                    }
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="copy"
                    label="Duplicate"
                    sub="Make a copy with all fields"
                    onPress={() =>
                        showComingSoon(
                            'Duplicate',
                            'Task duplication is coming soon. We’ll copy notes, lists, priority, and assignee into a fresh task.',
                        )
                    }
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="calendar"
                    label="Convert to event"
                    sub="Promote to calendar with a time block"
                    onPress={() =>
                        showComingSoon(
                            'Convert to event',
                            'Promoting a task to a calendar event is coming soon. For now, create an event manually and link it from the task.',
                        )
                    }
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="folder"
                    label="Move to another list"
                    sub="Reassigns lists in one step"
                    onPress={handleMove}
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="bookmark"
                    label="Pin to top of list"
                    onPress={() =>
                        showComingSoon(
                            'Pin to top',
                            'Pinning tasks is coming soon — pinned tasks will stick at the top of their parent list.',
                        )
                    }
                    colors={colors}
                    last
                />
            </View>

            {/* Group 2 — Secondary */}
            <View
                style={[
                    styles.group,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                        marginTop: 14,
                    },
                ]}>
                <OverflowRow
                    icon="archive"
                    label="Archive without completing"
                    sub="Hide from active views; keep in history"
                    onPress={() =>
                        showComingSoon(
                            'Archive',
                            'Archiving lets you stop tracking a task without marking it done. Coming soon — needs a new column on the task model.',
                        )
                    }
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="download"
                    label="Export as PDF"
                    onPress={() =>
                        showComingSoon(
                            'Export as PDF',
                            'PDF export is coming soon — useful for school + medical task lists people screenshot today.',
                        )
                    }
                    colors={colors}
                    last
                />
            </View>

            {/* Group 3 — Destructive */}
            <View
                style={[
                    styles.group,
                    styles.dangerGroup,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: withAlpha(colors.alert, 0x33 / 255),
                        marginTop: 14,
                    },
                ]}>
                <OverflowRow
                    icon="trash-2"
                    label="Delete task"
                    sub="Removes for everyone · cannot be undone"
                    danger
                    onPress={handleDelete}
                    colors={colors}
                    last
                />
            </View>
        </SheetShell>
    );
}

// ─── OverflowRow ───────────────────────────────────────────────────────────

function OverflowRow({
    icon,
    label,
    sub,
    danger,
    last,
    onPress,
    colors,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    sub?: string;
    danger?: boolean;
    last?: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    const iconColor = danger ? colors.alert : colors.text;
    const labelColor = danger ? colors.alert : colors.text;
    const tileBg = danger
        ? withAlpha(colors.alert, 0x14 / 255)
        : colors.backgroundElement;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [
                styles.row,
                pressed && styles.pressed,
                last && { borderBottomWidth: 0 },
            ]}>
            <View
                style={[
                    styles.iconTile,
                    {
                        backgroundColor: tileBg,
                        borderColor: colors.hair,
                    },
                ]}>
                <Feather name={icon} size={16} color={iconColor} />
            </View>
            <View style={styles.rowBody}>
                <ThemedText
                    style={[styles.rowLabel, { color: labelColor }]}>
                    {label}
                </ThemedText>
                {sub ? (
                    <ThemedText
                        style={[styles.rowSub, { color: colors.inkFaint }]}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            {!danger ? (
                <Feather
                    name="chevron-right"
                    size={12}
                    color={colors.inkFaint}
                />
            ) : null}
        </Pressable>
    );
}

function Divider({ colors }: { colors: Palette }) {
    return (
        <View
            style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.hair,
            }}
        />
    );
}

const styles = StyleSheet.create({
    group: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    dangerGroup: {
        // Border color is set inline at the render site with the alert-
        // tinted alpha.
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    iconTile: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    rowSub: {
        fontSize: 11.5,
        marginTop: 1,
        lineHeight: 16,
    },
    pressed: { opacity: 0.7 },
});
