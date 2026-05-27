// useCurrentWeekCustody — composes the existing useCustodySchedule +
// useCustodyOverrides hooks into:
//   • a 7-element Mon-first array of resolved custodians for the current
//     ISO week (Today strip / Family Hub hero / viewer "Now")
//   • the next hand-off — first custody transition scanning forward from
//     today, up to 14 days out
//
// Single hook means a future shape change (layered per-child schedules,
// shared-day states) updates everyone at once.

import { addDays, startOfWeek } from 'date-fns';
import { useMemo } from 'react';

import {
    buildOverrideMap,
    resolveCustodianOnDate,
    type ResolvedCustody,
} from '@/lib/custody';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';

export type WeekCustody = {
    /** Monday-first array of resolved custodians for the current ISO week. */
    days: ResolvedCustody[];
    /** 0-6 index of today within this week (Monday = 0). */
    todayIndex: number;
    /** First date in `days`. */
    weekStart: Date;
    /** Profile id of the current day's custodian. Empty string when no
     *  current custodian (either no schedule or today is a shared 'AB'
     *  day where both parents are home). */
    currentParentId: string;
    /** True when the current day's resolved state is bothPresent ('AB'
     *  in the pattern, no override) — the "Together this week" state
     *  (#379). Strip + hero branch on this to render the shared affordance. */
    bothPresent: boolean;
};

export type NextHandoff = {
    /** Date when the custody switch happens. Convention is end-of-day
     *  18:00 local (or the schedule's `handoff_time` once Phase 4 lands),
     *  matching the design's default hand-off time. */
    at: Date;
    /** Profile id of the parent giving up custody. Null when the
     *  "current" state is bothPresent (the togetherness ends and one
     *  parent leaves) — for hand-off framing purposes the "from" side
     *  is the shared/AB state. */
    fromProfileId: string | null;
    /** Profile id of the parent taking custody. Null when the next
     *  state is itself bothPresent (entering a shared/AB run). */
    toProfileId: string | null;
};

export type CurrentWeekCustody = {
    weekCustody: WeekCustody;
    nextHandoff: NextHandoff | null;
};

/**
 * Returns the composed current-week custody + next-handoff. Returns null
 * when the household has no custody schedule — custody UI should hide
 * entirely in that case (README Q1).
 *
 * Fetches a 14-day override window starting from this week's Monday so
 * both the strip and the next-handoff scan share one request.
 */
export function useCurrentWeekCustody(
    householdId: string | undefined,
): CurrentWeekCustody | null {
    const { schedule } = useCustodySchedule(householdId);

    // Fetch a 14-day window so both the current-week display + the
    // next-handoff scan are covered by a single overrides query.
    const weekStart = useMemo(
        () => startOfWeek(new Date(), { weekStartsOn: 1 }),
        [],
    );
    const rangeEnd = useMemo(() => addDays(weekStart, 13), [weekStart]);
    const { overrides } = useCustodyOverrides(
        householdId,
        weekStart,
        rangeEnd,
    );

    return useMemo(() => {
        // #376: soft-stopped schedules look the same as no-schedule to
        // every downstream consumer. The row stays in storage (so
        // historical events keep their assignments) but the strip,
        // hero, and viewer all collapse.
        if (!schedule || schedule.disabled_at) return null;
        const overrideMap = buildOverrideMap(overrides ?? []);
        const days: ResolvedCustody[] = [];
        for (let i = 0; i < 7; i++) {
            days.push(
                resolveCustodianOnDate(
                    schedule,
                    overrideMap,
                    addDays(weekStart, i),
                ),
            );
        }
        const now = new Date();
        const todayIndex = Math.max(
            0,
            Math.min(
                6,
                Math.floor(
                    (now.getTime() - weekStart.getTime()) / 86_400_000,
                ),
            ),
        );
        const today = days[todayIndex] ?? null;
        const currentParentId = today?.profileId ?? '';
        const weekCustody: WeekCustody = {
            days,
            todayIndex,
            weekStart,
            currentParentId,
            // #379: real bothPresent now driven by today's resolved state.
            bothPresent: today?.bothPresent ?? false,
        };

        // Next-handoff scan — walk forward up to 14 days looking for a
        // custodian change. Hand-off conventionally lands at the END of
        // the previous day (the schedule's `handoff_time`) — mirrors
        // how the design's "Next · Wed 17:00" labels are anchored to
        // the giving-up parent's last evening.
        //
        // Reads the schedule's actual `handoff_time` column rather than
        // a hardcoded 18:00. Post-audit fix: viewer's pattern-summary
        // line shows the real time, but this hook was hardcoding 18:00,
        // so the viewer's subtitle ("Hand-off Sunday at 18:00") would
        // disagree with the pattern line ("HANDOFF SUN 17:30") whenever
        // a household picked something other than 18:00. Parsing the
        // `HH:MM:SS` Postgres time column with a regex falls back to
        // 18:00 on any parse failure.
        //
        // 'AB' day handling: a transition INTO or OUT OF a shared day
        // still counts as a hand-off — the household's daily reality
        // genuinely changes. We compare on `profileId || bothPresent`
        // semantics by comparing the full state tuple via JSON equality
        // of the relevant bits.
        const handoffMatch = /^(\d{2}):(\d{2})/.exec(schedule.handoff_time);
        const HANDOFF_HOUR = handoffMatch
            ? parseInt(handoffMatch[1]!, 10)
            : 18;
        const HANDOFF_MIN = handoffMatch
            ? parseInt(handoffMatch[2]!, 10)
            : 0;
        const todayMid = new Date(now);
        todayMid.setHours(0, 0, 0, 0);
        let nextHandoff: NextHandoff | null = null;
        const todayResolved = today ?? null;
        const sameState = (
            a: ResolvedCustody | null,
            b: ResolvedCustody,
        ): boolean =>
            !!a && a.profileId === b.profileId && a.bothPresent === b.bothPresent;
        for (let i = 1; i <= 14; i++) {
            const d = addDays(todayMid, i);
            const next = resolveCustodianOnDate(schedule, overrideMap, d);
            if (!sameState(todayResolved, next)) {
                const at = addDays(todayMid, i - 1);
                at.setHours(HANDOFF_HOUR, HANDOFF_MIN, 0, 0);
                nextHandoff = {
                    at,
                    fromProfileId: currentParentId || null,
                    toProfileId: next.profileId,
                };
                break;
            }
        }

        return { weekCustody, nextHandoff };
    }, [schedule, overrides, weekStart]);
}
