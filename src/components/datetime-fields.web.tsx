// Web DateField + TimeField.
//
// DateField (rewritten): renders a Pressable trigger and opens a Modal
// containing our MiniCalendar ds primitive. Replaces the previous
// browser-native <input type="date"> picker which looked out of place
// against the rest of the app's chrome (different per browser, no
// theming, didn't follow Mist Forest / Charcoal Forest palette).
// MiniCalendar already powers DuePickerSheet + EventWhenSheet so the
// visual + a11y vocabulary stays consistent across every date picker.
//
// TimeField: still uses <input type="time"> for now. Time pickers have
// their own UX wrinkles (12h vs 24h, AM/PM, scroll wheels) and the
// browser-native picker is acceptable on web for the surfaces that
// use it. Track a follow-up if cross-platform parity becomes important.

import { addMonths, format as fmt, parse, subMonths } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Feather } from '@expo/vector-icons';
import { MiniCalendar } from '@/components/ds/mini-calendar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

/** Render-prop API exposed by `renderTrigger`. Mirrors the native
 *  variant so callers stay platform-agnostic. */
export type DateFieldTriggerProps = {
    open: () => void;
    value: string;
    display: string;
};

type DateProps = {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    /** Optional render-prop override. When provided, the caller renders
     *  its own trigger chrome and invokes the picker via `open()`. */
    renderTrigger?: (api: DateFieldTriggerProps) => React.ReactNode;
};

function parseYmd(ymd: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const dt = parse(ymd, 'yyyy-MM-dd', new Date());
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatYmd(date: Date): string {
    return fmt(date, 'yyyy-MM-dd');
}

function formatDisplayYmd(ymd: string): string {
    const d = parseYmd(ymd);
    if (!d) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

export function DateField({ value, onChange, renderTrigger }: DateProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [modalOpen, setModalOpen] = useState(false);
    // Draft date while modal open; commits to onChange only on Done.
    const [draft, setDraft] = useState<Date | null>(null);
    // Month being viewed — independent of draft so the user can flip
    // months without snapping back to the selected day.
    const [monthAnchor, setMonthAnchor] = useState<Date>(new Date());

    // Seed draft + monthAnchor whenever the modal opens. Without this,
    // re-opening after a cancel would resume the in-progress edit.
    useEffect(() => {
        if (!modalOpen) return;
        const seed = parseYmd(value) ?? new Date();
        setDraft(seed);
        setMonthAnchor(seed);
    }, [modalOpen, value]);

    const open = () => setModalOpen(true);
    const cancel = () => setModalOpen(false);
    const done = () => {
        if (draft) onChange(formatYmd(draft));
        setModalOpen(false);
    };

    const trigger = renderTrigger ? (
        renderTrigger({
            open,
            value,
            display: formatDisplayYmd(value),
        })
    ) : (
        <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel={
                value
                    ? `Date: ${formatDisplayYmd(value)}. Tap to change.`
                    : 'Pick a date'
            }
            style={({ pressed }) => [
                styles.fieldWrapper,
                {
                    borderColor: colors.backgroundSelected,
                },
                pressed && styles.pressed,
            ]}>
            <ThemedText
                style={{
                    color: value ? colors.text : colors.textSecondary,
                    fontSize: 16,
                    flex: 1,
                }}>
                {formatDisplayYmd(value) || 'Pick a date'}
            </ThemedText>
            <Feather
                name="calendar"
                size={16}
                color={colors.textSecondary}
            />
        </Pressable>
    );

    return (
        <>
            {trigger}
            <Modal
                visible={modalOpen}
                transparent
                animationType="fade"
                onRequestClose={cancel}>
                <Pressable style={styles.backdrop} onPress={cancel} />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.backgroundElement,
                            borderColor: colors.hair,
                        },
                        // Web-only: use fixed positioning + center so the
                        // sheet floats above content instead of sliding
                        // from the bottom like the iOS variant. Matches
                        // typical desktop modal placement.
                        Platform.OS === 'web'
                            ? ({
                                  position: 'fixed' as unknown as 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: [
                                      { translateX: -180 },
                                      { translateY: -200 },
                                  ],
                              } as object)
                            : null,
                    ]}>
                    {/* Month header — caps mono label + prev/next arrows. */}
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
                            {fmt(monthAnchor, 'MMMM yyyy').toUpperCase()}
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
                            // Keep the user's month in sync — if they tap
                            // a trailing/leading day from a neighboring
                            // month, scroll the grid to that month so the
                            // selection isn't hidden in the dim cells.
                            if (d.getMonth() !== monthAnchor.getMonth()) {
                                setMonthAnchor(d);
                            }
                        }}
                        colors={colors}
                    />

                    {/* Button row — Cancel left, Done right (accent). */}
                    <View style={styles.buttonRow}>
                        <Pressable
                            onPress={cancel}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            style={({ pressed }) => [
                                styles.btn,
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={{
                                    color: colors.inkSec,
                                    fontWeight: '500',
                                }}>
                                Cancel
                            </ThemedText>
                        </Pressable>
                        <Pressable
                            onPress={done}
                            accessibilityRole="button"
                            accessibilityLabel="Done"
                            disabled={!draft}
                            style={({ pressed }) => [
                                styles.btn,
                                styles.btnPrimary,
                                {
                                    backgroundColor: colors.accent,
                                },
                                !draft && { opacity: 0.5 },
                                pressed && draft && styles.pressed,
                            ]}>
                            <ThemedText
                                style={{
                                    color: colors.onAccent,
                                    fontWeight: '600',
                                }}>
                                Done
                            </ThemedText>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </>
    );
}

// ─── TimeField (unchanged — keeps the browser-native time picker on web) ──

type TimeProps = {
    value: string; // HH:mm
    onChange: (value: string) => void;
};

export function TimeField({ value, onChange }: TimeProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                color: colors.text,
                background: 'transparent',
                border: `1px solid ${colors.backgroundSelected}`,
                borderRadius: Spacing.two,
                padding: `0 ${Spacing.three}px`,
                fontSize: 16,
                height: 44,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                width: '100%',
            }}
        />
    );
}

const styles = StyleSheet.create({
    fieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        height: 44,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    // The sheet is positioned in JSX (web=fixed center, native default).
    // Width is fixed so the MiniCalendar grid renders at a sensible size
    // — too narrow and the cells become tiny; too wide and it looks
    // like a desktop app.
    sheet: {
        width: 360,
        padding: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
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
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
    },
    btn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    btnPrimary: {
        // accent bg set inline at use site
    },
    pressed: { opacity: 0.7 },
});
