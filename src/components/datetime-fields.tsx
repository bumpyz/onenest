// Native DateField + TimeField. Web has its own variant (datetime-fields.web.tsx)
// that uses the same pattern but with web-modal positioning.
//
// Both DateField and TimeField render a Pressable trigger that opens a
// Modal containing a custom in-app picker UI:
//   • DateField → MiniCalendar (our ds primitive) with a month-nav header
//     and Cancel/Done buttons.
//   • TimeField → paired hour/minute stepper columns + ":00/:15/:30/:45"
//     quick presets + Cancel/Done buttons.
//
// Both replace the platform's native date/time pickers (#502 + #503 close
// out the cross-platform unification). Rationale:
//   1. The OS pickers look out of place against the rest of the app's
//      chrome — different per platform, no theming, don't follow our
//      Mist Forest / Charcoal Forest palette.
//   2. The hour/minute stepper is the same pattern used inside the
//      DueDateSheet (event reminders), so users see one unified date
//      / time vocabulary across the app.
//   3. We already ship the MiniCalendar primitive; reusing it here means
//      a future palette refresh ripples to every date picker in one place.
//
// Presentation:
//   • Native (iOS + Android): bottom-sheet modal sliding from below.
//     Matches platform conventions for transient pickers.
//   • Web (datetime-fields.web.tsx): centered overlay matching desktop
//     modal conventions. Same picker bodies, different shell.
//
// The `value` + `onChange` API matches the web variant exactly so callers
// stay platform-agnostic. Empty string means "no value picked yet" and
// renders a placeholder; the picker opens at today / noon.

import { Feather } from '@expo/vector-icons';
import { addMonths, format as fmt, parse, subMonths } from 'date-fns';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { MiniCalendar } from '@/components/ds/mini-calendar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

// Union of the light + dark palette types so child components (the
// `TimeStepperColumn` helper below) can accept whichever palette the
// caller has picked. Mirrors the pattern used in MiniCalendar.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// ─── Date parsing / formatting helpers ──────────────────────────────────────
// Storage shape: YYYY-MM-DD. Display shape: "Mon, May 23" (no year unless the
// year differs from the current one — keeps the field tight in most cases).

function parseYmd(ymd: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const dt = parse(ymd, 'yyyy-MM-dd', new Date());
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatYmd(date: Date): string {
    return fmt(date, 'yyyy-MM-dd');
}

function formatDisplayDate(ymd: string): string {
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

function parseHm(hm: string): { hour: number; minute: number } | null {
    if (!/^\d{2}:\d{2}$/.test(hm)) return null;
    const [h, m] = hm.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { hour: h, minute: m };
}

function formatHm(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDisplayHm(hm: string): string {
    const parsed = parseHm(hm);
    if (!parsed) return '';
    return formatHm(parsed.hour, parsed.minute);
}

// ─── DateField ──────────────────────────────────────────────────────────────

/** Render-prop API exposed by `renderTrigger`. Callers get the open()
 *  function plus the current YYYY-MM-DD value and the human-formatted
 *  display string so they can compose their own button chrome (e.g. a
 *  FormRow with a chevron) and still trigger the picker. */
export type DateFieldTriggerProps = {
    open: () => void;
    value: string;
    display: string;
};

type DateProps = {
    value: string; // YYYY-MM-DD (empty string = unset)
    onChange: (value: string) => void;
    /** Optional render-prop override. When provided, the caller renders
     *  its own trigger chrome and invokes the picker by calling `open()`. */
    renderTrigger?: (api: DateFieldTriggerProps) => React.ReactNode;
};

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

    const display = formatDisplayDate(value);

    return (
        <>
            {renderTrigger ? (
                renderTrigger({ open, value, display })
            ) : (
                <Pressable
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={
                        value
                            ? `Date: ${display}. Tap to change.`
                            : 'Pick a date'
                    }
                    style={({ pressed }) => [
                        styles.fieldWrapper,
                        {
                            borderColor: colors.hair,
                            backgroundColor: colors.backgroundElement,
                        },
                        pressed && styles.pressed,
                    ]}>
                    <ThemedText
                        style={{
                            color: value ? colors.text : colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                            fontSize: 13,
                            letterSpacing: -0.2,
                            flex: 1,
                        }}>
                        {display || 'Pick a date'}
                    </ThemedText>
                    <Feather name="calendar" size={14} color={colors.inkSec} />
                </Pressable>
            )}

            <Modal
                visible={modalOpen}
                transparent
                animationType="slide"
                onRequestClose={cancel}>
                <Pressable style={styles.backdrop} onPress={cancel} />
                <View
                    style={[
                        styles.sheetNative,
                        {
                            backgroundColor: colors.backgroundElement,
                            borderColor: colors.hair,
                        },
                    ]}>
                    {/* Month header — caps mono label + prev/next arrows. */}
                    <View style={styles.monthHeader}>
                        <Pressable
                            onPress={() =>
                                setMonthAnchor((m) => subMonths(m, 1))
                            }
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
                            onPress={() =>
                                setMonthAnchor((m) => addMonths(m, 1))
                            }
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
                            if (d.getMonth() !== monthAnchor.getMonth()) {
                                setMonthAnchor(d);
                            }
                        }}
                        colors={colors}
                    />

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
                                { backgroundColor: colors.accent },
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

// ─── TimeField ────────────────────────────────────────────────────────
//
// Same Pressable trigger pattern → Modal with hour/minute stepper UI.
// Matches the web variant's design exactly so a DATE / TIME field row
// inside DateTimePickerSheet reads as one visual family across platforms.

type TimeProps = {
    value: string; // HH:mm 24h (empty string = unset)
    onChange: (value: string) => void;
};

export function TimeField({ value, onChange }: TimeProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [modalOpen, setModalOpen] = useState(false);
    const [draftHour, setDraftHour] = useState<number>(12);
    const [draftMinute, setDraftMinute] = useState<number>(0);

    useEffect(() => {
        if (!modalOpen) return;
        const parsed = parseHm(value);
        if (parsed) {
            setDraftHour(parsed.hour);
            setDraftMinute(parsed.minute);
        } else {
            setDraftHour(12);
            setDraftMinute(0);
        }
    }, [modalOpen, value]);

    const open = () => setModalOpen(true);
    const cancel = () => setModalOpen(false);
    const done = () => {
        onChange(formatHm(draftHour, draftMinute));
        setModalOpen(false);
    };

    // Hour wraps 0..23 (24-hour clock — same convention used app-wide).
    const incHour = () => setDraftHour((h) => (h + 1) % 24);
    const decHour = () => setDraftHour((h) => (h - 1 + 24) % 24);
    // Minute steps 5 at a time (the common event-planning granularity).
    // Wraps 0..55. Users who land on a non-5 minute value snap to the
    // nearest 5 on the next increment.
    const incMinute = () =>
        setDraftMinute((m) => (Math.floor(m / 5) * 5 + 5) % 60);
    const decMinute = () =>
        setDraftMinute((m) => {
            const base = Math.ceil(m / 5) * 5;
            return (base - 5 + 60) % 60;
        });

    const display = formatDisplayHm(value);

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
                    styles.fieldWrapper,
                    {
                        borderColor: colors.hair,
                        backgroundColor: colors.backgroundElement,
                    },
                    pressed && styles.pressed,
                ]}>
                <ThemedText
                    style={{
                        color: value ? colors.text : colors.inkFaint,
                        fontFamily: FontFamily.monoMedium,
                        fontSize: 13,
                        letterSpacing: -0.2,
                        flex: 1,
                    }}>
                    {display || 'Pick a time'}
                </ThemedText>
                <Feather name="clock" size={14} color={colors.inkSec} />
            </Pressable>

            <Modal
                visible={modalOpen}
                transparent
                animationType="slide"
                onRequestClose={cancel}>
                <Pressable style={styles.backdrop} onPress={cancel} />
                <View
                    style={[
                        styles.timeSheetNative,
                        {
                            backgroundColor: colors.backgroundElement,
                            borderColor: colors.hair,
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.timeHeader,
                            {
                                color: colors.inkFaint,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        PICK A TIME
                    </ThemedText>

                    <View style={styles.timeCols}>
                        <TimeStepperColumn
                            label="HOUR"
                            value={draftHour}
                            onIncrement={incHour}
                            onDecrement={decHour}
                            colors={colors}
                        />
                        <ThemedText
                            style={[
                                styles.timeColon,
                                {
                                    color: colors.inkSec,
                                    fontFamily: FontFamily.monoSemiBold,
                                },
                            ]}>
                            :
                        </ThemedText>
                        <TimeStepperColumn
                            label="MIN"
                            value={draftMinute}
                            onIncrement={incMinute}
                            onDecrement={decMinute}
                            colors={colors}
                        />
                    </View>

                    <View style={styles.timePresets}>
                        {[0, 15, 30, 45].map((m) => {
                            const active = draftMinute === m;
                            return (
                                <Pressable
                                    key={m}
                                    onPress={() => setDraftMinute(m)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Set minute to ${m}`}
                                    style={({ pressed }) => [
                                        styles.timePreset,
                                        {
                                            backgroundColor: active
                                                ? withAlpha(
                                                      colors.accent,
                                                      0x18 / 255,
                                                  )
                                                : colors.backgroundInset,
                                            borderColor: active
                                                ? withAlpha(
                                                      colors.accent,
                                                      0x66 / 255,
                                                  )
                                                : colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={{
                                            color: active
                                                ? colors.accent
                                                : colors.inkSec,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                            fontSize: 11,
                                            letterSpacing: 0.3,
                                        }}>
                                        :{String(m).padStart(2, '0')}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>

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
                            style={({ pressed }) => [
                                styles.btn,
                                { backgroundColor: colors.accent },
                                pressed && styles.pressed,
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

/** One stepper column inside the time picker — caps mono sub-label,
 *  up chevron, padded 2-digit value tile, down chevron. */
function TimeStepperColumn({
    label,
    value,
    onIncrement,
    onDecrement,
    colors,
}: {
    label: string;
    value: number;
    onIncrement: () => void;
    onDecrement: () => void;
    colors: Palette;
}) {
    return (
        <View style={styles.timeCol}>
            <ThemedText
                style={[
                    styles.timeColLabel,
                    {
                        color: colors.inkFaint,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                {label}
            </ThemedText>
            <Pressable
                onPress={onIncrement}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${label.toLowerCase()}`}
                style={({ pressed }) => [
                    styles.timeArrowBtn,
                    {
                        borderColor: colors.hair,
                        backgroundColor: colors.backgroundInset,
                    },
                    pressed && styles.pressed,
                ]}>
                <Feather name="chevron-up" size={14} color={colors.text} />
            </Pressable>
            <View
                style={[
                    styles.timeValueTile,
                    {
                        borderColor: withAlpha(colors.accent, 0x66 / 255),
                        backgroundColor: withAlpha(
                            colors.accent,
                            0x0e / 255,
                        ),
                    },
                ]}>
                <ThemedText
                    style={[
                        styles.timeValueText,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {String(value).padStart(2, '0')}
                </ThemedText>
            </View>
            <Pressable
                onPress={onDecrement}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${label.toLowerCase()}`}
                style={({ pressed }) => [
                    styles.timeArrowBtn,
                    {
                        borderColor: colors.hair,
                        backgroundColor: colors.backgroundInset,
                    },
                    pressed && styles.pressed,
                ]}>
                <Feather name="chevron-down" size={14} color={colors.text} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    // Shared trigger chrome — mirrors the web variant exactly so DATE
    // and TIME fields side-by-side inside DateTimePickerSheet read as
    // siblings of one design family across all three platforms.
    fieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        height: 40,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    // Bottom-sheet shell for native — slides from below, fills the
    // viewport width minus a comfortable side margin, rounded top
    // corners so it reads as a sheet. Bottom padding adds breathing
    // room above the home-bar / nav-bar.
    sheetNative: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        paddingBottom: 32,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    timeSheetNative: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        paddingBottom: 32,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 14,
        alignItems: 'center',
    },
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    monthLabel: {
        ...Typography.monoCaps,
        fontSize: 11,
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
        alignSelf: 'stretch',
    },
    btn: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
    },
    timeHeader: {
        ...Typography.monoCaps,
        fontSize: 11,
        alignSelf: 'center',
    },
    timeCols: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    timeCol: {
        alignItems: 'center',
        gap: 6,
    },
    timeColLabel: {
        ...Typography.monoCaps,
        fontSize: 9,
    },
    timeArrowBtn: {
        width: 56,
        height: 28,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeValueTile: {
        width: 56,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeValueText: {
        fontSize: 26,
        letterSpacing: -0.5,
        fontWeight: '600',
    },
    timeColon: {
        fontSize: 26,
        fontWeight: '600',
        marginTop: 22,
    },
    timePresets: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    timePreset: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    pressed: { opacity: 0.7 },
});
