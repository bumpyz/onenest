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
import { Colors, FontFamily } from '@/constants/theme';
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
            height={allDay ? 320 : 380}>
            <View style={styles.body}>
                <View style={styles.field}>
                    <ThemedText
                        style={[
                            styles.label,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        DATE
                    </ThemedText>
                    <DateField value={date} onChange={setDate} />
                </View>
                {!allDay ? (
                    <View style={styles.field}>
                        <ThemedText
                            style={[
                                styles.label,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            TIME
                        </ThemedText>
                        <TimeField value={time} onChange={setTime} />
                    </View>
                ) : null}
            </View>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    body: { gap: 14 },
    field: { gap: 8 },
    label: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
});
