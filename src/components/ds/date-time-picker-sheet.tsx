// DateTimePickerSheet — single-shot date+time picker rendered inside
// a SheetShell. Used by EventCreate's When section ("Starts" / "Ends"
// FormRow chevrons → tap opens this sheet, Save commits both pieces).
//
// Composes the existing DateField + TimeField primitives so we get
// native pickers on iOS / Android and the HTML date/time inputs on
// web for free. The sheet keeps draft state local and only fires
// `onSave` when the user confirms — escape / cancel discards.
//
// When `allDay` is true the TimeField is hidden and the row reads as
// a single-line date picker (matches the canvas behavior where
// Starts/Ends collapse to date-only on all-day events).

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField, TimeField } from '@/components/datetime-fields';
import { ThemedText } from '@/components/themed-text';
import { Colors, Typography } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

import { SheetShell } from './sheet-shell';

type Props = {
    open: boolean;
    title: string;
    /** Optional sub-text below the title. */
    sub?: string;
    /** Initial YYYY-MM-DD. Empty string = unset, picker defaults to today. */
    initialDate: string;
    /** Initial HH:MM (24h). Empty string = unset, picker defaults to noon. */
    initialTime: string;
    /** When true, the TimeField is hidden and only the date is editable. */
    allDay?: boolean;
    /** Save label override. Defaults to "Save". */
    saveLabel?: string;
    onSave: (next: { date: string; time: string }) => void;
    onClose: () => void;
};

export function DateTimePickerSheet({
    open,
    title,
    sub,
    initialDate,
    initialTime,
    allDay = false,
    saveLabel = 'Save',
    onSave,
    onClose,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [date, setDate] = useState(initialDate);
    const [time, setTime] = useState(initialTime);

    // Re-seed on each open so a previous edit can't leak into a fresh
    // open — the standard sheet-draft pattern used app-wide.
    useEffect(() => {
        if (open) {
            setDate(initialDate);
            setTime(initialTime);
        }
    }, [open, initialDate, initialTime]);

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title={title}
            sub={sub}
            primary={saveLabel}
            secondary="Cancel"
            onPrimary={() => onSave({ date, time })}
            onSecondary={onClose}
            height={allDay ? 260 : 300}>
            <View style={styles.body}>
                {/* Each field is a horizontal row: caps mono label on
                    the left (fixed 56px so DATE and TIME line up
                    vertically across the two rows), picker control fills
                    the remaining width on the right. Tighter than the
                    prior stacked layout (label above, picker below)
                    since the label takes ~16px of vertical real estate
                    per row that we now reclaim. */}
                <View style={styles.fieldRow}>
                    <ThemedText
                        style={[styles.label, { color: colors.inkFaint }]}>
                        DATE
                    </ThemedText>
                    <View style={styles.fieldControl}>
                        <DateField value={date} onChange={setDate} />
                    </View>
                </View>
                {!allDay ? (
                    <View style={styles.fieldRow}>
                        <ThemedText
                            style={[styles.label, { color: colors.inkFaint }]}>
                            TIME
                        </ThemedText>
                        <View style={styles.fieldControl}>
                            <TimeField value={time} onChange={setTime} />
                        </View>
                    </View>
                ) : null}
            </View>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    // 10px between the two field rows — tighter than the prior 14
    // since each row is now ~28px tall instead of the stacked layout's
    // ~52px (label + 8px gap + control), and the overall sheet feels
    // padded enough without extra inter-row breathing room.
    body: { gap: 10 },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    // Fixed-width label slot so DATE and TIME align vertically across
    // both rows (different glyph counts otherwise drift the picker's
    // leading edge). Typography is the shared Typography.monoCaps preset
    // — same vocabulary used by event-form fieldMonoLabel and
    // event-task-section metaLabel.
    label: {
        ...Typography.monoCaps,
        width: 56,
    },
    fieldControl: { flex: 1 },
});
