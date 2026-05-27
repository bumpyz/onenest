import type {
    CustodyOverride,
    CustodySchedule,
    Event,
    EventOccurrenceOverride,
    HouseholdBusyBlock,
} from './db';
import { resolveResponsibleProfileId } from './responsible-resolver';

export type Conflict = {
    event: Event;
    /** profile_id of the parent who's responsible for `event`. For
     *  external-busy-block conflicts they're also the one who's busy.
     *  For event-vs-event conflicts they're the resolved responsible
     *  on `event` (which may differ from `withEvent`'s responsible when
     *  the conflict is driven by a shared child, not a shared parent).
     *  Empty string is allowed when `event` has no resolvable
     *  responsible (e.g. an unassigned event participating in a
     *  child-only conflict) — the UI falls back to generic copy. */
    profileId: string;
    /** The conflicting window — either an external busy block from a
     *  paired calendar, or another OneNest event in the household with
     *  the same resolved responsible parent / a shared child. */
    blockStartsAt: string;
    blockEndsAt: string;
    /** Present only when the conflict is event-vs-event. Lets the UI
     *  render "conflicts with <other event title>" instead of the
     *  generic "Busy" copy used for external-calendar conflicts.
     *  Absent when the conflict is event-vs-external-busy-block. */
    withEvent?: Event;
    /** Present only when the event-vs-event conflict is driven by a
     *  shared child (kid can't be in two places at once), as opposed
     *  to a shared responsible parent. The id of the shared child —
     *  when more than one child overlaps, this is the first one. Lets
     *  the UI tell the two cases apart and render kid-centric copy
     *  ("Sam is also at …") for the child-double-booking case. */
    withChildId?: string;
};

export type WeekSummary = {
    conflicts: Conflict[];
    /** Events with no resolvable responsible parent — either explicit "Anyone" (no
     *  alternation, no responsible_profile_id) or an alternation event landing on a
     *  day the custody schedule can't answer for. Worth flagging so someone claims it. */
    unassignedEvents: Event[];
};

function overlapsMs(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string,
): boolean {
    const aS = new Date(aStart).getTime();
    const aE = new Date(aEnd).getTime();
    const bS = new Date(bStart).getTime();
    const bE = new Date(bEnd).getTime();
    return aS < bE && bS < aE;
}

/**
 * Compares each event against the household's busy blocks and reports conflicts where the
 * event's resolved responsible parent has an overlapping busy window in one of their
 * paired calendars. Also returns events that have no one assigned, so the household can
 * claim them.
 *
 * Resolution honors both alternation and per-occurrence overrides via
 * resolveResponsibleProfileId — events with alternation=previous_day/same_day carry
 * responsible_profile_id=null in storage but resolve to a concrete parent for each
 * occurrence based on the custody schedule. Without this, every alternation event
 * showed up as "unassigned" in the summary even though it had a valid resolved owner.
 *
 * We never see the *titles* of other parents' busy blocks (that's gated by RLS / the
 * household_busy_blocks SECURITY DEFINER function) — just times, which is exactly enough
 * to detect conflicts without leaking event detail.
 */
export function computeWeekSummary(
    events: Event[],
    busyBlocks: HouseholdBusyBlock[],
    custodySchedule: CustodySchedule | null,
    custodyOverrides: Map<string, CustodyOverride>,
    occurrenceOverrides: Map<string, EventOccurrenceOverride>,
): WeekSummary {
    const conflicts: Conflict[] = [];
    const unassignedEvents: Event[] = [];

    // Pre-resolve every event's responsible profiles so we can do BOTH
    // the busy-block check AND the cross-event check without re-running
    // the resolver (it's pure but does a custody cycle lookup per call).
    //
    // Multi-responsible: `resolved` holds the lead's profile_id for the
    // single-color/single-name UI (Calendar block tinting, conflict ribbon
    // label), and `allResponsibleIds` holds every tagged adult so the
    // busy-block + cross-event passes iterate the full set. A birthday
    // tagged on Alex + Riley conflicts with EITHER's busy block, and with
    // any other event that shares ANY of those parents.
    type EventWithResolved = {
        event: Event;
        resolved: string | null;
        allResponsibleIds: string[];
    };
    const resolvedRows: EventWithResolved[] = events.map((event) => {
        const lead = resolveResponsibleProfileId({
            event,
            occurrenceDate: new Date(event.starts_at),
            custodySchedule,
            custodyOverrides,
            occurrenceOverrides,
        });
        // Multi-responsible: take the full list of tagged profiles. Fall
        // back to the resolved lead alone for events that haven't been
        // touched by the new model yet (legacy rows with no
        // events_responsible entries, or alternation/override-driven rows
        // whose effective responsible isn't in the tagged list).
        const tagged = (event.responsibles ?? []).map((r) => r.profile_id);
        const allResponsibleIds =
            tagged.length > 0
                ? Array.from(new Set([...tagged, ...(lead ? [lead] : [])]))
                : lead
                  ? [lead]
                  : [];
        return { event, resolved: lead, allResponsibleIds };
    });

    // Pass 1: event vs external busy block — iterate ALL responsibles.
    // Each tagged adult has their own busy calendar; an event tagged on
    // Alex + Riley conflicts with EITHER's busy block. We emit one
    // Conflict entry per (event, busy_profile) — the same event can show
    // up twice if both responsibles are busy at the same time, which is
    // the right behavior (each parent's "this overlaps me" is its own
    // signal).
    for (const { event, allResponsibleIds } of resolvedRows) {
        if (allResponsibleIds.length === 0) {
            unassignedEvents.push(event);
            continue;
        }
        // Track which responsible-profiles we've already emitted a
        // conflict for on this event, to avoid double-emitting when a
        // single profile has multiple overlapping busy blocks (e.g. two
        // back-to-back meetings). First overlap per profile is enough
        // signal.
        const seen = new Set<string>();
        for (const block of busyBlocks) {
            if (!allResponsibleIds.includes(block.profile_id)) continue;
            if (seen.has(block.profile_id)) continue;
            if (
                !overlapsMs(
                    event.starts_at,
                    event.ends_at,
                    block.starts_at,
                    block.ends_at,
                )
            )
                continue;
            seen.add(block.profile_id);
            conflicts.push({
                event,
                profileId: block.profile_id,
                blockStartsAt: block.starts_at,
                blockEndsAt: block.ends_at,
            });
        }
    }

    // Pass 2 & 3 (combined): event vs OTHER event in the same household.
    //   Pass 2 — same responsible parent: two events for "Alex" at the
    //     same time can't both be Alex's responsibility.
    //   Pass 3 — shared child with different parents: a kid can't be
    //     in two places at once, even if Alex is on one event and
    //     Jamie is on the other. Surface from the child's POV so the
    //     household sees the double-booking.
    //
    // Folded into one i < j pair walk so we do the time-overlap check
    // (the expensive bit) at most once per pair. Each pass emits one
    // Conflict per event direction (so the per-event filter on Home /
    // EventDetail reads accurately).
    //
    // Skip the bucketing optimization for now — typical weeks have
    // < 30 events so O(n²) is fine. If perf bites later, bucket by
    // `resolved` for Pass 2 and by `child_id` for Pass 3.
    for (let i = 0; i < resolvedRows.length; i++) {
        const a = resolvedRows[i];
        for (let j = i + 1; j < resolvedRows.length; j++) {
            const b = resolvedRows[j];
            // Multi-responsible: events conflict on responsible parent
            // when ANY tagged parent on one appears on the other too —
            // not just when their leads match. A birthday tagged on
            // Alex+Riley conflicts with Alex's other Wednesday event AND
            // Riley's other Wednesday event.
            //
            // Preference order when picking which profile labels the
            // conflict (QA-found drift — arbitrary first-intersection
            // could attribute to a non-lead even when one event's lead
            // is the actual double-booking center):
            //   1. event a's lead, if it's also tagged on event b
            //   2. event b's lead, if it's also tagged on event a
            //   3. any other shared profile (first match)
            // This way "Alex is responsible for both" reads as Alex,
            // not as whichever helper happens to be tagged on both.
            const sharedResponsibleId =
                (a.resolved &&
                b.allResponsibleIds.includes(a.resolved)
                    ? a.resolved
                    : null) ??
                (b.resolved &&
                a.allResponsibleIds.includes(b.resolved)
                    ? b.resolved
                    : null) ??
                a.allResponsibleIds.find((pid) =>
                    b.allResponsibleIds.includes(pid),
                ) ??
                null;
            const sameResponsible = sharedResponsibleId !== null;
            // Look for shared children only when there's at least one
            // child on each side — cheap pre-check before the .find.
            const aKids = a.event.child_ids ?? [];
            const bKids = b.event.child_ids ?? [];
            const sharedChildId =
                aKids.length > 0 && bKids.length > 0
                    ? (aKids.find((cid) => bKids.includes(cid)) ?? null)
                    : null;
            // Bail before the date math if neither pass would fire.
            if (!sameResponsible && !sharedChildId) continue;
            if (
                !overlapsMs(
                    a.event.starts_at,
                    a.event.ends_at,
                    b.event.starts_at,
                    b.event.ends_at,
                )
            ) {
                continue;
            }
            if (sameResponsible) {
                // Pass 2: at least one tagged responsible appears on both
                // events. We use `sharedResponsibleId` (the first
                // intersection) for the profileId field so the conflict
                // ribbon labels the right person — typically the same
                // adult who's actually double-booked, which reads more
                // accurately than tinting by lead.
                conflicts.push({
                    event: a.event,
                    profileId: sharedResponsibleId as string,
                    blockStartsAt: b.event.starts_at,
                    blockEndsAt: b.event.ends_at,
                    withEvent: b.event,
                });
                conflicts.push({
                    event: b.event,
                    profileId: sharedResponsibleId as string,
                    blockStartsAt: a.event.starts_at,
                    blockEndsAt: a.event.ends_at,
                    withEvent: a.event,
                });
                // When the parents also share a child, the parent-level
                // conflict already covers the situation — don't emit a
                // second pair of "kid double-booked" entries for the
                // same overlap.
                continue;
            }
            if (sharedChildId) {
                // Pass 3: shared child, different (or unresolved)
                // responsibles. profileId stays the per-event resolved
                // owner so coloring/labeling on the event's own side
                // still works; empty string when unassigned (UI falls
                // back to generic copy).
                conflicts.push({
                    event: a.event,
                    profileId: a.resolved ?? '',
                    blockStartsAt: b.event.starts_at,
                    blockEndsAt: b.event.ends_at,
                    withEvent: b.event,
                    withChildId: sharedChildId,
                });
                conflicts.push({
                    event: b.event,
                    profileId: b.resolved ?? '',
                    blockStartsAt: a.event.starts_at,
                    blockEndsAt: a.event.ends_at,
                    withEvent: a.event,
                    withChildId: sharedChildId,
                });
            }
        }
    }

    // Filter out conflicts on events that have already ended. A past
    // meeting can't be rescheduled, so the conflict has no actionable
    // resolution — surfacing the warn-tinted bug on the Week view block
    // (and an entry in the Home summary) is just noise.
    //
    // This also closes a UX asymmetry: `useWeekSummary` only fetches
    // events from today forward, so the /conflict/[id] resolver screen
    // and the Home digest never saw past conflicts anyway. The calendar
    // was the lone holdout that re-ran computeWeekSummary against the
    // *full visible week* (including past days) and surfaced badges
    // pointing at dead conflicts — tapping the bug then took users to a
    // resolver screen that said "No active conflicts on this event,"
    // which read as a bug.
    //
    // Use ends_at, not starts_at: a meeting from 1-2pm that conflicts
    // with another 1:30-2:30 still has a live conflict at 1:45pm — drop
    // only once everything's truly in the past. Same convention as the
    // existing `clampEventToVisibleRange` past-day fade.
    const now = Date.now();
    const stillActiveConflicts = conflicts.filter(
        (c) => new Date(c.event.ends_at).getTime() >= now,
    );

    // Sort each list chronologically so the soonest issues come first.
    stillActiveConflicts.sort(
        (a, b) =>
            new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime(),
    );
    unassignedEvents.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

    return { conflicts: stillActiveConflicts, unassignedEvents };
}
