// DueDateSheet — TaskDetail v2 field-edit sheet for the Due row.
// Design source: screens-task-edit.jsx DueDateSheet + DueChip +
// MiniCalendar (~508-628).
//
// Layout, top to bottom:
//   1. Quick presets — 2×3 grid of DueChips (Today / Tomorrow / Weekend /
//      Next week / No due date / Custom).
//   2. Date · MMM YYYY — mini calendar grid with day cells.
//   3. Time — big mono readout + 4 quick chips (18:00 19:00 20:00 21:00).
//
// Primary chip label is dynamic: "Save · Tonight 21:00" / "Save · Thu 09:00"
// / "Save · No due date". Secondary chip is "Clear" — wipes both date + time
// in local state without saving.

import {
    addDays,
    format,
    isSameDay,
    parseISO,
    setHours,
    setMinutes,
} from 'date-fns';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MiniCalendar, SheetShell } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { updateTask, type Task } from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

const TIME_CHIPS = ['18:00', '19:00', '20:00', '21:00'] as const;

export function DuePickerSheet({
    open,
    onClose,
    onSaved,
    task,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    task: Task;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Local state: a Date (or null = no due). On save we serialize to ISO.
    const [draft, setDraft] = useState<Date | null>(
        task.due_at ? parseISO(task.due_at) : null,
    );
    useEffect(() => {
        if (open) setDraft(task.due_at ? parseISO(task.due_at) : null);
    }, [open, task.due_at]);
    const [saving, setSaving] = useState(false);

    // Preset selection helpers — set the date to a sensible target +
    // default time for that preset.
    const applyPreset = (kind: 'today' | 'tomorrow' | 'weekend' | 'next-week' | 'none') => {
        const now = new Date();
        if (kind === 'none') {
            setDraft(null);
            return;
        }
        let target = new Date(now);
        if (kind === 'today') target = setHours(setMinutes(now, 0), 21);
        else if (kind === 'tomorrow')
            target = setHours(setMinutes(addDays(now, 1), 0), 9);
        else if (kind === 'weekend') {
            // Next Saturday at 10:00. If today is Saturday, today; if
            // Sunday, today; else next Saturday.
            const day = now.getDay();
            const daysToSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
            target = setHours(setMinutes(addDays(now, daysToSat), 0), 10);
        } else if (kind === 'next-week') {
            // Next Monday at 09:00.
            const day = now.getDay();
            const daysToMon = day === 0 ? 1 : 8 - day;
            target = setHours(setMinutes(addDays(now, daysToMon), 0), 9);
        }
        setDraft(target);
    };

    const setTime = (timeStr: string) => {
        const [hStr, mStr] = timeStr.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const base = draft ?? new Date();
        setDraft(setHours(setMinutes(base, m), h));
    };

    const setDay = (day: Date) => {
        // Preserve the existing time of day (or default to 09:00 if none).
        if (draft) {
            const next = new Date(day);
            next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
            setDraft(next);
        } else {
            const next = new Date(day);
            next.setHours(9, 0, 0, 0);
            setDraft(next);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateTask(task.id, {
                title: task.title,
                notes: task.notes ?? undefined,
                eventId: task.event_id ?? undefined,
                dueAt: draft ? draft.toISOString() : null,
                listIds: task.list_ids,
                childIds: task.child_ids,
                priority: task.priority,
                assigneeProfileIds: task.assignee_profile_ids,
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error('due save failed', err);
        } finally {
            setSaving(false);
        }
    };

    // Dynamic primary label.
    const primaryLabel = (() => {
        if (saving) return 'Saving…';
        if (!draft) return 'Save · No due date';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDay = new Date(draft);
        dueDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
            (dueDay.getTime() - today.getTime()) / 86400000,
        );
        const timePart = format(draft, 'HH:mm');
        if (diffDays === 0) return `Save · Today ${timePart}`;
        if (diffDays === 1) return `Save · Tomorrow ${timePart}`;
        if (diffDays > 1 && diffDays <= 6)
            return `Save · ${format(draft, 'EEE')} ${timePart}`;
        return `Save · ${format(draft, 'MMM d')} ${timePart}`;
    })();

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Due"
            sub={
                task.due_at
                    ? `Currently ${format(parseISO(task.due_at), 'EEE MMM d · HH:mm')}`
                    : undefined
            }
            height={620}
            primary={primaryLabel}
            onPrimary={handleSave}
            primaryDisabled={saving}
            secondary="Clear"
            onSecondary={() => setDraft(null)}>
            {/* Quick presets */}
            <SectionLabel label="Quick presets" colors={colors} />
            <View style={styles.presetGrid}>
                <DueChip
                    label="Today · 21:00"
                    sub="Default evening"
                    selected={isPresetActive(draft, 'today')}
                    onPress={() => applyPreset('today')}
                    colors={colors}
                />
                <DueChip
                    label="Tomorrow · 09:00"
                    selected={isPresetActive(draft, 'tomorrow')}
                    onPress={() => applyPreset('tomorrow')}
                    colors={colors}
                />
                <DueChip
                    label="This weekend"
                    sub="Sat 10:00"
                    selected={isPresetActive(draft, 'weekend')}
                    onPress={() => applyPreset('weekend')}
                    colors={colors}
                />
                <DueChip
                    label="Next week"
                    sub="Mon 09:00"
                    selected={isPresetActive(draft, 'next-week')}
                    onPress={() => applyPreset('next-week')}
                    colors={colors}
                />
                <DueChip
                    label="No due date"
                    muted
                    selected={draft === null}
                    onPress={() => applyPreset('none')}
                    colors={colors}
                />
                {/* Removed the "Custom…" preset chip (R4, #405). The
                    MiniCalendar below already supports picking any date
                    + the Time card accepts arbitrary times — having a
                    separate "Custom…" affordance implied a fourth mode
                    that didn't exist. The preset chips now act purely
                    as accelerators ("Today/Tomorrow/Next week/None"); a
                    user wanting an arbitrary date taps the calendar. */}
            </View>

            {/* MiniCalendar */}
            <View style={{ marginTop: 14 }}>
                <SectionLabel
                    label={`Date · ${format(draft ?? new Date(), 'MMM yyyy')}`}
                    colors={colors}
                />
                <MiniCalendar
                    monthAnchor={draft ?? new Date()}
                    selected={draft}
                    onSelect={setDay}
                    colors={colors}
                />
            </View>

            {/* Time */}
            <View style={{ marginTop: 14 }}>
                <SectionLabel label="Time" colors={colors} />
                <View
                    style={[
                        styles.timeCard,
                        {
                            backgroundColor: colors.backgroundInset,
                            borderColor: colors.hair,
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.timeBig,
                            {
                                color: colors.text,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        {draft ? format(draft, 'HH:mm') : '—:—'}
                    </ThemedText>
                    <View style={{ flex: 1 }} />
                    <View style={styles.timeChipRow}>
                        {TIME_CHIPS.map((t) => {
                            const active =
                                !!draft && format(draft, 'HH:mm') === t;
                            return (
                                <Pressable
                                    key={t}
                                    onPress={() => setTime(t)}
                                    style={({ pressed }) => [
                                        styles.timeChip,
                                        {
                                            backgroundColor: active
                                                ? colors.accent
                                                : colors.backgroundElement,
                                            borderColor: active
                                                ? colors.accent
                                                : colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.timeChipText,
                                            {
                                                color: active
                                                    ? colors.onAccent
                                                    : colors.inkSec,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {t}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>
        </SheetShell>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isPresetActive(
    draft: Date | null,
    kind: 'today' | 'tomorrow' | 'weekend' | 'next-week',
): boolean {
    if (!draft) return false;
    const now = new Date();
    if (kind === 'today') {
        return (
            isSameDay(draft, now) &&
            draft.getHours() === 21 &&
            draft.getMinutes() === 0
        );
    }
    if (kind === 'tomorrow') {
        const tomorrow = addDays(now, 1);
        return (
            isSameDay(draft, tomorrow) &&
            draft.getHours() === 9 &&
            draft.getMinutes() === 0
        );
    }
    // Weekend / next-week heuristics are looser — only match by day.
    if (kind === 'weekend') return draft.getDay() === 6;
    if (kind === 'next-week') return draft.getDay() === 1;
    return false;
}

function SectionLabel({
    label,
    colors,
}: {
    label: string;
    colors: Palette;
}) {
    return (
        <ThemedText
            style={[
                styles.sectionLabel,
                {
                    color: colors.inkFaint,
                    fontFamily: FontFamily.monoSemiBold,
                },
            ]}>
            {label.toUpperCase()}
        </ThemedText>
    );
}

function DueChip({
    label,
    sub,
    selected,
    muted,
    onPress,
    colors,
}: {
    label: string;
    sub?: string;
    selected: boolean;
    muted?: boolean;
    onPress: () => void;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
                styles.dueChip,
                {
                    backgroundColor: selected
                        ? withAlpha(colors.accent, 0x14 / 255)
                        : colors.backgroundInset,
                    borderColor: selected ? colors.accent : colors.hair,
                    borderWidth: selected ? 1.2 : StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            <ThemedText
                style={[
                    styles.dueChipLabel,
                    { color: muted ? colors.inkFaint : colors.text },
                ]}>
                {label}
            </ThemedText>
            {sub ? (
                <ThemedText
                    style={[
                        styles.dueChipSub,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {sub}
                </ThemedText>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    sectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    dueChip: {
        // 2-col grid: width is (100% - one gap) / 2; using flexBasis trick
        // since gap on a wrapping row gives us the spacing.
        flexBasis: '48%',
        flexGrow: 1,
        paddingVertical: 10,
        paddingHorizontal: 11,
        borderRadius: 10,
    },
    dueChipLabel: {
        fontSize: 12.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    dueChipSub: {
        fontSize: 10,
        marginTop: 2,
        letterSpacing: -0.1,
    },
    timeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    timeBig: {
        fontSize: 28,
        fontWeight: '600',
        letterSpacing: -1,
    },
    timeChipRow: {
        flexDirection: 'row',
        gap: 6,
    },
    timeChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    timeChipText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
