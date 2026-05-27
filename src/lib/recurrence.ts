import { DateTime } from 'luxon';
import { RRule } from 'rrule';

import type { Event } from './db';

/**
 * Converts a real UTC instant into a "floating" JS Date whose UTC components encode the
 * WALL CLOCK in `tz`.
 *
 * Why "floating"? rrule.js has a tzid option but in practice it interprets dtstart's
 * local components (not UTC) as the wall clock — fragile and machine-tz-dependent.
 * Instead we run rrule WITHOUT tzid against a floating dtstart, get floating
 * occurrences back (their UTC components match the wall clock each cycle), then convert
 * each occurrence's wall clock to a real UTC instant via luxon. This DST-correct
 * round-trip is the standard rrule + IANA-tz pattern.
 *
 * Example: ('2026-01-05T14:00:00Z', 'America/New_York') →
 *   wall clock in NY = 09:00 (EST), so we return new Date(Date.UTC(2026,0,5,9,0,0)).
 */
function utcInstantToFloating(utcDate: Date, tz: string): Date {
    const dt = DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(tz);
    if (!dt.isValid) {
        // Fall back to the raw instant if the tz string is bogus — caller still gets a
        // working (if DST-imperfect) expansion rather than a hard crash.
        return utcDate;
    }
    return new Date(
        Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second),
    );
}

/**
 * Inverse of utcInstantToFloating: a Date whose UTC components encode the wall clock in
 * `tz` is converted to the real UTC instant of that wall clock. Luxon handles DST gaps
 * and overlaps internally — spring-forward 02:30 wall clock becomes 03:30 EDT (the gap
 * is skipped), fall-back 01:30 picks the first occurrence (the EDT one) consistently.
 */
function floatingInTzToUtc(floating: Date, tz: string): Date {
    const dt = DateTime.fromObject(
        {
            year: floating.getUTCFullYear(),
            month: floating.getUTCMonth() + 1,
            day: floating.getUTCDate(),
            hour: floating.getUTCHours(),
            minute: floating.getUTCMinutes(),
            second: floating.getUTCSeconds(),
        },
        { zone: tz },
    );
    if (!dt.isValid) return floating;
    return dt.toUTC().toJSDate();
}

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
    /** YYYY-MM-DD when the rule has an UNTIL clause; null for open-ended series. */
    until: string | null;
};

const isWeekdayCode = (s: string): s is WeekdayCode =>
    (ALL_WEEKDAY_CODES as readonly string[]).includes(s);

/** Pulls UNTIL=YYYYMMDD[T...] out of an RRULE string, returns it as "YYYY-MM-DD" or null. */
function extractUntil(rule: string): string | null {
    const m = /UNTIL=(\d{4})(\d{2})(\d{2})/i.exec(rule);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseRecurrence(rule: string | null | undefined): ParsedRecurrence {
    if (!rule) return { preset: 'none', byday: [], until: null };

    // Strip UNTIL before matching the preset — the preset shape ("FREQ=WEEKLY" etc.)
    // shouldn't change just because the user added an end date.
    const until = extractUntil(rule);
    const norm = rule
        .replace(/\s/g, '')
        .toUpperCase()
        .replace(/;UNTIL=[0-9T]+/, '');

    if (norm === 'FREQ=DAILY') return { preset: 'daily', byday: [], until };
    if (norm === 'FREQ=WEEKLY') return { preset: 'weekly', byday: [], until };
    if (norm === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR') {
        return { preset: 'weekdays', byday: [], until };
    }
    if (norm === 'FREQ=MONTHLY') return { preset: 'monthly', byday: [], until };

    const m = /^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/.exec(norm);
    if (m) {
        const days = m[1].split(',').filter(isWeekdayCode);
        if (days.length > 0) {
            return { preset: 'custom', byday: days, until };
        }
    }
    // Unparseable but non-null rule — surface as custom with no preselected days so the
    // form can warn / overwrite.
    return { preset: 'custom', byday: [], until };
}

/**
 * Appends `;UNTIL=YYYYMMDDT235959` to a base RRULE string when `until` is set. We use
 * end-of-day floating-time format (no Z) so rrule.js interprets it as wall-clock — the
 * same shape as our dtstart. End of day rather than midnight makes the cutoff inclusive
 * of any event on the chosen date.
 */
function withUntil(base: string | null, until: string | null | undefined): string | null {
    if (!base || !until) return base;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return base;
    const compact = until.replace(/-/g, '') + 'T235959';
    return `${base};UNTIL=${compact}`;
}

export function buildRRule(
    preset: RecurrencePresetId,
    customDays?: readonly WeekdayCode[],
    /** YYYY-MM-DD — the last day on which an occurrence may fall. Null = no end. */
    until?: string | null,
): string | null {
    switch (preset) {
        case 'none':
            return null;
        case 'daily':
            return withUntil('FREQ=DAILY', until);
        case 'weekly':
            return withUntil('FREQ=WEEKLY', until);
        case 'weekdays':
            return withUntil('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', until);
        case 'monthly':
            return withUntil('FREQ=MONTHLY', until);
        case 'custom': {
            if (!customDays || customDays.length === 0) return null;
            // Canonical order matches WEEKDAY_OPTIONS so two equivalent rules stringify identically.
            const order = ALL_WEEKDAY_CODES;
            const sorted = [...customDays].sort(
                (a, b) => order.indexOf(a) - order.indexOf(b),
            );
            return withUntil(`FREQ=WEEKLY;BYDAY=${sorted.join(',')}`, until);
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
 * Compact, uppercased descriptor for an RRULE — feeds the EventDetail hero pretitle
 * (e.g. "WEEKLY · MAY 26 · 2026") and any other surface that needs a one-line
 * recurrence label. Returns null for non-recurring rules so callers can render
 * just the date.
 *
 * Cases:
 *   none / null rule          → null
 *   daily / weekly / monthly  → "DAILY" / "WEEKLY" / "MONTHLY"
 *   weekdays                  → "EVERY WEEKDAY"
 *   custom + BYDAY=MO,WE,FR   → "MON · WED · FRI"
 *   custom with no parseable
 *   weekday list              → "CUSTOM" (fallback — matches RECURRENCE_PRESET_OPTIONS)
 *
 * UNTIL clauses are intentionally omitted from this label — they're surfaced
 * separately (e.g. the "Ends on …" row in EventForm) so the pretitle stays
 * short. If a future surface needs "WEEKLY UNTIL JUN 30" we can branch on a
 * caller-supplied option without changing the default contract.
 */
export function formatRecurrenceLabel(rule: string | null | undefined): string | null {
    if (!rule) return null;
    const parsed = parseRecurrence(rule);
    if (parsed.preset === 'none') return null;
    if (parsed.preset === 'custom' && parsed.byday.length > 0) {
        // Canonical day order (Sun → Sat) matches WEEKDAY_OPTIONS so the
        // label reads in week order regardless of how BYDAY was authored.
        const order = WEEKDAY_OPTIONS.map((o) => o.code);
        const sorted = [...parsed.byday].sort(
            (a, b) => order.indexOf(a) - order.indexOf(b),
        );
        return sorted
            .map(
                (code) =>
                    WEEKDAY_OPTIONS.find((o) => o.code === code)?.label.toUpperCase() ??
                    code,
            )
            .join(' · ');
    }
    return labelForPreset(parsed.preset).toUpperCase();
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
        // QA-016: use the same interval-overlap predicate that QA-011 retired
        // everywhere else, so a multi-day one-off whose start precedes the
        // window but whose end overlaps it still counts. The active caller in
        // getEventsForRange pre-separates one-offs and never hits this branch
        // today, but the function's contract says it returns occurrences that
        // "fall in [rangeStart, rangeEnd)" — make the implementation match.
        // Also keeps this in sync with the Deno port in
        // supabase/functions/_shared/recurrence-resolver.ts.
        const start = new Date(event.starts_at);
        const end = new Date(event.ends_at);
        if (start < rangeEnd && end > rangeStart) return [event];
        return [];
    }

    try {
        const opts = RRule.parseString(event.recurrence_rule);
        const durationMs =
            new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();

        // DST-correct path: when the event has a tz, anchor the recurrence to wall-clock
        // time IN that tz.
        //   1. Convert dtstart (UTC) to a floating Date whose UTC components are the
        //      wall clock in event.timezone.
        //   2. Run rrule with that floating dtstart and NO tzid — each occurrence comes
        //      back as a floating Date whose UTC components are the same wall clock.
        //   3. Convert each (wall clock + tz) back to a real UTC instant. Luxon handles
        //      DST changes here: spring 9 AM EST → 14:00 UTC, but after the March DST
        //      shift the same 9 AM EDT → 13:00 UTC. The wall clock is invariant; the
        //      stored UTC instant is what shifts.
        //   4. Filter on the user's real-UTC range. We use floating range bounds for
        //      rrule.between(), which keeps wall-clock-aligned events even when DST
        //      pushes the real-UTC instant slightly outside the range (a 1-hour edge
        //      effect twice a year, which we'd rather show than hide).
        if (event.timezone) {
            const dtstart = utcInstantToFloating(
                new Date(event.starts_at),
                event.timezone,
            );
            const rule = new RRule({ ...opts, dtstart });
            const floatingRangeStart = utcInstantToFloating(rangeStart, event.timezone);
            const floatingRangeEnd = utcInstantToFloating(rangeEnd, event.timezone);
            const floatingOccurrences = rule.between(
                floatingRangeStart,
                floatingRangeEnd,
                true,
            );
            return floatingOccurrences
                .filter((d) => d.getTime() < floatingRangeEnd.getTime())
                .map((floating) => {
                    const realUtc = floatingInTzToUtc(floating, event.timezone!);
                    return {
                        ...event,
                        starts_at: realUtc.toISOString(),
                        ends_at: new Date(
                            realUtc.getTime() + durationMs,
                        ).toISOString(),
                    };
                });
        }

        // Legacy path (no tz on event): expand against the raw UTC instant. This is the
        // DST-broken behavior — kept for pre-migration-0015 rows so they don't suddenly
        // shift on the visible calendar. Edit the event to backfill its tz and the next
        // expansion uses the DST-correct path.
        const rule = new RRule({ ...opts, dtstart: new Date(event.starts_at) });
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
