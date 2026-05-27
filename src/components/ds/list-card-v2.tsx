// ListCardV2 — fixed-width tappable list card used in the "Your lists"
// horizontal-scroll row on the Lists tab.
//
// Design source: screens-lists-v2.jsx::ListCardV2 (~172-227) from the v2 FAB
// consistency / Lists redesign handoff. The card carries five pieces of
// information at a glance:
//   • a 3px top color bar (list identity)
//   • an 8px color dot + name (identity dot + label)
//   • an owner row — mono caption, optionally with a child avatar (e.g.
//     "For Mei" with Mei's initial avatar leading the line)
//   • a count row — large mono open count + "open · N done" mono caption
//   • a thin progress bar tinted to the list color
//
// Tapping the card opens List detail (`/list/[id]`). The press shape is a
// Pressable wrapper around the visual card; the card itself is 156×min116
// so a row of 5–6 cards reads as a scannable strip on a 402-wide canvas.
//
// Owner row: callers pass `owner` as the caption text. If the list is
// "for a kid" they also pass `ownerChild` (a ChildBadge will render in
// front of the caption to anchor the identity). Generic owners ("Shared",
// "Anyone", "Alex + Riley") just render the caption.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChildBadge } from '@/components/child-badge';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export type ListCardV2Child = {
    /** Display name — first initial drives the ChildBadge glyph. */
    displayName: string;
    /** Hex from CHILDREN_PALETTE. */
    color: string;
};

type Props = {
    /** Hex color carrying the list's identity. Tints the 3px top bar,
     *  the 8px name dot, and the progress fill. */
    color: string;
    /** Short list name. Single line — ellipsizes if it overflows. */
    name: string;
    /** Caption under the name — "Shared", "For Mei", "Alex + Riley", etc.
     *  Render contract: mono, ~10/inkMuted. */
    owner: string;
    /** Optional child whose avatar precedes the owner caption (e.g.
     *  Mei's badge in front of "For Mei"). */
    ownerChild?: ListCardV2Child;
    /** Open task count — the dominant numeral on the card. */
    open: number;
    /** Completed task count — sits in the mono caption next to "open". */
    done: number;
    /** 0..1 progress fraction shown as the bar fill width. */
    progress: number;
    /** Tap handler — routes to /list/[id] read-mode detail. */
    onPress: () => void;
    /** Theme palette. Callers pass `Colors[scheme]` so the card respects
     *  the active light/dark mode. */
    colors: Palette;
};

export function ListCardV2({
    color,
    name,
    owner,
    ownerChild,
    open,
    done,
    progress,
    onPress,
    colors,
}: Props) {
    // Clamp progress defensively — bad data shouldn't break the bar geometry.
    const pct = Math.max(0, Math.min(1, progress));
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${name} · ${open} open · ${done} done`}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                    borderTopColor: color,
                },
                pressed && styles.pressed,
            ]}>
            {/* Identity dot + name. The 8px dot pairs with the borderTop
                color so the card reads as that list's territory even when
                the top bar is offscreen-cropped at the row edge. */}
            <View style={styles.headerRow}>
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <ThemedText
                    numberOfLines={1}
                    style={[styles.name, { color: colors.text }]}>
                    {name}
                </ThemedText>
            </View>

            {/* Owner caption — optional child avatar in front. minHeight
                keeps every card's row spacing identical whether or not
                there's an avatar. */}
            <View style={styles.ownerRow}>
                {ownerChild ? (
                    <ChildBadge
                        name={ownerChild.displayName}
                        color={ownerChild.color}
                        size="sm"
                        style={styles.ownerAvatar}
                    />
                ) : null}
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.ownerCaption,
                        {
                            color: colors.textSecondary,
                            fontFamily: FontFamily.monoRegular,
                        },
                    ]}>
                    {owner}
                </ThemedText>
            </View>

            {/* Count row — big open numeral leading a mono caption. The
                numeral is the dominant glyph on the card; the caption
                contextualizes it and surfaces the done count without
                competing visually. */}
            <View style={styles.countRow}>
                <ThemedText
                    style={[
                        styles.openCount,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {open}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.countCaption,
                        {
                            color: colors.textSecondary,
                            fontFamily: FontFamily.monoRegular,
                        },
                    ]}>
                    open · {done} done
                </ThemedText>
            </View>

            {/* Progress bar — height:3 hairline, list-color fill on the
                inset track. Anchors at the bottom of the card so the
                scrollbar-like sliver is the last thing the eye reaches
                after the numeric summary. */}
            <View
                style={[
                    styles.progressTrack,
                    { backgroundColor: colors.backgroundInset },
                ]}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${Math.round(pct * 100)}%`,
                            backgroundColor: color,
                        },
                    ]}
                />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexShrink: 0,
        width: 156,
        minHeight: 116,
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        // borderTop gets overridden inline to carry the list color at 3px.
        borderTopWidth: 3,
        gap: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    name: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    ownerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 16,
    },
    ownerAvatar: {
        // ChildBadge size="sm" is 16 already; no extra sizing needed.
    },
    ownerCaption: {
        flex: 1,
        fontSize: 10,
        letterSpacing: -0.2,
    },
    countRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    openCount: {
        fontSize: 18,
        letterSpacing: -0.7,
    },
    countCaption: {
        flex: 1,
        fontSize: 10,
        letterSpacing: -0.1,
    },
    progressTrack: {
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    pressed: { opacity: 0.7 },
});

/**
 * NewListCard — the trailing dashed "+ New list" card in the "Your lists"
 * horizontal-scroll row. Smaller than a ListCardV2 (width 116 vs 156) and
 * dashed-border so the user reads "this is the create affordance, not a
 * real list".
 *
 * Sibling to ListCardV2 so the row's two card shapes live in one file.
 *
 * Design source: screens-lists-v2.jsx::ProListsV2 (~87-101), the trailing
 * card after the six ListCardV2 instances.
 */
export function NewListCard({
    onPress,
    colors,
}: {
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="New list"
            style={({ pressed }) => [
                newListStyles.card,
                { borderColor: colors.inkFaint },
                pressed && newListStyles.pressed,
            ]}>
            <View
                style={[
                    newListStyles.iconCircle,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <Feather name="plus" size={14} color={colors.textSecondary} />
            </View>
            <ThemedText
                style={[
                    newListStyles.label,
                    {
                        color: colors.textSecondary,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                New list
            </ThemedText>
        </Pressable>
    );
}

const newListStyles = StyleSheet.create({
    card: {
        flexShrink: 0,
        width: 116,
        minHeight: 116,
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        // RN's `borderStyle: 'dashed'` is solid for borders < 2px on some
        // Android builds, but the rest of the row's card borders are also
        // hairlines and the design source uses 0.5px dashed; we accept
        // the platform inconsistency rather than over-thicken the border.
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 10.5,
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
