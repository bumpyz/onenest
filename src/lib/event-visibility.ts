// Personal-event visibility helpers (#466 + #469).
//
// Background: events.is_private was added in migration 0044 + threaded
// through the writer + EventForm toggle as part of #466. The toggle
// stored intent but every render site still leaked the title to all
// household viewers — this module is the enforcement layer.
//
// Rule: when an event is `is_private: true` AND the current viewer is
// NOT in the event's `responsibles` list, every surface should render
// it as a generic "Busy" block — no title, no location, no notes, no
// detail-screen access. Same vocabulary the app already uses for
// external paired-calendar busy blocks (household_busy_blocks).
//
// Why a shared helper instead of inline checks: render sites span
// Calendar week/day blocks, Calendar month preview, Home/Today rows,
// the conflict ribbon (which embeds the other event's title), and
// EventDetail itself. Centralizing the predicate keeps the policy
// consistent — if we later add per-household caregivers or external
// co-parents who should see through the gate, this is the one place
// to extend.

import type { Event } from './db';

/**
 * Returns true when the viewer should see this event as a generic
 * "Busy" block instead of its real content.
 *
 *   - `event.is_private === false` → never hidden (public event).
 *   - `viewerId == null` → hidden (logged-out / unknown viewer; safest
 *     default for a private event is "don't leak").
 *   - Otherwise: hidden iff the viewer isn't tagged as a responsible
 *     adult on the event.
 *
 * Note: this does NOT check household membership. The assumption is
 * that the data fetcher upstream (getEventsForRange + RLS) already
 * scoped to the viewer's household. This helper is purely the
 * "within-the-household, hide the title from non-responsibles" gate.
 *
 * Legacy-row fallback: the multi-responsible join table landed in
 * migration 0039. Rows created before that backfill ran can have
 * `responsibles: []` while still carrying the original owner in the
 * legacy `responsible_profile_id` column. Without the fallback, a
 * private event from before 0039 would hide *from its own owner* —
 * the join is empty so the responsibles.some() short-circuits to true
 * for "not tagged." Honoring the legacy column when the join is empty
 * matches the resolver's tolerance pattern (lib/responsible-resolver.ts)
 * and keeps the QA-found edge case from biting.
 */
export function shouldHideEventAsPrivate(
    event: Pick<Event, 'is_private' | 'responsibles' | 'responsible_profile_id'>,
    viewerId: string | null | undefined,
): boolean {
    if (!event.is_private) return false;
    if (!viewerId) return true;
    const responsibles = event.responsibles ?? [];
    // Fast path — non-legacy data: viewer-in-join check covers
    // single + multi-responsible cases set after migration 0039.
    if (responsibles.length > 0) {
        return !responsibles.some((r) => r.profile_id === viewerId);
    }
    // Legacy fallback — no join rows. Treat the legacy column as a
    // single-row implicit responsibles list so pre-0039 rows respect
    // the owner. If both are empty the event has no responsible at
    // all (truly unassigned); we hide from everyone, which is the
    // conservative default for an unassigned + private row.
    return event.responsible_profile_id !== viewerId;
}

/**
 * Generic label for an event the viewer can't see the details of.
 * Centralized so every render site uses the same copy — "Busy" is the
 * vocabulary external paired-calendar blocks already use, so private
 * OneNest events read as the same affordance class.
 */
export const PRIVATE_EVENT_BUSY_LABEL = 'Busy';
