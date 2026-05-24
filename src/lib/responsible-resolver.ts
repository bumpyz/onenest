// Resolves the effective "responsible parent" for a given event occurrence by walking a
// priority chain: per-occurrence override → alternation lookup against custody schedule
// → static event.responsible_profile_id. The calendar and home views call this anywhere
// they used to read event.responsible_profile_id directly.
//
// Why a dedicated helper rather than baking this into the recurrence expander:
//   - Display surfaces (Calendar / Home) already have the custody schedule + overrides
//     in scope; threading them into expansion would force every caller to wire them up.
//   - Per-occurrence overrides need the occurrence_date, which is only known at render
//     time for recurring events.
//   - Keeps lib/recurrence.ts focused on date generation, lib/custody.ts focused on
//     custody lookup, and this file focused on the responsibility logic.

import { subDays } from 'date-fns';

import { dateKeyInTz, resolveCustodianOnDate } from './custody';
import type {
    CustodyOverride,
    CustodySchedule,
    Event,
    EventOccurrenceOverride,
} from './db';

export type ResolveResponsibleArgs = {
    /** Event being rendered; uses responsible_alternation + responsible_profile_id. */
    event: Event;
    /** The occurrence's calendar date (local). For one-off events this is just the start date. */
    occurrenceDate: Date;
    /** Household's custody schedule, if configured. */
    custodySchedule: CustodySchedule | null;
    /** Custody overrides (per-date custodian swaps) for the visible range. */
    custodyOverrides: Map<string, CustodyOverride>;
    /** Event-occurrence overrides keyed by "eventId|YYYY-MM-DD". */
    occurrenceOverrides: Map<string, EventOccurrenceOverride>;
};

/**
 * Priority order (highest to lowest):
 *   1. Per-(event, date) occurrence override row — covers ad-hoc swaps like "Mom does
 *      Friday pickup this week because Dad is traveling."
 *   2. Alternation rule against custody schedule — same_day uses the occurrence date;
 *      previous_day uses date - 1 (morning events that carry overnight from the prior
 *      custodian).
 *   3. The event's stored responsible_profile_id — static assignment, or null if
 *      unassigned.
 *
 * Returns null when nothing resolves a responsible parent (alternation with no schedule,
 * or just genuinely unassigned). Callers should treat null as the "Anyone" / unassigned
 * state — colorForResponsible already handles it.
 */
export function resolveResponsibleProfileId(args: ResolveResponsibleArgs): string | null {
    const { event, occurrenceDate, custodySchedule, custodyOverrides, occurrenceOverrides } =
        args;

    // QA-017: key the override lookup off the event's wall-clock date in its
    // own timezone, not the viewer's local time. A traveling parent viewing
    // from Tokyo (UTC+9) shouldn't compute a different cycle-index than the
    // sunday-summary edge function, which uses event.timezone too. When the
    // event has no timezone (legacy null), fall back to local-time formatting
    // — that matches the historical behavior.
    const dateKey = dateKeyInTz(occurrenceDate, event.timezone);
    const occOverride = occurrenceOverrides.get(`${event.id}|${dateKey}`);
    if (occOverride) {
        // Explicit override takes precedence over everything — including a null override
        // (treats this occurrence as unassigned even if the series rule would assign).
        return occOverride.responsible_profile_id;
    }

    if (event.responsible_alternation) {
        if (!custodySchedule) {
            // Configured for alternation but no schedule → can't resolve. Fall back to
            // the static field (likely null), which the display will render as Anyone.
            return event.responsible_profile_id;
        }
        const lookupDate =
            event.responsible_alternation === 'previous_day'
                ? subDays(occurrenceDate, 1)
                : occurrenceDate;
        return resolveCustodianOnDate(
            custodySchedule,
            custodyOverrides,
            lookupDate,
            event.timezone,
        ).profileId;
    }

    return event.responsible_profile_id;
}
