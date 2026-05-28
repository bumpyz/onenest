import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { DateTime } from 'luxon';

import type { CustodyOverride, CustodySchedule, Event } from './db';

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
//
// 'AB' (#379, "Together this week" state) marks a day where BOTH parents are
// present. None of the six built-in presets generate 'AB' days — they come
// from manual edits (the editor's per-day picker, eventually) or from
// future shared-day patterns. When the resolver hits an 'AB' day with no
// override, it returns `bothPresent: true` and `profileId: null` so the
// UI can render the shared-state affordance instead of picking one parent.

export type CustodyLabel = 'A' | 'B' | 'AB';

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
 * Returns the time-scope word that reads accurately for the given
 * pattern's rhythm. 7-7 keeps "this week" (one parent has the whole
 * week). Every other pattern uses "today" because the kids switch
 * within the week — saying "Riley's week this week" for 2-2-3 lies
 * about half the days.
 *
 * Subtitle copy across the custody surfaces (CustodyScheduleV2,
 * CustodyViewScreen, CustodyStripToday) routes through this so the
 * phrasing is consistent everywhere.
 */
export function custodyScopeWord(
    patternId: string | null | undefined,
): 'this week' | 'today' {
    return patternId === '7-7' ? 'this week' : 'today';
}

/**
 * Returns the cycle index (0-based) for the given date relative to the schedule's anchor.
 * Handles dates before the anchor correctly via positive modulo.
 *
 * QA-019: when called from the responsible-parent resolver with an event tz,
 * compute the day delta in THAT tz so the cycle index matches what the
 * sunday-summary edge function (Deno port `dayDeltaInTz`) produces. Without
 * this, a viewer in Tokyo looking at an NY-tz event saw a different cycle
 * index than the push notification claimed — same code path, different
 * answer. Legacy callers from calendar UI strips pass tz omitted, which
 * keeps the historical local-time behavior for the custody-band day strip.
 */
export function cycleIndexForDate(
    schedule: CustodySchedule,
    date: Date,
    tz?: string | null,
): number {
    const cycleLength = schedule.cycle_days.length;
    if (cycleLength === 0) return 0;
    let delta: number;
    if (tz) {
        // Luxon-based day delta in tz, mirroring
        // supabase/functions/_shared/recurrence-resolver.ts dayDeltaInTz.
        // Used by the responsible-resolver path (events have a tz, so
        // we key cycle math off the event's wall-clock day to stay in
        // lockstep with the Deno port).
        const aDt = DateTime.fromISO(schedule.anchor_date, { zone: tz }).startOf('day');
        const bDt = DateTime.fromJSDate(date, { zone: 'utc' })
            .setZone(tz)
            .startOf('day');
        delta = aDt.isValid && bDt.isValid
            ? Math.round(bDt.diff(aDt, 'days').days)
            : differenceInCalendarDays(date, parseISO(schedule.anchor_date));
    } else {
        // Calendar UI callers (strip / hub / week-view band) pass a
        // local-midnight Date constructed via `addDays(startOfWeek(now),
        // i)` etc. — they want LOCAL calendar-day cycle math, which is
        // what `differenceInCalendarDays(date, parseISO(anchor))`
        // produces.
        //
        // An earlier post-audit fix replaced this with a UTC default to
        // close a DST drift that affected northern-tz callers twice a
        // year. That fix backfired: Luxon `fromJSDate({zone:'utc'})`
        // reinterprets the local-midnight Date's underlying epoch ms as
        // UTC — so a Tokyo user (UTC+9) saw their cycle index shift by
        // a day every day, not just at DST. Restoring the date-fns
        // path means the DST drift is back as a known minor issue, but
        // the common-case eastern-tz drift is gone. The proper
        // long-term fix is to thread tz through every caller — flagged
        // as a follow-up.
        const anchor = parseISO(schedule.anchor_date);
        delta = differenceInCalendarDays(date, anchor);
    }
    return ((delta % cycleLength) + cycleLength) % cycleLength;
}

/** Returns 'A' / 'B' / 'AB' for the given date. Pass tz to compute in the event's wall-clock. */
export function custodyLabelOnDate(
    schedule: CustodySchedule,
    date: Date,
    tz?: string | null,
): CustodyLabel {
    const idx = cycleIndexForDate(schedule, date, tz);
    return (schedule.cycle_days[idx] as CustodyLabel) ?? 'A';
}

/**
 * Returns the profile_id of the custodian for the given date from the
 * schedule alone (no overrides). Returns `null` for 'AB' (both-present)
 * days — callers that need a single id should treat null as "no specific
 * custodian" (e.g. event auto-assign falls back to Anyone semantics).
 */
export function custodianProfileIdOnDate(
    schedule: CustodySchedule,
    date: Date,
    tz?: string | null,
): string | null {
    const label = custodyLabelOnDate(schedule, date, tz);
    if (label === 'AB') return null;
    return label === 'A'
        ? schedule.parent_a_profile_id
        : schedule.parent_b_profile_id;
}

/**
 * Builds a `YYYY-MM-DD` → CustodyOverride map for fast lookup during rendering.
 *
 * Three filters happen here so callers don't have to:
 *
 *   • Status: only rows where approval_status is 'auto_approved' or
 *     'approved' are applied. 'pending' (awaiting external co-parent
 *     decision) and 'declined' rows are visible to callers fetching
 *     overrides for the approval UI, but they should NOT affect the
 *     resolved custodian — pretend they don't exist for resolver
 *     purposes.
 *
 *   • Per-kid scope: per-kid overrides (child_ids non-empty) are also
 *     skipped here. The resolver works at the household level — the
 *     "who has the kids today" question. A per-kid override is about
 *     one specific kid's exception to that and lives outside this map.
 *     Phase D+ may surface a parallel per-kid map; this one stays
 *     household-wide.
 *
 *   • Date range: multi-day overrides expand into one map entry per
 *     date in [override_date..end_date]. The legacy single-day map
 *     shape is preserved, but a 3-day override now contributes 3 entries.
 *
 * If two effective rows happen to cover the same date (e.g. due to
 * data drift), the later-inserted one wins via a created_at sort.
 */
export function buildOverrideMap(
    overrides: CustodyOverride[] | null | undefined,
): Map<string, CustodyOverride> {
    const map = new Map<string, CustodyOverride>();
    if (!overrides || overrides.length === 0) return map;

    // Newer rows win when expanding overlaps. Sort ascending so the
    // later overwrite naturally takes effect during the loop.
    const sorted = [...overrides].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
    );

    for (const o of sorted) {
        // Status filter — see docstring.
        if (
            o.approval_status !== 'auto_approved' &&
            o.approval_status !== 'approved'
        ) {
            continue;
        }
        // Per-kid filter — see docstring.
        if (o.child_ids && o.child_ids.length > 0) {
            continue;
        }
        // Expand the range. parseISO interprets YYYY-MM-DD as local
        // midnight, matching the rest of the resolver's calendar-day
        // arithmetic.
        const start = parseISO(o.override_date);
        const end = parseISO(o.end_date);
        const days = Math.max(0, differenceInCalendarDays(end, start));
        for (let i = 0; i <= days; i++) {
            const d = new Date(
                start.getFullYear(),
                start.getMonth(),
                start.getDate() + i,
            );
            const key = format(d, 'yyyy-MM-dd');
            map.set(key, o);
        }
    }
    return map;
}

export type ResolvedCustody = {
    /** Null on 'AB' days when no override applies (#379 — both parents
     *  present, no single custodian). Otherwise the resolved profile_id. */
    profileId: string | null;
    /** True when this day was reassigned via an override; false when it
     *  comes straight from the pattern. */
    isOverride: boolean;
    override: CustodyOverride | null;
    /** True when the day's pattern label is 'AB' (both parents home) AND
     *  there's no override pinning it to a single custodian. Overrides
     *  always pick a single parent, so an override on an 'AB' day flips
     *  this to false. Consumers render the shared-state UI when true. */
    bothPresent: boolean;
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
        // Override always pins to a single parent — even on what would
        // otherwise be a both-present 'AB' day. bothPresent therefore
        // false; consumers wanting the shared-state UI should check
        // pattern-derived state separately if needed (rare).
        return {
            profileId: override.custodian_profile_id,
            isOverride: true,
            override,
            bothPresent: false,
        };
    }
    const label = custodyLabelOnDate(schedule, date, tz);
    return {
        profileId:
            label === 'AB'
                ? null
                : label === 'A'
                  ? schedule.parent_a_profile_id
                  : schedule.parent_b_profile_id,
        isOverride: false,
        override: null,
        bothPresent: label === 'AB',
    };
}

/**
 * Returns the column indices [0..week.length-1] where a hand-off happens
 * at the column's RIGHT edge (the day's custodian differs from the next
 * day's). Powers the warn-color ticks on the pattern editor preview +
 * the schedule viewer's multi-week bars.
 *
 * `nextDay` is the lookahead — the first day of the period AFTER `week`
 * — used to decide whether the last column has a hand-off at its right
 * edge. Pass `null` only when there's genuinely no following day (e.g.
 * the very last week in a finite preview window); otherwise the final
 * hand-off can be missed.
 *
 * Two days share a custodian iff they're both 'AB' (bothPresent) OR
 * have the same `profileId`. Centralizing the equality check here keeps
 * the AB-vs-single comparison consistent across surfaces — a viewer
 * comparing colors instead of identity could spuriously match two
 * parents who happen to share the same default-palette swatch.
 */
export function handoffsWithinWeek(
    week: ReadonlyArray<ResolvedCustody>,
    nextDay: ResolvedCustody | null,
): number[] {
    const key = (r: ResolvedCustody): string =>
        r.bothPresent ? 'AB' : r.profileId ?? 'unknown';
    const out: number[] = [];
    for (let i = 0; i < week.length; i++) {
        const next = i + 1 < week.length ? week[i + 1] : nextDay;
        if (!next) continue;
        if (key(week[i]) !== key(next)) out.push(i);
    }
    return out;
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

/**
 * Computes how many alternation-driven event responsibilities would change
 * if the pattern were swapped to a new schedule (#378 "real impact warning").
 *
 * Only counts events that:
 *   - have a responsible_alternation rule (custody-following events)
 *   - fall within the lookahead window (default 28 days — covers ~2 cycles
 *     of the typical 14-day pattern without an expensive long-tail query)
 *   - resolve to a DIFFERENT custodian under the draft vs. the current
 *
 * Returns 0-shape when both schedules resolve identically — the editor's
 * sticky save bar uses this to hide the warning entirely when no real
 * impact (matches the design's hide-when-zero spec).
 *
 * Sample dates are returned for a future expanded-list affordance; the
 * current pill renders only the count.
 */
export function previewImpact(
    currentSchedule: CustodySchedule | null,
    draftSchedule: CustodySchedule,
    eventsInRange: Array<
        Pick<
            Event,
            | 'id'
            | 'starts_at'
            | 'timezone'
            | 'responsible_alternation'
            | 'responsible_profile_id'
        >
    >,
    overrideMap: Map<string, CustodyOverride>,
): { eventCount: number; sampleDates: string[] } {
    // No effective current schedule means everything alternation-driven
    // is currently unresolved (or hits a fallback) — the diff is too
    // ambiguous to surface a meaningful count. Treat as "no impact" so
    // the warning hides. The disabled_at branch closes the bug where
    // re-enabling a soft-stopped pattern (#376) showed a spurious
    // non-zero count: previewImpact was still resolving against the
    // currently-disabled schedule's pattern even though the live
    // resolver treats it as no-schedule (#379 audit HIGH).
    if (!currentSchedule || currentSchedule.disabled_at) {
        return { eventCount: 0, sampleDates: [] };
    }
    const sampleDates = new Set<string>();
    let eventCount = 0;
    for (const e of eventsInRange) {
        if (!e.responsible_alternation) continue;
        const occDate = new Date(e.starts_at);
        // DST-safe: subDays walks calendar days in local time rather
        // than subtracting a raw 86_400_000 ms. The old subtract-24h
        // form landed on the wrong calendar day around spring-forward
        // and fall-back boundaries; the actual resolver
        // (responsible-resolver.ts) already uses subDays, so the
        // impact preview diverged from real-save behavior across DST.
        const lookupDate =
            e.responsible_alternation === 'previous_day'
                ? subDays(occDate, 1)
                : occDate;
        const before = resolveCustodianOnDate(
            currentSchedule,
            overrideMap,
            lookupDate,
            e.timezone,
        );
        const after = resolveCustodianOnDate(
            draftSchedule,
            overrideMap,
            lookupDate,
            e.timezone,
        );
        if (before.profileId !== after.profileId) {
            eventCount += 1;
            sampleDates.add(format(lookupDate, 'yyyy-MM-dd'));
        }
    }
    return {
        eventCount,
        sampleDates: Array.from(sampleDates).sort().slice(0, 5),
    };
}
