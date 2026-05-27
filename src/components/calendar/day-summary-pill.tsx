// DaySummaryPill — at-a-glance count chip rendered in a row above the
// Day view's hour grid. Surfaces "4 events / 1 conflict / 1 hand-off /
// 2 tasks" so the user gets the day's shape without scanning the grid.
//
// Design source: onenest-spec-v3/design_handoff_calendar_conflicts/
//   screens-extra-5.jsx lines 287-292 (the row layout) + 371-411
//   (the DaySummaryPill helper).
//
// The pill renders only when `count > 0` — the spec shows non-zero
// values, and zero counts read as visual noise ("0 conflicts" is the
// same information as no pill at all, but takes a slot). The Day
// branch's row uses gap+flexWrap so absent pills don't leave gaps.
//
// Three tone variants drive the tint:
//   - `warn`   → C.warn (conflicts; calls attention to a problem)
//   - `accent` → C.accent (tasks; calls attention to actionable work)
//   - default  → C.inkSec (events + hand-offs; informational)
// The default uses a slightly weaker 15% fill (`tint+15` in the spec)
// vs. warn/accent's 22% — so the warn / accent pills carry more visual
// weight while informational pills sit calmly in the row.

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';

export type DaySummaryPillIcon = 'events' | 'conflict' | 'handoff' | 'tasks';
type Tone = 'default' | 'warn' | 'accent';

// Maps the design's four icon kinds to Feather equivalents. The spec
// uses inline SVG paths; Feather covers the same visual concepts and
// keeps the icon vocabulary consistent with the rest of the app.
const ICON_FOR: Record<DaySummaryPillIcon, React.ComponentProps<typeof Feather>['name']> = {
    events: 'calendar',
    conflict: 'alert-triangle',
    handoff: 'refresh-cw',
    tasks: 'check',
};

// Tone implies tint color + which alpha to use for the fill. Border is
// always tint at 27% (`44` in hex = 0x44/0xFF ≈ 0.267) so every pill
// reads as part of the same family even when the tint differs.
const TONE_FOR: Record<DaySummaryPillIcon, Tone> = {
    events: 'default',
    conflict: 'warn',
    handoff: 'default',
    tasks: 'accent',
};

// Structural type for the three theme tokens we read. Lets the
// component accept either `Colors.light` or `Colors.dark` (or any
// future palette) without depending on the concrete literal type — the
// `as const` palette declarations make those mutually incompatible
// otherwise. Parent screens already hold the full `colors` object;
// destructuring would force them to spread, which loses some clarity
// at the call site.
type ThemeTokens = {
    warn: string;
    accent: string;
    textSecondary: string;
};

export function DaySummaryPill({
    icon,
    label,
    colors,
    style,
}: {
    icon: DaySummaryPillIcon;
    label: string;
    /** Resolved theme tokens. Passed in so the pill stays a leaf
     *  component without re-reading the color scheme — the parent
     *  (calendar.tsx) already has `colors` in scope. */
    colors: ThemeTokens;
    style?: ViewStyle;
}) {
    const tone = TONE_FOR[icon];
    const tint =
        tone === 'warn'
            ? colors.warn
            : tone === 'accent'
              ? colors.accent
              : colors.textSecondary;
    // Warn/accent get 22% fill (more eye-catching); informational gets
    // 15% (calmer). Border always 27%. Matches spec lines 401-402.
    const bgAlpha = tone === 'default' ? 0x15 / 255 : 0x22 / 255;
    const borderAlpha = 0x44 / 255;

    return (
        <View
            style={[
                styles.pill,
                {
                    backgroundColor: withAlpha(tint, bgAlpha),
                    borderColor: withAlpha(tint, borderAlpha),
                },
                style,
            ]}>
            <Feather name={ICON_FOR[icon]} size={11} color={tint} />
            <ThemedText
                style={[
                    styles.label,
                    { color: tint, fontFamily: FontFamily.monoSemiBold },
                ]}>
                {label}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
});
