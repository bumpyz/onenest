import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { DateTime } from 'luxon';

import type { CustodyOverride, CustodySchedule } from './db';

/** QA-017: YYYY-MM-DD key for a date interpreted in the given IANA timezone.
 *  Mirrors `dateKeyInTz` in supabase/functions/_shared/recurrence-resolver.ts
 *  so the client and the sunday-summary edge function key custody lookups off
 *  the same calendar date even when the viewer's device tz differs from the
 *  event's tz. Falls back to local-time formatting when no tz is given (legacy
 *  callers from the custody-band strip that pass a local-midnight Date with
 *  no event context). */
export function dateKeyInTz(date: Date, tz: string | null | undefined): string {
    if (tz) {
        const dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(tz);
        if (dt.isValid) return dt.toFormat('yyyy-MM-dd');
    }
    return format(date, 'yyyy-MM-dd');
}

// 'A' / 'B' refers to the two parents stored on the schedule as parent_a_profile_id /
// parent_b_profile_id. Pattern presets are just A/B day arrays of cycle length 7 or 14.
// All patterns are anchored to schedule.anchor_date as "day 0 of the cycle".

export type CustodyLabel = 'A' | 'B';

export type CustodyPatternId =
    | '2-2-3'
    | '2-2-5-5'
    | '3-4-4-3'
    | '7-7'
    | '5-2'
    | 'alternating-weekends';

export type CustodyPattern = {
    id: CustodyPatternId;
    label: string;
    description: string;
    cycle: ReadonlyArray<CustodyLabel>;
};

export const CUSTODY_PATTERNS: ReadonlyArray<CustodyPattern> = [
    {
        id: '2-2-3',
        label: '2-2-3',
        description: '2 days A, 2 days B, 3 days A; next week flips. 14-day cycle, 50/50.',
        cycle: ['A', 'A', 'B', 'B', 'A', 'A', 'A', 'B', 'B', 'A', 'A', 'B', 'B', 'B'],
    },
    {
        id: '2-2-5-5',
        label: '2-2-5-5',
        description: '2 days A, 2 days B, 5 days A, 5 days B. 14-day cycle, 50/50.',
        cycle: ['A', 'A', 'B', 'B', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'B'],
    },
    {
        id: '3-4-4-3',
        label: '3-4-4-3',
        description: '3 days A, 4 days B; next week 4 days A, 3 days B. 14-day cycle, 50/50.',
        cycle: ['A', 'A', 'A', 'B', 'B', 'B', 'B', 'A', 'A', 'A', 'A', 'B', 'B', 'B'],
    },
    {
        id: '7-7',
        label: 'Alternating weeks',
        description: 'Full week with A, then full week with B. 14-day cycle, 50/50.',
        cycle: ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B'],
    },
    {
        id: '5-2',
        label: '5-2',
        description: '5 days with A, 2 days with B. Weekly, primary custody.',
        cycle: ['A', 'A', 'A', 'A', 'A', 'B', 'B'],
    },
    {
        id: 'alternating-weekends',
        label: 'Alternating weekends',
        description: 'Mostly with A; B has Fri–Sun every other weekend (14-day cycle).',
        // Anchor on a Monday: A holds days 0–10 (Mon–Thu of week 2), B gets days 11–13 (Fri–Sun of week 2).
        cycle: ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B'],
    },
];

export function findPattern(id: string | null | undefined): CustodyPattern | null {
    if (!id) return null;
    return CUSTODY_PATTERNS.find((p) => p.id === id) ?? null;
}

/**
 * Returns the cycle index (0-based) for the given date relative to the schedule's anchor.
 * Handles dates before the anchor correctly via positive modulo.
 */
export function cycleIndexForDate(schedule: CustodySchedule, date: Date): number {
    const anchor = parseISO(schedule.anchor_date);
    const cycleLength = schedule.cycle_days.length;
    if (cycleLength === 0) return 0;
    const delta = differenceInCalendarDays(date, anchor);
    return ((delta % cycleLength) + cycleLength) % cycleLength;
}

/** Returns 'A' or 'B' for the given date. */
export function custodyLabelOnDate(
    schedule: CustodySchedule,
    date: Date,
): CustodyLabel {
    const idx = cycleIndexForDate(schedule, date);
    return (schedule.cycle_days[idx] as CustodyLabel) ?? 'A';
}

/** Returns the profile_id of the custodian for the given date from the schedule alone (no overrides). */
export function custodianProfileIdOnDate(
    schedule: CustodySchedule,
    date: Date,
): string {
    return custodyLabelOnDate(schedule, date) === 'A'
        ? schedule.parent_a_profile_id
        : schedule.parent_b_profile_id;
}

/**
 * Builds a `YYYY-MM-DD` → CustodyOverride map for fast lookup during rendering.
 */
export function buildOverrideMap(
    overrides: CustodyOverride[] | null | undefined,
): Map<string, CustodyOverride> {
    const map = new Map<string, CustodyOverride>();
    for (const o of overrides ?? []) {
        map.set(o.override_date, o);
    }
    return map;
}

export type ResolvedCustody = {
    profileId: string;
    /** True when this day was reassigned via an override; false when it comes straight from the pattern. */
    isOverride: boolean;
    override: CustodyOverride | null;
};

/**
 * Returns the effective custodian for a date — checks overrides first, then the schedule pattern.
 *
 * QA-017: callers that have an event in hand (the responsible-parent resolver) pass
 * `tz = event.timezone` so the override-map lookup keys off the event's wall-clock
 * date, matching the Deno-side resolver in the sunday-summary edge function.
 * Calendar UI callers (custody-band strip) keep the legacy local-time behavior by
 * passing tz omitted/undefined — those operate on a local-midnight calendar Date
 * directly, so there's no event tz to consider.
 */
export function resolveCustodianOnDate(
    schedule: CustodySchedule,
    overrideMap: Map<string, CustodyOverride>,
    date: Date,
    tz?: string | null,
): ResolvedCustody {
    const dateKey = dateKeyInTz(date, tz);
    const override = overrideMap.get(dateKey) ?? null;
    if (override) {
        return {
            profileId: override.custodian_profile_id,
            isOverride: true,
            override,
        };
    }
    return {
        profileId: custodianProfileIdOnDate(schedule, date),
        isOverride: false,
        override: null,
    };
}

/**
 * Returns the next 14 cycle labels starting from the given date, e.g. for a preview strip.
 * Always returns 14 entries even if cycle length is 7.
 */
export function previewLabels(
    schedule: Pick<CustodySchedule, 'cycle_days' | 'anchor_date'>,
    startDate: Date,
    days = 14,
): CustodyLabel[] {
    const anchor = parseISO(schedule.anchor_date);
    const cycleLength = schedule.cycle_days.length;
    if (cycleLength === 0) return Array<CustodyLabel>(days).fill('A');
    const baseDelta = differenceInCalendarDays(startDate, anchor);
    const result: CustodyLabel[] = [];
    for (let i = 0; i < days; i++) {
        const idx = (((baseDelta + i) % cycleLength) + cycleLength) % cycleLength;
        result.push((schedule.cycle_days[idx] as CustodyLabel) ?? 'A');
    }
    return result;
}
