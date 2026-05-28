// CustodyWeekBar — the 7-day custody visualization used by every custody
// surface in the v2 design (Today strip, Family Hub hero, schedule viewer,
// pattern-editor preview). Single primitive so the visual vocabulary stays
// identical across surfaces and a future palette change touches one file.
//
// Design source: design_handoff_custody_surfaces — CustodyStripToday
// (~589-616), FamilyHubV2 hero (~904-919), CustodyScheduleV2 (~115-128),
// CustodyPatternEditor preview (~223-251).
//
// Color treatment per the README (Cross-cutting tokens section):
//   • Top border: 2px solid <color> (full saturation)
//   • Body: <color> + alpha — light mode 0x33 (~20%), dark mode 0x5C (~36%)
//
// Hand-off marker (optional): a 5×24 warn-color tick on a specific day
// index, anchored to that column's right edge with a 1.5px bg-color
// outline so it reads against the bar.
//
// Today marker (optional): a 5×5 dark dot above the bar, centered on the
// today column. Today's day label below renders bolder.

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type CustodyWeekDay = {
    /** Per-day fill color (parent identity color). */
    color: string;
    /** Optional sub-label override (e.g. handoff time). Day-of-week is
     *  default; pass an explicit label if you want anything else. */
    label?: string;
};

export type CustodyWeekBarSize = 'sm' | 'md' | 'lg';

export function CustodyWeekBar({
    days,
    todayIndex,
    handoffIndex,
    handoffIndices,
    size = 'md',
    /** Override default M-S day labels. Length must match `days`. */
    labels,
    /** Hide the day-of-week row underneath the bars. */
    hideDayLabels,
}: {
    /** Always 7 entries — one per day of the week (Mon-first). */
    days: CustodyWeekDay[];
    /** Index 0-6 of "today". Renders a dark dot above the column +
     *  bolds the day label. Omit when not viewing the current week. */
    todayIndex?: number;
    /** Index 0-6 where a hand-off happens. Renders the warn-color tick
     *  per the editor preview design (CustodyPatternEditor:235-241). */
    handoffIndex?: number;
    /** Multi-handoff variant — for cycle patterns (2-2-3, 2-2-5-5,
     *  3-4-4-3) where the rotation flips on several days per week.
     *  When set, takes precedence over the single `handoffIndex`.
     *  Each entry renders the same warn-color tick on that column. */
    handoffIndices?: ReadonlyArray<number>;
    size?: CustodyWeekBarSize;
    labels?: ReadonlyArray<string>;
    hideDayLabels?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const isDark = scheme === 'dark';

    // Per-size dimensions. Today strip uses sm; Family Hub hero uses md;
    // schedule viewer uses lg; editor preview uses sm. Spec values from
    // each design surface inline.
    const dims =
        size === 'lg'
            ? { height: 26, gap: 3, dayLabelGap: 4 }
            : size === 'sm'
              ? { height: 14, gap: 3, dayLabelGap: 4 }
              : { height: 20, gap: 3, dayLabelGap: 4 };

    // Body alpha — design uses different hex suffixes per palette mode
    // (0x33 light / 0x5C dark) so the bar reads against each page bg.
    const bodyAlpha = isDark ? 0x5c / 255 : 0x33 / 255;

    // Multi-tick wins over single. Build a Set for O(1) per-column lookup
    // so the inner loop stays linear regardless of how many handoffs the
    // caller passes (cycle patterns can legitimately have 3+).
    const handoffSet =
        handoffIndices && handoffIndices.length > 0
            ? new Set(handoffIndices)
            : null;

    return (
        <View style={styles.wrap}>
            <View style={[styles.row, { gap: dims.gap }]}>
                {days.map((d, i) => {
                    const isToday = i === todayIndex;
                    const isHandoff = handoffSet
                        ? handoffSet.has(i)
                        : i === handoffIndex;
                    return (
                        <View
                            key={i}
                            style={styles.col}>
                            {/* Today dot — sits above the bar so it doesn't
                                fight the color. Centered via flex column. */}
                            {isToday ? (
                                <View
                                    style={[
                                        styles.todayDot,
                                        { backgroundColor: colors.text },
                                    ]}
                                />
                            ) : (
                                <View style={styles.todayDotSpacer} />
                            )}
                            <View
                                style={[
                                    styles.bar,
                                    {
                                        height: dims.height,
                                        backgroundColor: withAlpha(
                                            d.color,
                                            bodyAlpha,
                                        ),
                                        borderTopWidth: 2,
                                        borderTopColor: d.color,
                                    },
                                ]}>
                                {/* Hand-off marker — 5×24 warn tick at
                                    the column's right edge, with a 1.5px
                                    bg-color outline so it reads clean
                                    against the bar fill. */}
                                {isHandoff ? (
                                    <View
                                        style={[
                                            styles.handoffMarker,
                                            {
                                                backgroundColor: colors.warn,
                                                borderColor: colors.background,
                                            },
                                        ]}
                                    />
                                ) : null}
                            </View>
                            {!hideDayLabels ? (
                                <ThemedText
                                    style={[
                                        styles.dayLabel,
                                        {
                                            color: isToday
                                                ? colors.text
                                                : colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoMedium,
                                            fontWeight: isToday
                                                ? '700'
                                                : '500',
                                            marginTop: dims.dayLabelGap,
                                        },
                                    ]}>
                                    {labels?.[i] ?? DAY_LABELS[i]}
                                </ThemedText>
                            ) : null}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {},
    row: { flexDirection: 'row' },
    col: { flex: 1, alignItems: 'center' },
    bar: {
        width: '100%',
        borderRadius: 3,
        position: 'relative',
    },
    todayDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginBottom: 2,
    },
    // Spacer matches the dot's footprint so all columns share the same
    // y-baseline regardless of whether they have a today dot.
    todayDotSpacer: { width: 5, height: 5, marginBottom: 2 },
    handoffMarker: {
        position: 'absolute',
        right: -2,
        top: -3,
        width: 5,
        height: 24,
        borderRadius: 1,
        borderWidth: 1.5,
    },
    dayLabel: {
        fontSize: 9,
        letterSpacing: -0.2,
    },
});
