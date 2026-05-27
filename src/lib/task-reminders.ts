// Reminder offset presets for the task edit modal. The DB stores an absolute
// reminder_at timestamp; the UI lets the user pick a lead-time offset against the
// task's due_at. Picking "30 min before" computes reminder_at = due_at - 30 min on
// save. Picking "None" stores null. Custom datetime entry is deferred for now —
// presets cover the 90th-percentile cases without needing a full datetime picker.

export type ReminderPreset = {
    id: string;
    label: string;
    /** Minutes before due_at to fire the reminder. 0 = at due time. */
    offsetMin: number;
};

export const REMINDER_PRESETS: ReminderPreset[] = [
    { id: 'at', label: 'At due time', offsetMin: 0 },
    { id: '5m', label: '5 min before', offsetMin: 5 },
    { id: '15m', label: '15 min before', offsetMin: 15 },
    { id: '30m', label: '30 min before', offsetMin: 30 },
    { id: '1h', label: '1 hour before', offsetMin: 60 },
    // 2h added in v2 TaskDetail per design source
    // (screens-task-edit.jsx ReminderSheet:730). Slots between 1h and 1d
    // as the next-coarser step.
    { id: '2h', label: '2 hours before', offsetMin: 120 },
    { id: '1d', label: '1 day before', offsetMin: 60 * 24 },
];

/**
 * Resolve an absolute ISO timestamp for the reminder, given a due_at and a chosen
 * preset (or null for "no reminder"). Returns null when due_at is missing — you
 * can't schedule a "30 min before" against a task with no due time, so we silently
 * clear the reminder rather than guessing.
 */
export function computeReminderAt(
    dueAt: string | null,
    preset: ReminderPreset | null,
): string | null {
    if (!preset || !dueAt) return null;
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) return null;
    return new Date(due.getTime() - preset.offsetMin * 60_000).toISOString();
}

/**
 * Best-effort reverse-mapping: given a stored reminder_at and the task's due_at,
 * return the preset whose offset matches (within a minute, to absorb tz / rounding
 * drift). Returns null when nothing matches — the UI shows "Custom" in that case.
 */
export function presetForReminderAt(
    dueAt: string | null,
    reminderAt: string | null,
): ReminderPreset | null {
    if (!dueAt || !reminderAt) return null;
    const due = new Date(dueAt).getTime();
    const rem = new Date(reminderAt).getTime();
    if (Number.isNaN(due) || Number.isNaN(rem)) return null;
    const offsetMin = Math.round((due - rem) / 60_000);
    return REMINDER_PRESETS.find((p) => p.offsetMin === offsetMin) ?? null;
}
