// Native DateField / TimeField. Web has its own variant (datetime-fields.web.tsx)
// that uses <input type="date"> / <input type="time"> — the browser supplies a
// real picker for free. This file is what bundles on iOS + Android.
//
// Implementation (UX-020 fix):
//   - DateField + TimeField render a Pressable showing the formatted current
//     value (or a placeholder when empty). Tapping opens a platform-native
//     picker via @react-native-community/datetimepicker.
//   - iOS uses the inline `DateTimePicker` component inside a Modal we mount,
//     because iOS's "default" presentation is in-flow / inline rather than a
//     system modal. We wrap it in our own modal with Done/Cancel buttons so
//     the user has clear commit + dismiss controls.
//   - Android uses the imperative `DateTimePickerAndroid.open()` — no JSX
//     mount needed, the OS handles modal + commit/cancel internally.
//
// The `value` + `onChange` API matches the web variant exactly so callers stay
// platform-agnostic. Empty string means "no value picked yet" and renders a
// placeholder + opens the picker at today / now.

import DateTimePicker, {
    DateTimePickerAndroid,
    type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

// ─── Date parsing / formatting helpers ──────────────────────────────────────
// Storage shape: YYYY-MM-DD. Display shape: "Mon, May 23" (no year unless the
// year differs from the current one — keeps the field tight in most cases).

function parseYmd(ymd: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
}

function formatYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDisplayDate(ymd: string): string {
    const d = parseYmd(ymd);
    if (!d) return '';
    const today = new Date();
    const sameYear = d.getFullYear() === today.getFullYear();
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

function parseHm(hm: string): { h: number; m: number } | null {
    if (!/^\d{2}:\d{2}$/.test(hm)) return null;
    const [h, m] = hm.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { h, m };
}

function formatHm(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function formatDisplayTime(hm: string): string {
    const parsed = parseHm(hm);
    if (!parsed) return '';
    const d = new Date();
    d.setHours(parsed.h, parsed.m, 0, 0);
    return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
}

// ─── Shared field shell ─────────────────────────────────────────────────────
// Same visual treatment as the web variant — 44px tall, bordered, padded —
// so the form looks consistent across platforms.

function useFieldStyles() {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return {
        colors,
        wrapper: {
            borderColor: colors.backgroundSelected,
            borderWidth: 1,
            borderRadius: Spacing.two,
            paddingHorizontal: Spacing.three,
            justifyContent: 'center' as const,
            height: 44,
        },
    };
}

// ─── DateField ──────────────────────────────────────────────────────────────

type DateProps = {
    value: string; // YYYY-MM-DD (empty string = unset)
    onChange: (value: string) => void;
};

export function DateField({ value, onChange }: DateProps) {
    const { colors, wrapper } = useFieldStyles();
    // iOS uses the in-flow DateTimePicker component, so we mount it inside a
    // Modal we control. Android fires DateTimePickerAndroid.open() imperatively
    // and never needs a JSX mount.
    const [iosModalOpen, setIosModalOpen] = useState(false);
    // Draft value while the iOS spinner is moving but before Done is tapped.
    // Lets the user spin around and back without each tick firing onChange.
    const [iosDraft, setIosDraft] = useState<Date | null>(null);

    const currentDate = parseYmd(value) ?? new Date();
    const display = formatDisplayDate(value);

    const open = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: currentDate,
                mode: 'date',
                onChange: (event: DateTimePickerEvent, picked?: Date) => {
                    // Android fires onChange with `type === 'dismissed'` when the
                    // user cancels — in that case we keep the existing value.
                    if (event.type === 'set' && picked) {
                        onChange(formatYmd(picked));
                    }
                },
            });
            return;
        }
        setIosDraft(currentDate);
        setIosModalOpen(true);
    };

    return (
        <>
            <Pressable
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={
                    value
                        ? `Date: ${display}. Tap to change.`
                        : 'Pick a date'
                }
                style={({ pressed }) => [
                    wrapper,
                    pressed && styles.pressed,
                ]}>
                <ThemedText
                    style={{
                        color: value ? colors.text : colors.textSecondary,
                        fontSize: 16,
                    }}>
                    {display || 'Pick a date'}
                </ThemedText>
            </Pressable>
            {Platform.OS === 'ios' && iosModalOpen ? (
                <Modal
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIosModalOpen(false)}>
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => setIosModalOpen(false)}
                    />
                    <View
                        style={[
                            styles.modalSheet,
                            { backgroundColor: colors.backgroundElement },
                        ]}>
                        <DateTimePicker
                            value={iosDraft ?? currentDate}
                            mode="date"
                            display="spinner"
                            onChange={(_e, picked) => {
                                if (picked) setIosDraft(picked);
                            }}
                        />
                        <View style={styles.modalButtonRow}>
                            <Pressable
                                onPress={() => setIosModalOpen(false)}
                                style={({ pressed }) => [
                                    styles.modalButton,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    if (iosDraft) onChange(formatYmd(iosDraft));
                                    setIosModalOpen(false);
                                }}
                                style={({ pressed }) => [
                                    styles.modalButton,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                    Done
                                </ThemedText>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </>
    );
}

// ─── TimeField ──────────────────────────────────────────────────────────────

type TimeProps = {
    value: string; // HH:mm 24h (empty string = unset)
    onChange: (value: string) => void;
};

export function TimeField({ value, onChange }: TimeProps) {
    const { colors, wrapper } = useFieldStyles();
    const [iosModalOpen, setIosModalOpen] = useState(false);
    const [iosDraft, setIosDraft] = useState<Date | null>(null);

    // Construct a Date with today's date + the parsed time, so the picker has a
    // sensible starting point. Falls back to "right now" when value is empty.
    const baseDate = (() => {
        const parsed = parseHm(value);
        const d = new Date();
        if (parsed) d.setHours(parsed.h, parsed.m, 0, 0);
        return d;
    })();
    const display = formatDisplayTime(value);

    const open = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: baseDate,
                mode: 'time',
                is24Hour: false,
                onChange: (event: DateTimePickerEvent, picked?: Date) => {
                    if (event.type === 'set' && picked) {
                        onChange(formatHm(picked));
                    }
                },
            });
            return;
        }
        setIosDraft(baseDate);
        setIosModalOpen(true);
    };

    return (
        <>
            <Pressable
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={
                    value
                        ? `Time: ${display}. Tap to change.`
                        : 'Pick a time'
                }
                style={({ pressed }) => [
                    wrapper,
                    pressed && styles.pressed,
                ]}>
                <ThemedText
                    style={{
                        color: value ? colors.text : colors.textSecondary,
                        fontSize: 16,
                    }}>
                    {display || 'Pick a time'}
                </ThemedText>
            </Pressable>
            {Platform.OS === 'ios' && iosModalOpen ? (
                <Modal
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIosModalOpen(false)}>
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => setIosModalOpen(false)}
                    />
                    <View
                        style={[
                            styles.modalSheet,
                            { backgroundColor: colors.backgroundElement },
                        ]}>
                        <DateTimePicker
                            value={iosDraft ?? baseDate}
                            mode="time"
                            display="spinner"
                            onChange={(_e, picked) => {
                                if (picked) setIosDraft(picked);
                            }}
                        />
                        <View style={styles.modalButtonRow}>
                            <Pressable
                                onPress={() => setIosModalOpen(false)}
                                style={({ pressed }) => [
                                    styles.modalButton,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    if (iosDraft) onChange(formatHm(iosDraft));
                                    setIosModalOpen(false);
                                }}
                                style={({ pressed }) => [
                                    styles.modalButton,
                                    pressed && styles.pressed,
                                ]}>
                                <ThemedText style={{ color: '#6F7FA5', fontWeight: '600' }}>
                                    Done
                                </ThemedText>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    pressed: { opacity: 0.7 },
    // Bottom-sheet modal style for iOS. Backdrop captures taps outside the
    // sheet to dismiss (matches iOS conventions).
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.six,
        paddingHorizontal: Spacing.four,
        borderTopLeftRadius: Spacing.three,
        borderTopRightRadius: Spacing.three,
    },
    modalButtonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.three,
        paddingTop: Spacing.two,
    },
    modalButton: {
        paddingVertical: Spacing.two,
        paddingHorizontal: Spacing.three,
    },
});
