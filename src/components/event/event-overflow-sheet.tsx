// EventOverflowSheet — the ••• kebab destination on EventDetail.
// Design source: `docs/design-handoffs/event-responsible/screens-event-edit.jsx`
// `EventOverflowSheet` (recurring, ~26-103) and `EventOverflowSheetOneOff`
// (one-off, ~370-440).
//
// Two variants — selected based on whether the event has a recurrence
// rule:
//
//   • Recurring (4 grouped cards, height 620):
//     1. THIS EVENT REPEATS — Edit only this / Edit all future / Skip this
//     2. ACTIONS            — Duplicate / Copy to another day /
//                             Convert to task / Reassign across custody
//                             (conditional on conflict) / Export as .ics
//     3. VISIBILITY         — Who can see this / Mark as private
//     4. Destructive        — Delete this occurrence / Delete entire series
//
//   • One-off (3 grouped cards, height 500): same as recurring minus the
//     recurrence group, and the destructive group has just one row:
//     "Delete event · Cannot be undone".
//
// Wiring policy — match the TaskOverflowSheet precedent: ship the
// destructive paths (which have real handlers) and stub everything else
// as "coming soon" alerts. The deferred actions are tracked under follow-
// up task #413 (this file's companion task).

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { deleteEvent, type Event } from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export function EventOverflowSheet({
    open,
    onClose,
    onDeleted,
    event,
    occurrenceDate,
    hasConflict,
}: {
    open: boolean;
    onClose: () => void;
    /** Called after a successful delete so the parent can navigate
     *  back to whatever pushed the detail screen. */
    onDeleted: () => void;
    /** The event being shown. Used for header copy (title + when) and
     *  to decide recurring vs one-off variant. */
    event: Event;
    /** YYYY-MM-DD from the calling URL — present when the user opened
     *  detail from a Calendar tap on a specific instance. Threaded
     *  back into /edit so the form's apply-to toggle has context.
     *  Null for direct-link opens, in which case the recurrence group's
     *  copy still works ("today's occurrence") but the actions only
     *  affect the series. */
    occurrenceDate: string | null;
    /** True when the calendar conflict resolver flagged this event for
     *  the lead responsible parent. Drives the conditional "Reassign
     *  across custody" row — hidden when there's no conflict to fix. */
    hasConflict: boolean;
}) {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const isRecurring = !!event.recurrence_rule;

    // Generic "coming soon" handler factory — same Alert pattern for every
    // deferred action. Mirrors TaskOverflowSheet's pattern exactly so a
    // future user research pass sees consistent stub copy across the
    // app's two kebab surfaces.
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

    // Two "edit" branches both route to the same /edit form — the
    // difference is which apply-to mode the form opens in. The form
    // doesn't yet support a "future" mode (only series + occurrence),
    // so "Edit all future" stubs until #411 follow-up lands that
    // option. "Edit only this" pre-fills the date param so the user
    // can flip the toggle to occurrence without re-establishing
    // context.
    const handleEditOnlyThis = () => {
        onClose();
        if (occurrenceDate) {
            router.push({
                pathname: '/event/[id]/edit',
                params: { id: event.id, date: occurrenceDate },
            });
        } else {
            // Without a date context the "only this" semantics don't
            // apply — fall through to the regular series edit.
            router.push({
                pathname: '/event/[id]/edit',
                params: { id: event.id },
            });
        }
    };

    // Delete handlers — separate confirm flows for occurrence vs series.
    // Conflating them is dangerous per the spec README: surfacing them
    // as distinct rows means the user can't accidentally nuke a year of
    // weekly piano lessons when they meant to skip one Tuesday.
    const handleDeleteSeries = async () => {
        const confirmed = await confirmDestructive(
            'Delete entire series?',
            'All future occurrences will be removed. Cannot be undone.',
            'Delete series',
        );
        if (!confirmed) return;
        try {
            await deleteEvent(event.id);
            onDeleted();
            onClose();
        } catch (err) {
            const msg = errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't delete: ${msg}`);
            else Alert.alert("Couldn't delete", msg);
        }
    };

    // Same handler reused for the one-off variant's "Delete event" row —
    // semantically identical to deleting "the series" of a one-instance
    // event, just with friendlier copy.
    const handleDeleteOneOff = async () => {
        const confirmed = await confirmDestructive(
            'Delete this event?',
            'Removes the event for everyone. Cannot be undone.',
            'Delete',
        );
        if (!confirmed) return;
        try {
            await deleteEvent(event.id);
            onDeleted();
            onClose();
        } catch (err) {
            const msg = errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't delete: ${msg}`);
            else Alert.alert("Couldn't delete", msg);
        }
    };

    // Hero sub-line for the sheet — design source uses the event's time
    // + recurrence label. Mirrors what the EventDetail hero shows for
    // consistency between the sheet and the screen behind it.
    const sub = isRecurring
        ? `${event.title} · Repeating event`
        : event.title;

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title={event.title}
            sub="Event actions"
            // Recurring sheet adds Group 1 (~136px) over the one-off
            // variant; spec heights 620 vs 500 respectively.
            height={isRecurring ? 620 : 500}
            secondary="Cancel"
            onSecondary={onClose}>
            {/* GROUP 1 · Recurrence — only when the event has a rule.
                Spec: "This question every user asks when editing a
                repeating event. Surfacing it as an explicit branching
                choice — before the action — is much clearer than
                burying it in a confirmation dialog after they tap
                Edit." */}
            {isRecurring ? (
                <>
                    <GroupLabel colors={colors}>
                        This event repeats
                    </GroupLabel>
                    <View
                        style={[
                            styles.group,
                            {
                                backgroundColor: colors.backgroundInset,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <OverflowRow
                            icon="calendar"
                            label="Edit only this occurrence"
                            sub={
                                occurrenceDate
                                    ? `${occurrenceDate} · won't affect future occurrences`
                                    : "Won't affect future occurrences"
                            }
                            onPress={handleEditOnlyThis}
                            colors={colors}
                        />
                        <Divider colors={colors} />
                        <OverflowRow
                            icon="rotate-ccw"
                            label="Edit all future occurrences"
                            sub={
                                occurrenceDate
                                    ? `From ${occurrenceDate} onwards`
                                    : 'From the next occurrence onwards'
                            }
                            onPress={() =>
                                showComingSoon(
                                    'Edit all future occurrences',
                                    "Editing the future-only slice of a recurring event is coming soon. For now, use 'Edit only this occurrence' for one-time tweaks or open the event to edit the whole series.",
                                )
                            }
                            colors={colors}
                        />
                        <Divider colors={colors} />
                        <OverflowRow
                            icon="skip-forward"
                            label="Skip this occurrence"
                            sub={
                                occurrenceDate
                                    ? `Hide ${occurrenceDate} · series continues`
                                    : 'Series continues'
                            }
                            onPress={() =>
                                showComingSoon(
                                    'Skip this occurrence',
                                    'Hiding a single occurrence of a recurring event is coming soon — it needs a new override flag we haven’t built yet. For now, delete the whole series and re-create it without the skipped date if needed.',
                                )
                            }
                            colors={colors}
                            last
                        />
                    </View>
                </>
            ) : null}

            {/* GROUP 2 · ACTIONS — same row set for recurring + one-off. */}
            <GroupLabel
                colors={colors}
                extraTop={isRecurring ? 14 : 0}>
                Actions
            </GroupLabel>
            <View
                style={[
                    styles.group,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <OverflowRow
                    icon="copy"
                    label="Duplicate"
                    sub="Make a copy with same time, who, and lists"
                    onPress={() =>
                        showComingSoon(
                            'Duplicate',
                            'Event duplication is coming soon. We’ll copy the time, responsible parents, location, and attached tasks into a fresh event.',
                        )
                    }
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="calendar"
                    label="Copy to another day"
                    sub="Same time on a different date"
                    onPress={() =>
                        showComingSoon(
                            'Copy to another day',
                            '"Do this again on Tuesday" is coming soon. For now, duplicate the event manually and edit the date.',
                        )
                    }
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="check-square"
                    label="Convert to task"
                    sub="Drop the time block, keep details"
                    onPress={() =>
                        showComingSoon(
                            'Convert to task',
                            'Converting an event to a task is coming soon. For now, create a task manually and link it from the event.',
                        )
                    }
                    colors={colors}
                />
                {/* Reassign — accent-tinted row, only visible when the
                    conflict resolver flags this event. Per spec: pre-
                    computed suggestion is shown in the sub when known.
                    Stubbed for now; full conflict-resolution flow lives
                    under #299 Phase 12. */}
                {hasConflict ? (
                    <>
                        <Divider colors={colors} />
                        <OverflowRow
                            icon="shuffle"
                            label="Reassign across custody"
                            sub="Try moving the responsibility to clear the conflict"
                            accent
                            onPress={() =>
                                showComingSoon(
                                    'Reassign across custody',
                                    'Automatic reassignment to clear conflicts is coming soon (Phase 12). For now, open Edit and change the Responsible parent manually.',
                                )
                            }
                            colors={colors}
                        />
                    </>
                ) : null}
                <Divider colors={colors} />
                <OverflowRow
                    icon="download"
                    label="Export as .ics"
                    sub="For sharing outside OneNest"
                    onPress={() =>
                        showComingSoon(
                            'Export as .ics',
                            'Exporting an event to a calendar file (.ics) is coming soon. Use it to share to anyone outside your household — they get a one-tap "Add to calendar" link.',
                        )
                    }
                    colors={colors}
                    last
                />
            </View>

            {/* GROUP 3 · VISIBILITY. */}
            <GroupLabel colors={colors} extraTop={14}>
                Visibility
            </GroupLabel>
            <View
                style={[
                    styles.group,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <OverflowRow
                    icon="eye"
                    label="Who can see this"
                    sub="Open the event to change who is tagged"
                    onPress={() => {
                        onClose();
                        // Tagging IS the visibility primitive (per the
                        // multi-responsible design — README Part 2). So
                        // "Who can see this" routes to the Responsible
                        // field in /edit. Once #412 ships, this becomes
                        // a direct EventResponsibleSheet open instead.
                        router.push({
                            pathname: '/event/[id]/edit',
                            params: occurrenceDate
                                ? { id: event.id, date: occurrenceDate }
                                : { id: event.id },
                        });
                    }}
                    colors={colors}
                />
                <Divider colors={colors} />
                <OverflowRow
                    icon="lock"
                    label="Mark as private"
                    sub="External co-parents see 'Busy', not the title"
                    onPress={() =>
                        showComingSoon(
                            'Mark as private',
                            'Per-event privacy is coming soon. The event will still appear on the calendar as a Busy block, but the title, location, and notes are hidden from anyone not tagged as Responsible.',
                        )
                    }
                    colors={colors}
                    last
                />
            </View>

            {/* GROUP 4 · Destructive. Faint alert-tinted border so the
                card visually separates from neutral groups above without
                shouting. Recurring events get two rows; one-off events
                get a single Delete row. */}
            <View
                style={[
                    styles.group,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: withAlpha(colors.alert, 0x33 / 255),
                        marginTop: 14,
                    },
                ]}>
                {isRecurring ? (
                    <>
                        <OverflowRow
                            icon="trash-2"
                            label="Delete this occurrence"
                            sub={
                                occurrenceDate
                                    ? `${occurrenceDate} only · series continues`
                                    : 'This date only · series continues'
                            }
                            danger
                            onPress={() =>
                                showComingSoon(
                                    'Delete this occurrence',
                                    'Removing a single occurrence of a recurring event needs the same override flag as Skip — both are coming soon. For now, use Delete entire series, or open Edit and switch to "this occurrence only".',
                                )
                            }
                            colors={colors}
                        />
                        <Divider colors={colors} />
                        <OverflowRow
                            icon="trash-2"
                            label="Delete entire series"
                            sub="All future occurrences · cannot be undone"
                            danger
                            onPress={handleDeleteSeries}
                            colors={colors}
                            last
                        />
                    </>
                ) : (
                    <OverflowRow
                        icon="trash-2"
                        label="Delete event"
                        sub="Cannot be undone"
                        danger
                        onPress={handleDeleteOneOff}
                        colors={colors}
                        last
                    />
                )}
            </View>
        </SheetShell>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Caps-mono group label above each card group. `extraTop` adds margin
 *  above the label when the group sits below another group's card —
 *  same rhythm as TaskOverflowSheet. */
function GroupLabel({
    children,
    colors,
    extraTop,
}: {
    children: string;
    colors: Palette;
    extraTop?: number;
}) {
    return (
        <ThemedText
            style={[
                styles.groupLabel,
                {
                    color: colors.textSecondary,
                    fontFamily: FontFamily.monoSemiBold,
                    marginTop: extraTop ?? 0,
                },
            ]}>
            {children}
        </ThemedText>
    );
}

/** Cross-platform destructive confirm. Mirrors the helper in
 *  TaskOverflowSheet — keeping them inline rather than lifting to a
 *  shared lib because the copy is bespoke per surface. */
async function confirmDestructive(
    title: string,
    message: string,
    destructiveText: string,
): Promise<boolean> {
    if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return false;
        return window.confirm(`${title}\n\n${message}`);
    }
    return new Promise<boolean>((resolve) => {
        Alert.alert(title, message, [
            {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
            },
            {
                text: destructiveText,
                style: 'destructive',
                onPress: () => resolve(true),
            },
        ]);
    });
}

function OverflowRow({
    icon,
    label,
    sub,
    danger,
    accent,
    last,
    onPress,
    colors,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    sub?: string;
    /** Destructive variant: alert color label + tinted icon tile + no chevron. */
    danger?: boolean;
    /** Accent variant (e.g. "Reassign"): accent label + tinted icon tile. */
    accent?: boolean;
    last?: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    const iconColor = danger
        ? colors.alert
        : accent
          ? colors.accent
          : colors.text;
    const labelColor = iconColor;
    const tileBg = danger
        ? withAlpha(colors.alert, 0x14 / 255)
        : accent
          ? withAlpha(colors.accent, 0x18 / 255)
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
            {/* Per spec: chevron omitted on destructive rows (their tap
                opens a confirm dialog, not a destination). Accent and
                neutral rows both keep the chevron. */}
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
    groupLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
        paddingBottom: 6,
    },
    group: {
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
    iconTile: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowBody: { flex: 1 },
    rowLabel: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    rowSub: {
        fontSize: 11.5,
        lineHeight: 16,
        marginTop: 1,
    },
    pressed: { opacity: 0.6 },
});
