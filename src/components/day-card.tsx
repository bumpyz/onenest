// DayCard — the hero card on Home. One per day (Today, Tomorrow, and later
// days as needed). Replaces the previous "section header + flat row stack"
// pattern with a single anchored surface per day, with a 4px colored rail on
// the left that's tinted to the custodian (when separated household).
//
// Layout, top to bottom inside the card:
//
//   [LABEL]                                      [date]
//   ◯ Custodian name                             [↻ if override]
//   [⚠ N conflicts]  [📌 N for Anyone]   ← optional badge row
//   ┌─────────────────────────────────────────┐
//   │  9:00a   ⚽ Soccer practice    🟢🟡    │   ← event row (inset surface)
//   │  10:30a    Field A                      │
//   └─────────────────────────────────────────┘
//   ┌─────────────────────────────────────────┐
//   │ ▌ ☐  Pack snacks for Anna  · 8:30a · me│   ← task (HandOffCard, nested)
//   └─────────────────────────────────────────┘
//
// Empty state: "Quiet day." No CTA — keeps caregivers (no create permission)
// from seeing a button they can't use. Parents pick that thread up via the FAB,
// which is right there at the bottom of the screen.
//
// The card uses Surfaces.card (12px radius, backgroundElement fill, resting
// shadow). Inner event rows are Surfaces.inset (8px radius, page-color fill,
// no shadow). The inversion produces depth without a second drop shadow.

import { format } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { EventChildBadges } from '@/components/event-child-badges';
import { HandOffCard } from '@/components/hand-off-card';
import { ThemedText } from '@/components/themed-text';
import {
    BrandColors,
    Colors,
    Spacing,
    Surfaces,
    type ThemeColor,
} from '@/constants/theme';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { resolveCustodianOnDate } from '@/lib/custody';
import { iconForType } from '@/lib/event-types';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
import { withAlpha } from '@/lib/platform-styles';
import type {
    Child,
    CustodyOverride,
    CustodySchedule,
    Event,
    EventOccurrenceOverride,
    HouseholdMember,
    Task,
} from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] & Record<ThemeColor, string>;

export type DayCardProps = {
    day: Date;
    /** Short label rendered in caps at the top-left: "TODAY", "TOMORROW",
     *  or "TUE 27" etc. for later-in-week cards. */
    label: string;
    events: Event[];
    /** Tasks whose due_at falls on `day`. Pre-filtered by the caller. */
    tasks: Task[];
    members: HouseholdMember[];
    children: Child[];
    custodySchedule: CustodySchedule | null;
    /** Day-keyed map produced by buildOverrideMap. */
    custodyOverrideMap: Map<string, CustodyOverride>;
    /** `${eventId}|${date}` keyed map of per-occurrence overrides. */
    occurrenceOverrideMap: Map<string, EventOccurrenceOverride>;
    /** Counts surfaced as badges in the card header. Pass 0 to suppress. */
    conflictCount?: number;
    unassignedCount?: number;
    onPressEvent: (id: string, occurrenceDate: Date) => void;
    onPressTask: (task: Task) => void;
    onToggleTask: (task: Task) => void;
    onPressCustody: (dateYmd: string) => void;
};

export function DayCard({
    day,
    label,
    events,
    tasks,
    members,
    children,
    custodySchedule,
    custodyOverrideMap,
    occurrenceOverrideMap,
    conflictCount = 0,
    unassignedCount = 0,
    onPressEvent,
    onPressTask,
    onToggleTask,
    onPressCustody,
}: DayCardProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'] as Palette;
    const colorMap = memberColorMap(members);

    // Custodian → drives the left rail color + the in-card custody chip.
    // Null when household isn't separated (no custody schedule); the rail
    // falls back to accentMuted to keep the card from looking unfinished.
    const resolved = custodySchedule
        ? resolveCustodianOnDate(custodySchedule, custodyOverrideMap, day)
        : null;
    const custodianMember = resolved
        ? members.find((m) => m.profile_id === resolved.profileId) ?? null
        : null;
    const custodianColor = custodianMember
        ? colorForResponsible(custodianMember.profile_id, colorMap)
        : null;
    const railColor = custodianColor ?? BrandColors.accentMuted;

    const isEmpty = events.length === 0 && tasks.length === 0;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors[Surfaces.card.fill],
                    borderRadius: Surfaces.card.radius,
                },
                Surfaces.card.shadow,
            ]}>
            {/* Leading custodian rail. Full-bleed from top to bottom of the
                card. `overflow: hidden` on the card root ensures the rail
                tucks into the rounded corners cleanly. */}
            <View
                style={[
                    styles.rail,
                    {
                        backgroundColor: railColor,
                        borderTopLeftRadius: Surfaces.card.radius,
                        borderBottomLeftRadius: Surfaces.card.radius,
                    },
                ]}
                pointerEvents="none"
            />
            <View style={styles.cardBody}>
                {/* Header row: label + date right-aligned. */}
                <View style={styles.headerRow}>
                    <ThemedText
                        type="smallBold"
                        style={styles.headerLabel}>
                        {label}
                    </ThemedText>
                    <ThemedText
                        themeColor="textSecondary"
                        type="small"
                        style={styles.headerDate}>
                        {format(day, 'EEE · MMM d')}
                    </ThemedText>
                </View>

                {/* Custodian chip — tap to edit (opens /custody/[date]). Hidden
                    when there's no schedule (single_parent / couple households). */}
                {custodianMember && custodianColor ? (
                    <Pressable
                        onPress={() => onPressCustody(format(day, 'yyyy-MM-dd'))}
                        accessibilityRole="button"
                        accessibilityLabel={`Custody: ${custodianMember.display_name}${resolved?.isOverride ? ' (override)' : ''}. Tap to edit.`}
                        style={({ pressed }) => [
                            styles.custodyChip,
                            {
                                borderColor: custodianColor,
                                backgroundColor: withAlpha(custodianColor, 0.13),
                            },
                            pressed && styles.pressed,
                        ]}>
                        <View
                            style={[
                                styles.custodyDot,
                                { backgroundColor: custodianColor },
                            ]}
                        />
                        <ThemedText type="small" themeColor="text">
                            {resolved?.isOverride ? '↻ ' : ''}
                            {custodianMember.display_name}
                        </ThemedText>
                    </Pressable>
                ) : null}

                {/* Badge row: conflicts + unassigned. Suppressed when both 0.
                    Two badges max, both tappable in future iterations; for now
                    they're informational so the user knows to open the relevant
                    event below. */}
                {conflictCount > 0 || unassignedCount > 0 ? (
                    <View style={styles.badgeRow}>
                        {conflictCount > 0 ? (
                            <View
                                style={[
                                    styles.badge,
                                    {
                                        backgroundColor: withAlpha(
                                            BrandColors.error,
                                            0.13,
                                        ),
                                        borderColor: BrandColors.error,
                                    },
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{ color: BrandColors.error, fontWeight: '600' }}>
                                    ⚠ {conflictCount}{' '}
                                    {conflictCount === 1 ? 'conflict' : 'conflicts'}
                                </ThemedText>
                            </View>
                        ) : null}
                        {unassignedCount > 0 ? (
                            <View
                                style={[
                                    styles.badge,
                                    {
                                        backgroundColor: withAlpha(
                                            BrandColors.accent,
                                            0.13,
                                        ),
                                        borderColor: BrandColors.accent,
                                    },
                                ]}>
                                <ThemedText
                                    type="small"
                                    style={{ color: BrandColors.accent, fontWeight: '600' }}>
                                    📌 {unassignedCount} for Anyone
                                </ThemedText>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* Content stack — events first, then tasks. Empty state
                    when neither has content. */}
                {isEmpty ? (
                    <ThemedText
                        themeColor="textSecondary"
                        style={styles.emptyText}>
                        Quiet day.
                    </ThemedText>
                ) : null}

                {events.map((event) => {
                    const resolvedResponsible = resolveResponsibleProfileId({
                        event,
                        occurrenceDate: day,
                        custodySchedule,
                        custodyOverrides: custodyOverrideMap,
                        occurrenceOverrides: occurrenceOverrideMap,
                    });
                    const dotColor = colorForResponsible(
                        resolvedResponsible,
                        colorMap,
                    );
                    return (
                        <Pressable
                            key={`${event.id}-${event.starts_at}`}
                            onPress={() => onPressEvent(event.id, day)}
                            accessibilityRole="button"
                            accessibilityLabel={`Event: ${event.title}`}
                            style={({ pressed }) => [
                                styles.eventRow,
                                {
                                    backgroundColor: colors[Surfaces.inset.fill],
                                    borderRadius: Surfaces.inset.radius,
                                },
                                pressed && styles.pressed,
                            ]}>
                            {/* Event row internal layout: time column (fixed
                                width), assignee color stripe (2px), content
                                column (flex). The stripe is small and on the
                                inset surface so it doesn't fight the day card's
                                left rail visually. */}
                            <View style={styles.eventTimeCol}>
                                {event.all_day ? (
                                    <ThemedText
                                        type="small"
                                        themeColor="textSecondary">
                                        All day
                                    </ThemedText>
                                ) : (
                                    <>
                                        <ThemedText type="smallBold">
                                            {format(new Date(event.starts_at), 'h:mm a')}
                                        </ThemedText>
                                        <ThemedText
                                            type="small"
                                            themeColor="textSecondary">
                                            {format(new Date(event.ends_at), 'h:mm a')}
                                        </ThemedText>
                                    </>
                                )}
                            </View>
                            <View
                                style={[
                                    styles.eventDotCol,
                                    { backgroundColor: dotColor },
                                ]}
                            />
                            <View style={styles.eventContentCol}>
                                <View style={styles.eventTitleRow}>
                                    <ThemedText
                                        type="smallBold"
                                        numberOfLines={1}
                                        style={styles.eventTitleText}>
                                        {iconForType(event.event_type)}
                                        {iconForType(event.event_type) ? ' ' : ''}
                                        {event.title}
                                    </ThemedText>
                                    {/* The note icon below is absolutely
                                        positioned at right: 8 from the row's
                                        right edge, while this badge row sits
                                        at the inner contentCol's right edge
                                        (row padding 12). Shift the badges
                                        right by 4px so the two indicators'
                                        right edges share the same vertical
                                        line. */}
                                    <View style={styles.eventBadgesShim}>
                                        <EventChildBadges
                                            allChildren={children}
                                            childIds={event.child_ids}
                                            size="sm"
                                            maxVisible={3}
                                        />
                                    </View>
                                </View>
                                {event.location ? (
                                    <ThemedText
                                        themeColor="textSecondary"
                                        type="small"
                                        numberOfLines={1}>
                                        📍 {event.location}
                                    </ThemedText>
                                ) : null}
                            </View>
                            {event.description ? (
                                <ThemedText style={styles.eventNoteIcon}>📝</ThemedText>
                            ) : null}
                        </Pressable>
                    );
                })}

                {tasks.map((task) => (
                    <HandOffCard
                        key={task.id}
                        task={task}
                        members={members}
                        variant="nested"
                        onToggle={() => onToggleTask(task)}
                        onOpen={() => onPressTask(task)}
                    />
                ))}
            </View>
        </View>
    );
}

const RAIL_WIDTH = 4;

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        // overflow:hidden so the leading rail tucks into the rounded corners.
        overflow: 'hidden',
    },
    rail: {
        width: RAIL_WIDTH,
    },
    cardBody: {
        flex: 1,
        padding: Surfaces.card.padding,
        gap: Spacing.two,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLabel: {
        // Caps + letterSpacing = "this is a header, not body text" without
        // having to make the font huge. Matches the custody ribbon vocabulary
        // from the calendar so the two surfaces share an identity.
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    headerDate: {
        // Slight letterSpacing so the date doesn't crowd the label.
        letterSpacing: 0.3,
    },
    custodyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one + 2,
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.two,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    custodyDot: { width: 10, height: 10, borderRadius: 5 },
    badgeRow: {
        flexDirection: 'row',
        gap: Spacing.two,
        flexWrap: 'wrap',
        paddingTop: Spacing.half,
    },
    badge: {
        paddingHorizontal: Spacing.two,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    emptyText: {
        paddingTop: Spacing.one,
        paddingBottom: Spacing.one,
        fontStyle: 'italic',
    },
    // Event row layout — inset surface inside the day card. Reuses the
    // structure from the old DaySection event row (time col + dot col +
    // content col + note icon) but applies the new inset surface tokens
    // so it reads as "deeper" than its parent.
    eventRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        padding: Surfaces.inset.padding,
        gap: Spacing.two,
    },
    eventTimeCol: {
        width: 60,
        justifyContent: 'flex-start',
    },
    eventDotCol: {
        width: 3,
        borderRadius: 1.5,
    },
    eventContentCol: { flex: 1, gap: 2 },
    eventTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one + 2,
    },
    eventTitleText: { flex: 1 },
    // Pushes EventChildBadges 4px right so its right edge sits flush with the
    // note icon's right anchor (right: 8 below) rather than at the inset row
    // padding's 12px boundary. The two indicators then share a vertical line
    // — child badges top-right of the row, note icon bottom-right of the row.
    eventBadgesShim: { marginRight: -4 },
    eventNoteIcon: {
        position: 'absolute',
        right: 8,
        bottom: 6,
        fontSize: 12,
    },
    pressed: { opacity: 0.7 },
});
