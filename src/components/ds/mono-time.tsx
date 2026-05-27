// MonoTime — the 2-line monospace time block that anchors every event row in
// the redesign. Top line = start time bold, bottom line = end time muted.
// All numerals are mono per the handoff spec ("9:00a / 10:30a" pattern).
//
// Used in: Home timeline event rows, Calendar day-view event rows, Event
// Detail title hero, Hand-off Day card.
//
// For all-day events pass `allDay`. The block then renders a single "All day"
// label sized to match the timed-event block's height (so columns align).

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    /** Start time string. Format however you want — this component does not
     *  format. Examples: "9:00a", "09:00", "9:00 AM". */
    start: string;
    /** End time string. Same format expectations as `start`. Optional — if
     *  omitted, only the start line renders. */
    end?: string;
    /** Switches to a single "All day" line. `start` and `end` are ignored. */
    allDay?: boolean;
};

export function MonoTime({ start, end, allDay = false }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    if (allDay) {
        return (
            <View style={styles.col}>
                <ThemedText
                    style={[
                        styles.start,
                        { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                    ]}>
                    All day
                </ThemedText>
            </View>
        );
    }
    return (
        <View style={styles.col}>
            <ThemedText
                style={[
                    styles.start,
                    // Start time gets SemiBold — it's the primary anchor of the
                    // event row, so it carries more weight than the end time.
                    { color: colors.text, fontFamily: FontFamily.monoSemiBold },
                ]}>
                {start}
            </ThemedText>
            {end ? (
                <ThemedText
                    style={[
                        styles.end,
                        { color: colors.textSecondary, fontFamily: FontFamily.monoMedium },
                    ]}>
                    {end}
                </ThemedText>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    col: {
        // Fixed width so a vertical column of times line up — the designs use
        // ~52px so 4-digit times don't shift their right edge.
        width: 52,
        gap: 1,
    },
    start: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    end: {
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: -0.1,
    },
});
