// HandOffCard — a single task surfaced as a card with a leading color band tied
// to the assignee. Replaces the flat row-style task rendering on both Home
// (nested inside Day Cards) and Lists (standalone).
//
// Two variants share the layout:
//   • standalone — used on Lists. Card has its own resting shadow + sits on the
//                  page background.
//   • nested    — used inside a Day Card. No shadow, "inset" surface (page color
//                  inside a card surface) so it reads as deeper than its parent.
//
// The leading color band is the strongest visual signal — at a glance you see
// who owns the task. Pulls from the assignee's profile color; falls back to
// BrandColors.accentMuted for Anyone tasks (a task anyone can grab).
//
// Completed state: the row dims to 0.55 opacity, title strikes through, and the
// color band drains to backgroundSelected — three coordinated signals that the
// row is done. The strikethrough alone wasn't carrying enough weight before.

import { format, parseISO } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors, Colors, Spacing, Surfaces } from '@/constants/theme';
import { CARD_SHADOW, withAlpha } from '@/lib/platform-styles';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import type { HouseholdMember, Task } from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';

export type HandOffCardVariant = 'standalone' | 'nested';

export type HandOffCardProps = {
    task: Task;
    members: HouseholdMember[];
    /** 'standalone' → has own shadow + sits on page bg; 'nested' → no shadow,
     *  page-colored inset surface inside a parent card. */
    variant?: HandOffCardVariant;
    /** Toggle completion. Wrapped by the leading checkbox. */
    onToggle: () => void;
    /** Tap the body to navigate (event detail, task detail, etc.). Pass
     *  undefined to make the body non-interactive. */
    onOpen?: () => void;
    /** When true, the subtitle's due-date label includes day-of-week. Pass
     *  true outside of "today" contexts where "Tue · 8:30a" beats "8:30a"
     *  alone. */
    showDay?: boolean;
};

export function HandOffCard({
    task,
    members,
    variant = 'standalone',
    onToggle,
    onOpen,
    showDay = false,
}: HandOffCardProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const done = !!task.completed_at;

    // Leading-band color = assignee color, or accentMuted for Anyone. When the
    // task has multiple assignees, the first one's color wins — visual signal
    // for "who's primary" without trying to render multiple colored bands in
    // a 3px-wide rail (which would just be mush).
    const colorMap = memberColorMap(members);
    const primaryAssignee = task.assignee_profile_ids[0];
    const liveBandColor = primaryAssignee
        ? colorForResponsible(primaryAssignee, colorMap)
        : BrandColors.accentMuted;
    const bandColor = done ? colors.backgroundSelected : liveBandColor;

    // Assignee label: "Anyone" | "<Name>" | "<Name> +<count>"
    const assigneeNames = task.assignee_profile_ids
        .map((id) => members.find((m) => m.profile_id === id)?.display_name)
        .filter((n): n is string => !!n);
    const assigneeLabel =
        assigneeNames.length === 0
            ? 'Anyone'
            : assigneeNames.length === 1
              ? assigneeNames[0]
              : `${assigneeNames[0]} +${assigneeNames.length - 1}`;

    const dueLabel = task.due_at
        ? format(
              parseISO(task.due_at),
              showDay ? 'EEE · h:mm a' : 'h:mm a',
          )
        : null;

    // Surface vocabulary: standalone variant lifts off the page with the
    // resting shadow; nested variant inverts to page color inside its parent
    // card and skips the shadow entirely.
    const surface = variant === 'standalone' ? Surfaces.card : Surfaces.inset;
    const bodyBackground = colors[surface.fill];

    const cardStyle = [
        styles.card,
        {
            borderRadius: surface.radius,
            backgroundColor: bodyBackground,
        },
        variant === 'standalone' ? CARD_SHADOW : null,
        done && styles.cardDone,
    ];

    return (
        <View style={cardStyle}>
            {/* Leading color band — full bleed from card top to card bottom. */}
            <View
                style={[
                    styles.band,
                    {
                        backgroundColor: bandColor,
                        // Match the card's outer radius on the left edge so
                        // the band tucks into the rounded corners cleanly.
                        borderTopLeftRadius: surface.radius,
                        borderBottomLeftRadius: surface.radius,
                    },
                ]}
                pointerEvents="none"
            />
            {/* Checkbox — stays its own pressable so the body tap stays
                navigational. */}
            <Pressable
                onPress={onToggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={done ? 'Mark task incomplete' : 'Mark task complete'}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={({ pressed }) => [
                    styles.checkbox,
                    {
                        backgroundColor: done ? BrandColors.accent : 'transparent',
                        borderColor: done ? BrandColors.accent : colors.backgroundSelected,
                    },
                    pressed && styles.pressed,
                ]}>
                {done ? <ThemedText style={styles.check}>✓</ThemedText> : null}
            </Pressable>
            {/* Body — title + meta. Disabled press fall-through when onOpen is
                undefined (e.g. caregiver-completed task where there's nowhere
                useful to go). */}
            <Pressable
                onPress={onOpen}
                disabled={!onOpen}
                style={({ pressed }) => [
                    styles.body,
                    pressed && onOpen && styles.pressed,
                ]}>
                <ThemedText
                    type="smallBold"
                    numberOfLines={2}
                    style={
                        done
                            ? {
                                  textDecorationLine: 'line-through',
                                  color: colors.textSecondary,
                              }
                            : undefined
                    }>
                    {task.title}
                </ThemedText>
                <ThemedText
                    themeColor="textSecondary"
                    type="small"
                    numberOfLines={1}>
                    {dueLabel ? `${dueLabel} · ` : ''}
                    {assigneeLabel}
                </ThemedText>
            </Pressable>
        </View>
    );
}

const BAND_WIDTH = 3;

const styles = StyleSheet.create({
    // The card is a flex row: [band] [checkbox] [body]. The band uses width
    // (not padding) so the colored region is exactly 3px regardless of font
    // metrics. Min-height keeps short titles from collapsing to a line that
    // doesn't read as a card.
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 56,
        overflow: 'hidden',
    },
    cardDone: { opacity: 0.55 },
    band: {
        width: BAND_WIDTH,
        // height implicit via alignItems: 'stretch' on the row.
    },
    checkbox: {
        // Sits in the column between the band and the body. Vertical pad gives
        // the box visual weight without growing the row height.
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: Spacing.three,
        marginVertical: Spacing.two + 2, // pull toward vertical center
    },
    check: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
    body: {
        flex: 1,
        paddingVertical: Spacing.two + 2,
        paddingLeft: Spacing.two + 2,
        paddingRight: Spacing.three,
        gap: 2,
    },
    pressed: { opacity: 0.7 },
});

// Re-export for selective overrides if a caller needs them. (None today.)
export { withAlpha };
