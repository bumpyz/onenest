// MiniCalendar — month-grid date picker used inside field-edit sheets.
//
// Lifted out of DuePickerSheet (#406) so EventWhenSheet + DuePickerSheet
// (and any future date-picker sheet) share one source of truth for the
// visual + a11y vocabulary. 6×7 grid covering the visible month, with the
// pre/trailing days from neighboring months rendered in a muted tone.
// Today gets an accent ring; selected gets a filled accent cell.
//
// API:
//   monthAnchor — the month to render (defaults to today). The grid starts
//     on the Sunday of the week containing this date's month's first day.
//   selected — the highlighted day (or null for no selection).
//   onSelect — fired with a new Date when a cell is tapped. Callers own
//     time-of-day preservation; this primitive only cares about the day.
//
// Design source: screens-task-edit.jsx MiniCalendar (~568-628).

import {
    addDays,
    addMonths,
    isSameDay,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export function MiniCalendar({
    monthAnchor,
    selected,
    onSelect,
    colors,
}: {
    /** Date whose month is rendered. The grid starts at the Sunday of the
     *  week containing this month's first day. */
    monthAnchor?: Date;
    /** Selected day (or null for no selection). */
    selected: Date | null;
    /** Fired when a cell is tapped. Callers preserve time-of-day. */
    onSelect: (day: Date) => void;
    colors: Palette;
}) {
    const now = new Date();
    const anchor = monthAnchor ?? now;
    const monthStart = startOfMonth(anchor);
    // App convention: weeks start on Monday everywhere — Calendar week
    // view, custody-band strips, schedule viewer all use weekStartsOn: 1.
    // The date pickers were the only Sunday-first surface; this aligns
    // them with the rest of the app so users don't see two different
    // week orderings.
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
        days.push(addDays(gridStart, i));
    }
    const monthEnd = addMonths(monthStart, 1);
    return (
        <View
            style={[
                styles.cal,
                {
                    backgroundColor: colors.backgroundInset,
                    borderColor: colors.hair,
                },
            ]}>
            <View style={styles.calHeader}>
                {/* Monday-first day labels matching the app's
                    week-orientation convention (Calendar, custody-band
                    strip, schedule viewer all start Monday). Letters
                    stay disambiguated — Tu/Th split the two Tuesdays-
                    Thursday collision, Sa/Su split the weekend. */}
                {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'].map((d) => (
                    <ThemedText
                        key={d}
                        style={[
                            styles.calHeaderCell,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        {d}
                    </ThemedText>
                ))}
            </View>
            <View style={styles.calGrid}>
                {days.map((d) => {
                    const inMonth =
                        d.getMonth() === monthStart.getMonth() && d < monthEnd;
                    const isSelected = !!selected && isSameDay(d, selected);
                    const isToday = isSameDay(d, now);
                    return (
                        <Pressable
                            key={d.toISOString()}
                            onPress={() => onSelect(d)}
                            accessibilityRole="button"
                            accessibilityLabel={d.toLocaleDateString(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                            })}
                            style={({ pressed }) => [
                                styles.calCell,
                                {
                                    backgroundColor: isSelected
                                        ? colors.accent
                                        : 'transparent',
                                    borderColor:
                                        !isSelected && isToday
                                            ? colors.accent
                                            : 'transparent',
                                },
                                pressed && !isSelected && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.calCellText,
                                    {
                                        color: isSelected
                                            ? colors.onAccent
                                            : isToday
                                              ? colors.accent
                                              : inMonth
                                                ? colors.text
                                                : colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                        fontWeight:
                                            isSelected || isToday
                                                ? '600'
                                                : '500',
                                    },
                                ]}>
                                {d.getDate()}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    cal: {
        padding: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    calHeader: {
        flexDirection: 'row',
        gap: 3,
        marginBottom: 4,
    },
    calHeaderCell: {
        flex: 1,
        fontSize: 9,
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    calGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
    },
    calCell: {
        flexBasis: '13.5%',
        flexGrow: 1,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calCellText: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
