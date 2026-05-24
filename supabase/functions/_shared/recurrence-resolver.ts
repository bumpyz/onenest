// supabase/functions/_shared/recurrence-resolver.ts
//
// Deno port of the client-side recurrence expander + responsible-parent resolver.
// Used by edge functions (sunday-summary, future task-summary) that need to compute
// what a user will see on Home / Calendar without re-implementing the logic.
//
// Why a port rather than running the client code directly: Supabase edge functions
// run on Deno, so client-side modules that depend on Node bundler resolution can't
// just be imported. We pull in rrule + luxon via npm: specifiers and keep the
// function surface byte-compatible with src/lib/recurrence.ts +
// src/lib/responsible-resolver.ts + src/lib/custody.ts.
//
// If you change the algorithm here, mirror the change in the client lib (or vice
// versa) — drift between the two would produce a sunday-summary push that doesn't
// match what the user sees when they open the app.

// rrule ships as CJS and Deno's `npm:` resolver doesn't expose `RRule` as a named
// export under that interop shim — boot fails with "does not provide an export
// named 'RRule'". esm.sh re-exports the package as proper ESM with named
// exports, which is the documented Supabase Edge Function pattern for any npm
// module that has CJS interop quirks. luxon ships native ESM so `npm:` works
// too, but we use esm.sh for both to keep specifier shapes consistent.
import { RRule } from 'https://esm.sh/rrule@2.7.2';
import { DateTime } from 'https://esm.sh/luxon@3.4.4';

// ─── Types (subset of src/lib/db.ts) ─────────────────────────────────────────
// We only declare the fields the algorithm reads. The actual DB rows carry more.

export type Event = {
    id: string;
    household_id: string;
    starts_at: string;
    ends_at: string;
    responsible_profile_id: string | null;
    recurrence_rule: string | null;
    responsible_alternation: 'same_day' | 'previous_day' | null;
    timezone: string | null;
    all_day?: boolean;
};

export type CustodySchedule = {
    household_id: string;
    parent_a_profile_id: string;
    parent_b_profile_id: string;
    anchor_date: string; // YYYY-MM-DD
    cycle_days: string[]; // 'A' | 'B' entries
};

export type CustodyOverride = {
    household_id: string;
    override_date: string; // YYYY-MM-DD
    custodian_profile_id: string;
};

export type EventOccurrenceOverride = {
    event_id: string;
    occurrence_date: string; // YYYY-MM-DD
    responsible_profile_id: string | null;
};

// ─── Floating-time helpers (mirror src/lib/recurrence.ts) ────────────────────

/**
 * Convert a real UTC instant into a "floating" JS Date whose UTC components
 * encode the WALL CLOCK in `tz`. See src/lib/recurrence.ts for the why behind
 * this — rrule.js's tzid option is unreliable, so we expand against floating
 * dtstart and re-localize after.
 */
function utcInstantToFloating(utcDate: Date, tz: string): Date {
    const dt = DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(tz);
    if (!dt.isValid) return utcDate;
    return new Date(
        Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second),
    );
}

/** Inverse of utcInstantToFloating. Luxon handles DST gaps / overlaps internally. */
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

// ─── Recurrence expansion (mirror src/lib/recurrence.ts) ─────────────────────

/**
 * Given a master event with a recurrence_rule, returns the occurrences that fall in
 * [rangeStart, rangeEnd). Each occurrence is a copy of the master with starts_at /
 * ends_at shifted. id is preserved (multiple instances share the master id) — callers
 * keying on uniqueness should combine id with starts_at.
 *
 * No recurrence_rule → returns [event] if it overlaps the range, else [].
 * Parse failure → returns [event] (don't silently lose data; surface as a one-off).
 */
export function expandEventToOccurrences(
    event: Event,
    rangeStart: Date,
    rangeEnd: Date,
): Event[] {
    if (!event.recurrence_rule) {
        // One-off events: include if the event's [starts_at, ends_at) interval
        // overlaps [rangeStart, rangeEnd). Mirrors the QA-011 fix in db.ts —
        // multi-day events that started before the window but extend into it
        // (e.g. a Mon→Wed vacation viewed on Wed) need to be counted, not
        // dropped on a starts-only check.
        const start = new Date(event.starts_at);
        const end = new Date(event.ends_at);
        if (start < rangeEnd && end > rangeStart) return [event];
        return [];
    }

    try {
        const opts = RRule.parseString(event.recurrence_rule);
        const durationMs =
            new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();

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

        // Legacy path (no tz on event): expand against the raw UTC instant.
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

// ─── Custody resolution (mirror src/lib/custody.ts) ──────────────────────────

/** Number of calendar days between a YYYY-MM-DD anchor and a real Date, where the
 *  Date is interpreted in `tz` (so an event at 8 AM Tokyo on May 22 reads as May 22,
 *  not May 21 UTC). Mirrors date-fns differenceInCalendarDays semantics. */
function dayDeltaInTz(aIsoDate: string, bDate: Date, tz: string | null): number {
    const zone = tz ?? 'utc';
    const aDt = DateTime.fromISO(aIsoDate, { zone }).startOf('day');
    const bDt = DateTime.fromJSDate(bDate, { zone: 'utc' }).setZone(zone).startOf('day');
    if (!aDt.isValid || !bDt.isValid) return 0;
    return Math.round(bDt.diff(aDt, 'days').days);
}

function cycleIndexForDate(
    schedule: CustodySchedule,
    date: Date,
    tz: string | null,
): number {
    const cycleLength = schedule.cycle_days.length;
    if (cycleLength === 0) return 0;
    const delta = dayDeltaInTz(schedule.anchor_date, date, tz);
    return ((delta % cycleLength) + cycleLength) % cycleLength;
}

function custodianProfileIdOnDate(
    schedule: CustodySchedule,
    date: Date,
    tz: string | null,
): string {
    const idx = cycleIndexForDate(schedule, date, tz);
    const label = schedule.cycle_days[idx] ?? 'A';
    return label === 'A'
        ? schedule.parent_a_profile_id
        : schedule.parent_b_profile_id;
}

export function buildCustodyOverrideMap(
    overrides: CustodyOverride[] | null | undefined,
): Map<string, CustodyOverride> {
    const map = new Map<string, CustodyOverride>();
    for (const o of overrides ?? []) {
        map.set(o.override_date, o);
    }
    return map;
}

/** YYYY-MM-DD key for a JS Date in the given IANA timezone. The client lib uses
 *  format(date, 'yyyy-MM-dd') which is local-time; here we mirror that by computing
 *  the wall-clock date in the EVENT's timezone (so an event at 8 AM in Tokyo keys
 *  off Tokyo's May 22, not UTC's May 21). Falls back to the date's UTC components
 *  when no tz is provided (legacy events without timezone). */
function dateKeyInTz(date: Date, tz: string | null): string {
    if (tz) {
        const dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(tz);
        if (dt.isValid) return dt.toFormat('yyyy-MM-dd');
    }
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function resolveCustodianOnDate(
    schedule: CustodySchedule,
    overrideMap: Map<string, CustodyOverride>,
    date: Date,
    tz: string | null,
): string {
    const key = dateKeyInTz(date, tz);
    const override = overrideMap.get(key);
    if (override) return override.custodian_profile_id;
    return custodianProfileIdOnDate(schedule, date, tz);
}

// ─── Responsible resolver (mirror src/lib/responsible-resolver.ts) ───────────

export function buildEventOccurrenceOverrideMap(
    overrides: EventOccurrenceOverride[] | null | undefined,
): Map<string, EventOccurrenceOverride> {
    const map = new Map<string, EventOccurrenceOverride>();
    for (const o of overrides ?? []) {
        map.set(`${o.event_id}|${o.occurrence_date}`, o);
    }
    return map;
}

export type ResolveResponsibleArgs = {
    event: Event;
    occurrenceDate: Date;
    custodySchedule: CustodySchedule | null;
    custodyOverrides: Map<string, CustodyOverride>;
    occurrenceOverrides: Map<string, EventOccurrenceOverride>;
};

/**
 * Priority: per-occurrence override → alternation against custody → static field.
 * Returns null when nothing resolves — the "Anyone" / unassigned state.
 *
 * Note: alternation 'previous_day' subtracts one day from occurrenceDate before the
 * custody lookup, so morning events that carry over from the prior night's custodian
 * resolve correctly.
 */
export function resolveResponsibleProfileId(args: ResolveResponsibleArgs): string | null {
    const {
        event,
        occurrenceDate,
        custodySchedule,
        custodyOverrides,
        occurrenceOverrides,
    } = args;

    const dateKey = dateKeyInTz(occurrenceDate, event.timezone);
    const occOverride = occurrenceOverrides.get(`${event.id}|${dateKey}`);
    if (occOverride) return occOverride.responsible_profile_id;

    if (event.responsible_alternation) {
        if (!custodySchedule) return event.responsible_profile_id;
        const lookupDate =
            event.responsible_alternation === 'previous_day'
                ? new Date(occurrenceDate.getTime() - 24 * 60 * 60 * 1000)
                : occurrenceDate;
        return resolveCustodianOnDate(
            custodySchedule,
            custodyOverrides,
            lookupDate,
            event.timezone,
        );
    }

    return event.responsible_profile_id;
}
