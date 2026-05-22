import type { Event, HouseholdBusyBlock } from './db';

export type Conflict = {
    event: Event;
    /** profile_id of the parent who's both responsible for the event AND busy at the same time */
    profileId: string;
    /** The conflicting busy block's window (for explanatory text in the UI). */
    blockStartsAt: string;
    blockEndsAt: string;
};

export type WeekSummary = {
    conflicts: Conflict[];
    /** Events with responsible_profile_id == null. Worth flagging so someone claims them. */
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
 * event's responsible parent has an overlapping busy window in one of their paired calendars.
 * Also returns events that have no one assigned, so the household can claim them.
 *
 * We never see the *titles* of other parents' busy blocks (that's gated by RLS / the
 * household_busy_blocks SECURITY DEFINER function) — just times, which is exactly enough to
 * detect conflicts without leaking event detail.
 */
export function computeWeekSummary(
    events: Event[],
    busyBlocks: HouseholdBusyBlock[],
): WeekSummary {
    const conflicts: Conflict[] = [];
    for (const event of events) {
        if (!event.responsible_profile_id) continue;
        // First overlapping block per (event, profile) is enough — don't flood the summary
        // with N entries for one event that spans several stacked meetings.
        const block = busyBlocks.find(
            (b) =>
                b.profile_id === event.responsible_profile_id &&
                overlapsMs(event.starts_at, event.ends_at, b.starts_at, b.ends_at),
        );
        if (block) {
            conflicts.push({
                event,
                profileId: event.responsible_profile_id,
                blockStartsAt: block.starts_at,
                blockEndsAt: block.ends_at,
            });
        }
    }

    const unassignedEvents = events.filter((e) => !e.responsible_profile_id);

    // Sort each list chronologically so the soonest issues come first.
    conflicts.sort(
        (a, b) =>
            new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime(),
    );
    unassignedEvents.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

    return { conflicts, unassignedEvents };
}
