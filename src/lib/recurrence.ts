import { RRule } from 'rrule';

import type { Event } from './db';

export type RecurrencePresetId =
    | 'none'
    | 'daily'
    | 'weekly'
    | 'weekdays'
    | 'monthly'
    | 'custom';

export const RECURRENCE_PRESET_OPTIONS: ReadonlyArray<{
    id: RecurrencePresetId;
    label: string;
}> = [
    { id: 'none', label: 'Does not repeat' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'weekdays', label: 'Every weekday' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'custom', label: 'Custom…' },
];

export const WEEKDAY_OPTIONS = [
    { code: 'SU', label: 'Sun' },
    { code: 'MO', label: 'Mon' },
    { code: 'TU', label: 'Tue' },
    { code: 'WE', label: 'Wed' },
    { code: 'TH', label: 'Thu' },
    { code: 'FR', label: 'Fri' },
    { code: 'SA', label: 'Sat' },
] as const;

export type WeekdayCode = (typeof WEEKDAY_OPTIONS)[number]['code'];

const WEEKDAY_BY_GETDAY: readonly WeekdayCode[] = [
    'SU',
    'MO',
    'TU',
    'WE',
    'TH',
    'FR',
    'SA',
];

const ALL_WEEKDAY_CODES = WEEKDAY_OPTIONS.map((o) => o.code);

export function weekdayForDate(date: Date): WeekdayCode {
    return WEEKDAY_BY_GETDAY[date.getDay()];
}

export type ParsedRecurrence = {
    preset: RecurrencePresetId;
    byday: WeekdayCode[];
};

const isWeekdayCode = (s: string): s is WeekdayCode =>
    (ALL_WEEKDAY_CODES as readonly string[]).includes(s);

export function parseRecurrence(rule: string | null | undefined): ParsedRecurrence {
    if (!rule) return { preset: 'none', byday: [] };
    const norm = rule.replace(/\s/g, '').toUpperCase();
    if (norm === 'FREQ=DAILY') return { preset: 'daily', byday: [] };
    if (norm === 'FREQ=WEEKLY') return { preset: 'weekly', byday: [] };
    if (norm === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR') {
        return { preset: 'weekdays', byday: [] };
    }
    if (norm === 'FREQ=MONTHLY') return { preset: 'monthly', byday: [] };

    const m = /^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/.exec(norm);
    if (m) {
        const days = m[1].split(',').filter(isWeekdayCode);
        if (days.length > 0) {
            return { preset: 'custom', byday: days };
        }
    }
    // Unparseable but non-null rule — surface as custom with no preselected days so the
    // form can warn / overwrite.
    return { preset: 'custom', byday: [] };
}

export function buildRRule(
    preset: RecurrencePresetId,
    customDays?: readonly WeekdayCode[],
): string | null {
    switch (preset) {
        case 'none':
            return null;
        case 'daily':
            return 'FREQ=DAILY';
        case 'weekly':
            return 'FREQ=WEEKLY';
        case 'weekdays':
            return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
        case 'monthly':
            return 'FREQ=MONTHLY';
        case 'custom': {
            if (!customDays || customDays.length === 0) return null;
            // Canonical order matches WEEKDAY_OPTIONS so two equivalent rules stringify identically.
            const order = ALL_WEEKDAY_CODES;
            const sorted = [...customDays].sort(
                (a, b) => order.indexOf(a) - order.indexOf(b),
            );
            return `FREQ=WEEKLY;BYDAY=${sorted.join(',')}`;
        }
    }
}

// Thin back-compat shims; new code should use parseRecurrence / buildRRule.
export function presetFromRRule(rule: string | null | undefined): RecurrencePresetId {
    return parseRecurrence(rule).preset;
}

export function buildRRuleFromPreset(preset: RecurrencePresetId): string | null {
    return buildRRule(preset);
}

export function labelForPreset(preset: RecurrencePresetId): string {
    const found = RECURRENCE_PRESET_OPTIONS.find((p) => p.id === preset);
    return found?.label ?? 'Custom';
}

/**
 * Given a master event with a recurrence_rule, returns the occurrences that fall in
 * [rangeStart, rangeEnd). Each occurrence is a copy of the master with starts_at / ends_at
 * shifted to the occurrence time. id is preserved — multiple instances share the master id.
 *
 * If the event has no recurrence_rule, returns [event] when it overlaps the range, else [].
 * If the rule fails to parse, falls back to [event] so we don't silently lose data.
 */
export function expandEventToOccurrences(
    event: Event,
    rangeStart: Date,
    rangeEnd: Date,
): Event[] {
    if (!event.recurrence_rule) {
        const start = new Date(event.starts_at);
        if (start >= rangeStart && start < rangeEnd) return [event];
        return [];
    }

    try {
        const opts = RRule.parseString(event.recurrence_rule);
        const rule = new RRule({ ...opts, dtstart: new Date(event.starts_at) });
        const durationMs =
            new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();
        const occurrences = rule.between(rangeStart, rangeEnd, true);
        return occurrences
            .filter((d) => d.getTime() < rangeEnd.getTime())
            .map((d) => ({
                ...event,
                starts_at: d.toISOString(),
                ends_at: new Date(d.getTime() + durationMs).toISOString(),
            }));
    } catch (err) {
        console.error('Failed to expand recurrence_rule for event', event.id, err);
        return [event];
    }
}
