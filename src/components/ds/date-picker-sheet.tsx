// DatePickerSheet — date-only picker that mounts MiniCalendar directly
// inside a SheetShell, with no intermediate "trigger button → modal"
// hop. Use this instead of DateTimePickerSheet (allDay) when you want
// the calendar to BE the sheet body — tapping a row that opens this
// sheet drops the user straight onto the month grid, one tap less.
//
// Reuses the existing MiniCalendar ds primitive so the visual + a11y
// vocabulary stays consistent with DuePickerSheet, EventWhenSheet, and
// the override editor's per-date sheets.

import { addMonths, format, parse, subMonths } from 'date-fns';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Feather } from '@expo/vector-icons';
import { MiniCalendar } from './mini-calendar';
import { SheetShell } from './sheet-shell';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

function parseYmd(ymd: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const d = parse(ymd, 'yyyy-MM-dd', new Date());
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatYmd(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

export function DatePickerSheet({
    open,
    title,
    sub,
    initialDate,
    saveLabel = 'Save',
    onSave,
    onClose,
}: {
    open: boolean;
    title: string;
    /** Optional sub-line below the title — context for what the date
     *  controls (e.g. "Start of the override range"). */
    sub?: string;
    /** Seed date in YYYY-MM-DD. Empty string = unset, picker opens on
     *  today's month with no selection. */
    initialDate: string;
    /** Override the primary button label. Useful when the parent caller
     *  wants the chip to read "Set From" or "Set To" rather than the
     *  generic "Save". */
    saveLabel?: string;
    onSave: (date: string) => void;
    onClose: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Draft state — only committed on Save. Cancel discards.
    const [draft, setDraft] = useState<Date | null>(null);
    // Month being viewed. Independent of draft so the user can flip
    // months without their picked day jumping the grid around.
    const [monthAnchor, setMonthAnchor] = useState<Date>(new Date());

    // Re-seed on each open — without this, re-opening after a Cancel
    // resumes the in-progress edit, which is surprising UX.
    useEffect(() => {
        if (!open) return;
        const seed = parseYmd(initialDate) ?? new Date();
        setDraft(seed);
        setMonthAnchor(seed);
    }, [open, initialDate]);

    const handlePrimary = () => {
        if (draft) onSave(formatYmd(draft));
    };

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title={title}
            sub={sub}
            primary={saveLabel}
            secondary="Cancel"
            onPrimary={handlePrimary}
            onSecondary={onClose}
            primaryDisabled={!draft}
            height={460}>
            {/* Month header — caps mono label + prev/next arrows.
                Same chrome as the web DateField modal (datetime-fields.web)
                so the navigation feels identical everywhere a calendar
                appears. */}
            <View style={styles.monthHeader}>
                <Pressable
                    onPress={() => setMonthAnchor((m) => subMonths(m, 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    style={({ pressed }) => [
                        styles.monthNavBtn,
                        {
                            borderColor: colors.hair,
                            backgroundColor: colors.backgroundInset,
                        },
                        pressed && styles.pressed,
                    ]}>
                    <Feather
                        name="chevron-left"
                        size={14}
                        color={colors.text}
                    />
                </Pressable>
                <ThemedText
                    style={[
                        styles.monthLabel,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {format(monthAnchor, 'MMMM yyyy').toUpperCase()}
                </ThemedText>
                <Pressable
                    onPress={() => setMonthAnchor((m) => addMonths(m, 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    style={({ pressed }) => [
                        styles.monthNavBtn,
                        {
                            borderColor: colors.hair,
                            backgroundColor: colors.backgroundInset,
                        },
                        pressed && styles.pressed,
                    ]}>
                    <Feather
                        name="chevron-right"
                        size={14}
                        color={colors.text}
                    />
                </Pressable>
            </View>

            <MiniCalendar
                monthAnchor={monthAnchor}
                selected={draft}
                onSelect={(d) => {
                    setDraft(d);
                    // Auto-scroll the grid when the user taps a
                    // trailing/leading day from a neighboring month
                    // — otherwise the selection ends up in the dim
                    // cells and looks invisible.
                    if (d.getMonth() !== monthAnchor.getMonth()) {
                        setMonthAnchor(d);
                    }
                }}
                colors={colors}
            />
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 10,
    },
    monthLabel: {
        fontSize: 11,
        letterSpacing: 0.4,
        flex: 1,
        textAlign: 'center',
    },
    monthNavBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
});
