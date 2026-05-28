// Web DateField + TimeField.
//
// DateField: renders a Pressable trigger and opens a Modal containing
// the MiniCalendar ds primitive. Replaces the browser-native
// <input type="date"> picker which looked out of place against the
// rest of the app's chrome (different per browser, no theming, didn't
// follow Mist Forest / Charcoal Forest palette).
//
// TimeField: now mirrors DateField — a styled Pressable trigger opens a
// Modal containing a paired hour + minute stepper UI in the app's
// design vocabulary (mono caps labels, accent ring around the selected
// digit, chevron up/down to step). Replaces the browser-native
// <input type="time"> which broke visual parity inside
// DateTimePickerSheet (date came up styled, time came up as the OS's
// native widget). Minute stepper increments in 5-minute steps; "quick
// minute" preset chips below the columns give instant access to :00
// / :15 / :30 / :45 for the common event-planning case. Closes task
// #502.

import { addMonths, format as fmt, parse, subMonths } from 'date-fns';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Feather } from '@expo/vector-icons';
import { MiniCalendar } from '@/components/ds/mini-calendar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { blurActiveElement, withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

// Union of the light + dark palette types so child components (the
// `TimeStepperColumn` helper below) can accept whichever palette the
// caller has picked. Mirrors the pattern used in MiniCalendar.
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// Width literals for the two web-only modal sheets. The translateX
// values used to center each sheet on the viewport derive from these
// (translateX = -width/2) so if the sheet width changes, the centering
// follows automatically — no more brittle "if you change 360, also
// change -180 below" coupling. translateY remains an empirical
// approximation since the sheets don't have a fixed height literal
// (content drives them).
const DATE_SHEET_WIDTH = 360;
const TIME_SHEET_WIDTH = 300;
const DATE_SHEET_VERTICAL_OFFSET = 200;
const TIME_SHEET_VERTICAL_OFFSET = 180;

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

    const open = () => {
        // Chromium warns "Blocked aria-hidden on an element because its
        // descendant retained focus" when a Modal mounts while the
        // trigger Pressable is still focused — RN-Web sets aria-hidden
        // on the background tree but the focused button is in that
        // tree. Blur first; same pattern SheetShell uses on open.
        blurActiveElement();
        setModalOpen(true);
    };
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
                {formatDisplayYmd(value) || 'Pick a date'}
            </ThemedText>
            <Feather
                name="calendar"
                size={14}
                color={colors.inkSec}
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
                                      { translateX: -DATE_SHEET_WIDTH / 2 },
                                      {
                                          translateY:
                                              -DATE_SHEET_VERTICAL_OFFSET,
                                      },
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

// ─── TimeField ────────────────────────────────────────────────────────
//
// Pressable trigger → Modal with a paired hour + minute stepper UI.
// Mirrors DateField's structural shape so DATE / TIME fields inside
// DateTimePickerSheet read as one visual family (matching button
// chrome, matching modal chrome, matching Cancel/Done button row).

type TimeProps = {
    value: string; // HH:mm
    onChange: (value: string) => void;
};

/** Parses an HH:mm string into { hour, minute } in 24-hour ranges.
 *  Returns null for invalid input — caller falls back to a default. */
function parseHm(hm: string): { hour: number; minute: number } | null {
    if (!/^\d{2}:\d{2}$/.test(hm)) return null;
    const [h, m] = hm.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { hour: h, minute: m };
}

function formatHm(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Formats HH:mm for the trigger display. Empty string when the value
 *  is unset (returns '' so the caller can show its own placeholder). */
function formatDisplayHm(hm: string): string {
    const parsed = parseHm(hm);
    if (!parsed) return '';
    return formatHm(parsed.hour, parsed.minute);
}

export function TimeField({ value, onChange }: TimeProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [modalOpen, setModalOpen] = useState(false);
    // Draft hour + minute while modal open; commits to onChange only on
    // Done. Separate from the parent's value so cancel-mid-edit doesn't
    // mutate state.
    const [draftHour, setDraftHour] = useState<number>(12);
    const [draftMinute, setDraftMinute] = useState<number>(0);

    // Seed draft from value whenever the modal opens. Without this,
    // re-opening after a cancel would resume the in-progress edit.
    useEffect(() => {
        if (!modalOpen) return;
        const parsed = parseHm(value);
        if (parsed) {
            setDraftHour(parsed.hour);
            setDraftMinute(parsed.minute);
        } else {
            // Default to noon when unset — matches DateTimePickerSheet's
            // companion-default logic for half-set state.
            setDraftHour(12);
            setDraftMinute(0);
        }
    }, [modalOpen, value]);

    const open = () => {
        blurActiveElement();
        setModalOpen(true);
    };
    const cancel = () => setModalOpen(false);
    const done = () => {
        onChange(formatHm(draftHour, draftMinute));
        setModalOpen(false);
    };

    // Hour wraps 0..23 (24-hour clock — same convention used app-wide
    // for HH:mm strings). Up = next hour, down = previous hour.
    const incHour = () => setDraftHour((h) => (h + 1) % 24);
    const decHour = () => setDraftHour((h) => (h - 1 + 24) % 24);
    // Minute steps 5 at a time (the common event-planning granularity).
    // Wraps 0..55. Users who land on a non-5 minute value (e.g. seeding
    // from an existing 16:37 event) snap to the nearest 5 on the next
    // increment via modulo + add.
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
                animationType="fade"
                onRequestClose={cancel}>
                <Pressable style={styles.backdrop} onPress={cancel} />
                <View
                    style={[
                        styles.timeSheet,
                        {
                            backgroundColor: colors.backgroundElement,
                            borderColor: colors.hair,
                        },
                        Platform.OS === 'web'
                            ? ({
                                  position: 'fixed' as unknown as 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: [
                                      { translateX: -TIME_SHEET_WIDTH / 2 },
                                      {
                                          translateY:
                                              -TIME_SHEET_VERTICAL_OFFSET,
                                      },
                                  ],
                              } as object)
                            : null,
                    ]}>
                    {/* Caps mono section header — matches the DATE / TIME
                        labels in DateTimePickerSheet so the modal reads
                        as a continuation of the form's own vocabulary. */}
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

                    {/* Hour + Minute stepper columns. Each column: up
                        chevron above, 56pt mono digit center, down
                        chevron below. Colon between columns. Selected
                        digit sits inside a hairline-bordered tile with
                        an accent-tinted bg so the focus is unmistakable
                        without screaming for attention. */}
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

                    {/* Quick-minute presets — :00 / :15 / :30 / :45 cover
                        the bulk of event start times. Tapping a chip sets
                        the minute draft directly so the user doesn't
                        have to chevron-step 5-min increments to reach
                        :30 from :00. */}
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

                    {/* Button row — Cancel left, Done right (accent).
                        Matching shape to DateField's modal so both
                        pickers read as one visual family. */}
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
    // Shared trigger chrome — DateField + TimeField both use this so
    // their side-by-side render inside DateTimePickerSheet reads as
    // two siblings of one design family. Mono medium text, calendar
    // / clock icon trailing, hairline border, card-tinted bg.
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
    // The DateField sheet is positioned in JSX (web=fixed center,
    // native default). Width is fixed so the MiniCalendar grid renders
    // at a sensible size — too narrow and the cells become tiny; too
    // wide and it looks like a desktop app.
    sheet: {
        width: DATE_SHEET_WIDTH,
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
    // ── Time picker modal ────────────────────────────────────────────
    timeSheet: {
        width: TIME_SHEET_WIDTH,
        padding: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 14,
        alignItems: 'center',
    },
    timeHeader: {
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
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
        fontSize: 9,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    // Tappable up/down chevron buttons sandwiching the value tile.
    // 32x28 hit area, hairline border, inset-tinted bg so they read as
    // controls without competing for attention with the value tile.
    timeArrowBtn: {
        width: 56,
        height: 28,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Accent-tinted hairline-bordered tile holding the 2-digit value.
    // The accent treatment (subtle bg + colored border) is the visual
    // "this is the selected number" signal — softer than fully-filled
    // accent, more emphatic than just bigger text.
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
        // 22px of top padding aligns the colon's optical center with
        // the value tiles flanking it (the tiles have label + arrow
        // above so their visual center sits lower than their bounding
        // box's center).
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
