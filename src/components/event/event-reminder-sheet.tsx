// EventReminderSheet — EventForm "Remind me" field-edit sheet.
// Sister of components/task/reminder-picker-sheet.tsx; same SheetShell
// radio-list shape, but bound to event_reminders.offset_minutes (#308)
// instead of tasks.reminder_at.
//
// Anchor: event's wall-clock start (date + startTime in the event's tz).
// The sheet stays pure — it doesn't read or write the DB. It surfaces the
// user's pick as a signed offset (0 = at start, -15 = 15 min before, etc.)
// and the EventForm submit path persists via setEventRemindersFor.
//
// We intentionally don't ship a Custom… row in v1 — picking an arbitrary
// instant is #419 territory and would need a dedicated DateTimePicker
// embed. The presets cover the realistic cases (5/15/30/60/120/1440 min
// before, plus "at start time" and "Off").
//
// Offset convention: signed minutes relative to the event start. Negative
// = fire before the event (the common case). Schema (migration 0053)
// allows up to ±10080 (one week). The picker only exposes the standard
// "before" presets; the column itself supports more if a future picker
// needs them.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

import { RadioBubble } from '../task/radio-bubble';

/** Preset offsets shown in the picker, in minute units. Negative =
 *  before the event start. We render them as the canonical list:
 *  "Off" (null), "At start" (0), then a descending list of negative
 *  presets that get rendered as "5 min before" / "15 min before" etc.
 *  Keep order stable — the sub-label code expects this. */
const PRESET_OFFSETS: number[] = [0, -5, -15, -30, -60, -120, -1440];

/** Human label for a preset offset. 0 → "At start time"; -1440 → "1 day
 *  before"; -120 → "2 hours before"; otherwise "N min before". */
function presetLabel(offset: number): string {
    if (offset === 0) return 'At start time';
    const abs = Math.abs(offset);
    if (abs % 1440 === 0) {
        const days = abs / 1440;
        return days === 1 ? '1 day before' : `${days} days before`;
    }
    if (abs % 60 === 0) {
        const hours = abs / 60;
        return hours === 1 ? '1 hour before' : `${hours} hours before`;
    }
    return `${abs} min before`;
}

/** Compute the wall-clock fire time for a given offset, anchored to the
 *  event's date + startTime. Returns a "HH:mm" string for same-day
 *  offsets and "MMM d · HH:mm" when the offset crosses a date boundary
 *  (e.g. "1 day before" of a 09:00 event → previous date · 09:00). */
function fireLabel(
    offset: number,
    date: string,
    startTime: string,
): string | null {
    // Compose a Date from the YYYY-MM-DD + HH:mm. Local-time parse —
    // matches how EventForm renders other time values to the user.
    const composed = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(composed.getTime())) return null;
    const fired = new Date(composed.getTime() + offset * 60_000);
    if (Number.isNaN(fired.getTime())) return null;
    const hh = fired.getHours().toString().padStart(2, '0');
    const mm = fired.getMinutes().toString().padStart(2, '0');
    const sameDay =
        fired.getFullYear() === composed.getFullYear() &&
        fired.getMonth() === composed.getMonth() &&
        fired.getDate() === composed.getDate();
    if (sameDay) return `${hh}:${mm}`;
    const MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${MONTHS[fired.getMonth()]} ${fired.getDate()} · ${hh}:${mm}`;
}

export function EventReminderSheet({
    open,
    onClose,
    onSave,
    value,
    eventDate,
    eventStartTime,
    allDay,
}: {
    open: boolean;
    onClose: () => void;
    /** Emits the chosen offset (in minutes, signed) or null for "Off". */
    onSave: (offset: number | null) => void;
    /** Currently persisted offset, null = no reminder. */
    value: number | null;
    /** YYYY-MM-DD — event start date, used for fire-time sublabels. */
    eventDate: string;
    /** HH:mm — event start time. For all-day events the picker falls
     *  back to 09:00 so the "At start" / "5 min before" sub-labels still
     *  read sensibly. */
    eventStartTime: string;
    /** Hide sub-times for all-day events — "at 09:00" doesn't make sense
     *  for a multi-day vacation. */
    allDay: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Seed selection from the current value on open. "off" maps null.
    // Numeric value is matched against the preset list. Off-list values
    // (legacy rows, future custom picker) fall back to "off" so the
    // sheet's primary still has a sane label.
    type OptionId = 'off' | number;
    const seedOption = (): OptionId => {
        if (value === null || value === undefined) return 'off';
        if (PRESET_OFFSETS.includes(value)) return value;
        return 'off';
    };
    const [selected, setSelected] = useState<OptionId>(seedOption());
    useEffect(() => {
        if (open) setSelected(seedOption());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, value]);

    // For all-day events fire times aren't meaningful (no start clock
    // time). Force a 09:00 anchor so the picker's sublabel routine
    // still produces stable values; the EventForm hides them visually
    // via the `allDay` flag below.
    const anchorTime = allDay ? '09:00' : eventStartTime;

    type Option = { id: OptionId; label: string; sub: string };
    const options = useMemo<Option[]>(() => {
        const opts: Option[] = [
            { id: 'off', label: 'Off', sub: 'No reminder' },
        ];
        for (const offset of PRESET_OFFSETS) {
            const sub = allDay
                ? offset === 0
                    ? 'On event day'
                    : presetLabel(offset).toLowerCase().replace(' before', '')
                : (fireLabel(offset, eventDate, anchorTime) ?? '—');
            opts.push({ id: offset, label: presetLabel(offset), sub });
        }
        return opts;
    }, [eventDate, anchorTime, allDay]);

    const handleSave = () => {
        onSave(selected === 'off' ? null : selected);
        onClose();
    };

    const primaryLabel = (() => {
        const opt = options.find((o) => o.id === selected);
        return `Save · ${opt?.label ?? 'Off'}`;
    })();

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Reminder"
            sub="When should we ping you before this event?"
            height={520}
            primary={primaryLabel}
            onPrimary={handleSave}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                {options.map((o, idx) => {
                    const isSelected = selected === o.id;
                    const isLast = idx === options.length - 1;
                    return (
                        <Pressable
                            key={String(o.id)}
                            onPress={() => setSelected(o.id)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={o.label}
                            style={({ pressed }) => [
                                styles.row,
                                !isLast && {
                                    borderBottomColor: colors.hair,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                },
                                isSelected && {
                                    backgroundColor: withAlpha(
                                        colors.accent,
                                        0x0e / 255,
                                    ),
                                },
                                pressed && styles.pressed,
                            ]}>
                            <View style={styles.rowBody}>
                                <ThemedText
                                    style={[
                                        styles.label,
                                        { color: colors.text },
                                    ]}>
                                    {o.label}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.subLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {o.sub}
                                </ThemedText>
                            </View>
                            <RadioBubble
                                selected={isSelected}
                                accentColor={colors.accent}
                                onAccentColor={colors.onAccent}
                                inactiveColor={colors.inkFaint}
                            />
                        </Pressable>
                    );
                })}
            </View>
        </SheetShell>
    );
}

/** Short label for the EventForm "Remind me" FormRow's right side.
 *  null → "Off"; otherwise one of the preset strings. */
export function reminderRowLabel(offset: number | null): string {
    if (offset === null || offset === undefined) return 'Off';
    return presetLabel(offset);
}

// Surface the preset list + label helper for callers that need to match
// the picker's vocabulary (e.g. EventDetail's reminders summary). The
// sheet's internal anchor logic doesn't ship — that's picker-only.
export { PRESET_OFFSETS, presetLabel };

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    rowBody: { flex: 1, minWidth: 0 },
    label: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    subLabel: {
        fontSize: 11,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
