// OverridePreviewBar — DEFAULT vs WITH OVERRIDE side-by-side strip
// shown at the top of the NewOverride editor. Pairs a header
// (PREVIEW · WK 23 · Jun 1-7  +  N DAYS · M KIDS pill) with two
// 7-column day rows: the default schedule, dimmed on dates the
// override touches; and the proposed schedule, with an accent ring +
// dot on changed days.
//
// Design source: screens-custody.jsx NewOverride preview block
// (~lines 1104-1182).

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type PreviewDay = {
    /** Per-day fill color (resolved custodian's identity color, or
     *  the shared token on 'AB' days). */
    color: string;
    /** True when the override changes this column. The DEFAULT row
     *  renders affected cells dimmed; the OVERRIDE row renders them
     *  with the accent ring + dot. */
    affected: boolean;
};

export function OverridePreviewBar({
    headerLabel,
    chipLabel,
    defaultDays,
    overrideDays,
}: {
    /** Top-left mono caps — e.g. "PREVIEW · WK 23 · JUN 1-7". */
    headerLabel: string;
    /** Top-right accent-tinted pill — e.g. "2 DAYS · 2 KIDS". */
    chipLabel: string;
    /** Length 7. Default-schedule colors per day, with affected days
     *  flagged so the renderer can dim them. */
    defaultDays: ReadonlyArray<PreviewDay>;
    /** Length 7. Proposed-schedule colors per day, with affected
     *  days flagged for the accent ring + dot treatment. */
    overrideDays: ReadonlyArray<PreviewDay>;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const isDark = scheme === 'dark';
    // Bar body alpha mirrors CustodyWeekBar's spec — 0x33 light, 0x5C dark.
    const bodyAlpha = isDark ? 0x5c / 255 : 0x33 / 255;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.hair,
                },
            ]}>
            <View style={styles.header}>
                <ThemedText
                    style={[
                        styles.headerLabel,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {headerLabel.toUpperCase()}
                </ThemedText>
                <View
                    style={[
                        styles.chip,
                        {
                            backgroundColor: withAlpha(
                                colors.accent,
                                0x18 / 255,
                            ),
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.chipLabel,
                            {
                                color: colors.accent,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        {chipLabel.toUpperCase()}
                    </ThemedText>
                </View>
            </View>

            {/* DEFAULT row */}
            <ThemedText
                style={[
                    styles.rowLabel,
                    {
                        color: colors.inkFaint,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                DEFAULT
            </ThemedText>
            <View style={styles.barRow}>
                {defaultDays.map((d, i) => (
                    <View key={i} style={styles.col}>
                        <View
                            style={[
                                styles.bar,
                                {
                                    backgroundColor: withAlpha(
                                        d.color,
                                        bodyAlpha,
                                    ),
                                    borderTopColor: d.color,
                                    opacity: d.affected ? 0.45 : 1,
                                },
                            ]}
                        />
                        <ThemedText
                            style={[
                                styles.dayLabel,
                                {
                                    color: d.affected
                                        ? colors.inkFaint
                                        : colors.inkSec,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            {DAY_LABELS[i]}
                        </ThemedText>
                    </View>
                ))}
            </View>

            {/* OVERRIDE row */}
            <ThemedText
                style={[
                    styles.rowLabel,
                    {
                        color: colors.accent,
                        fontFamily: FontFamily.monoSemiBold,
                        marginTop: 8,
                    },
                ]}>
                WITH OVERRIDE
            </ThemedText>
            <View style={styles.barRow}>
                {overrideDays.map((d, i) => (
                    <View key={i} style={styles.col}>
                        {/* Dot above the bar for changed columns —
                            anchors the eye + matches the design. */}
                        {d.affected ? (
                            <View
                                style={[
                                    styles.changedDot,
                                    { backgroundColor: colors.accent },
                                ]}
                            />
                        ) : (
                            <View style={styles.changedDotSpacer} />
                        )}
                        <View
                            style={[
                                styles.bar,
                                {
                                    backgroundColor: withAlpha(
                                        d.color,
                                        bodyAlpha,
                                    ),
                                    borderTopColor: d.color,
                                },
                                // Accent ring on changed columns. Built
                                // with a 1.5px outline color + the
                                // bg-color inset so the ring reads
                                // clean against neighboring bars.
                                d.affected && {
                                    borderWidth: 1.5,
                                    borderColor: colors.accent,
                                    // Re-apply the top accent so the
                                    // ring doesn't lose the identity
                                    // marker on the top edge.
                                    borderTopColor: colors.accent,
                                },
                            ]}
                        />
                        <ThemedText
                            style={[
                                styles.dayLabel,
                                {
                                    color: d.affected
                                        ? colors.accent
                                        : colors.inkSec,
                                    fontFamily: FontFamily.monoMedium,
                                    fontWeight: d.affected ? '600' : '500',
                                },
                            ]}>
                            {DAY_LABELS[i]}
                        </ThemedText>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
    },
    chip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    chipLabel: {
        fontSize: 10,
        letterSpacing: 0.3,
    },
    rowLabel: {
        fontSize: 9.5,
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    barRow: {
        flexDirection: 'row',
        gap: 3,
    },
    col: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    bar: {
        width: '100%',
        height: 18,
        borderRadius: 3,
        borderTopWidth: 2,
    },
    dayLabel: {
        fontSize: 9,
        letterSpacing: -0.2,
    },
    changedDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginBottom: 2,
    },
    changedDotSpacer: {
        width: 4,
        height: 4,
        marginBottom: 2,
    },
});
