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
 *   3. The event's multi-responsible LEAD (events_responsible.is_lead=true) — the
 *      primary responsible when the new multi-responsible model has data for this
 *      event. Falls through to (4) when the list is empty (unmigrated row or
 *      deliberately unassigned).
 *   4. The legacy `responsible_profile_id` column — static assignment from the
 *      pre-migration-0039 model, or the mirrored lead from the new model. Either
 *      way, this returns the same value as (3) for migrated rows, and the original
 *      single-responsible value for rows not yet exercised by the new writers.
 *
 * Returns null when nothing resolves a responsible parent (alternation with no schedule,
 * empty responsibles + null legacy column, or a genuinely unassigned event). Callers
 * should treat null as the "Anyone" / unassigned state — colorForResponsible already
 * handles it.
 *
 * Note: this function returns a SINGLE profile_id (the primary/lead). Surfaces that
 * need to render every tagged responsible (e.g. EventDetailMulti's chip rack) should
 * read `event.responsibles` directly. This resolver is for "who's the one to color/
 * label this event by in the calendar grid" — a question that still has a singular
 * answer even when multiple parents are tagged.
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
        // #376: a soft-stopped schedule (disabled_at set) is treated the same
        // as no-schedule — falls through to the static field. The schedule row
        // itself is preserved so historical assignments stay readable, but
        // alternation lookups stop firing.
        if (!custodySchedule || custodySchedule.disabled_at) {
            // Configured for alternation but no (active) schedule → can't resolve.
            // Fall back to the static field (likely null), which the display
            // will render as Anyone.
            return leadFromResponsibles(event) ?? event.responsible_profile_id;
        }
        const lookupDate =
            event.responsible_alternation === 'previous_day'
                ? subDays(occurrenceDate, 1)
                : occurrenceDate;
        // #379: an 'AB' both-present day returns profileId: null. That
        // matches the resolver's "Anyone" semantics — neither parent is
        // canonically responsible when they're both home, so the event
        // displays as unassigned for that occurrence (consistent with how
        // alternation already handles missing data).
        return resolveCustodianOnDate(
            custodySchedule,
            custodyOverrides,
            lookupDate,
            event.timezone,
        ).profileId;
    }

    // Multi-responsible takes precedence over the legacy column; the legacy
    // column is kept as a fallback so unmigrated rows (or rows fetched before
    // the join was added) still resolve correctly.
    return leadFromResponsibles(event) ?? event.responsible_profile_id;
}

/**
 * Picks the lead profile_id from the multi-responsible list, or null when
 * the list is empty. Prefers the explicit `is_lead=true` row; if no row is
 * flagged (shouldn't happen with the partial unique index in 0039, but
 * defensive against partially-migrated data) falls back to the first row.
 */
function leadFromResponsibles(event: { responsibles: { profile_id: string; is_lead: boolean }[] }): string | null {
    if (!event.responsibles || event.responsibles.length === 0) return null;
    const explicit = event.responsibles.find((r) => r.is_lead);
    if (explicit) return explicit.profile_id;
    return event.responsibles[0].profile_id;
}
