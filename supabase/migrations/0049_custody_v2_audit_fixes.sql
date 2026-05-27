-- Custody v2 audit fixes — DB-side corrections from the UX + QA audit pass
-- run after migration 0048 landed.
--
-- Two changes in one migration so they version together:
--
--   (1) custody_schedules.handoff_day_index — convention fix.
--       0048 stored a smallint with default 0 and an ambiguous comment.
--       The editor renders Mon-first labels (`M T W T F S S`, cell 0 = Mon)
--       but the design source (screens-custody.jsx CustodyPatternEditor)
--       defaults the hand-off day to SUNDAY. With 0048's `default 0`, every
--       newly-created schedule loads with Monday selected — which is the
--       opposite of the design intent and silently miswires reads from the
--       viewer (which now drops its hardcoded `HANDOFF SUN 18:00` and reads
--       this column).
--
--       Canonical convention going forward: 0=Mon, 1=Tue, …, 5=Sat, 6=Sun.
--       Default → 6 (Sunday). Backfill: rows still on default 0 → set to 6.
--       This may overwrite a parent who *intentionally* picked Monday since
--       cell 0 was already the leftmost cell — but the count of such rows
--       is small (this column has only existed since 0048) and the
--       design's Sunday default is the safer fallback. If your dev/prod has
--       schedules where Monday was an explicit choice, you'll want to
--       re-verify those rows after this migration runs.
--
--   (2) swap_requests — block self-approval at the DB level.
--       0048 emitted only a structural `decision_complete` CHECK that says
--       "if status is accepted/declined, both decided_by and decided_at
--       must be set." It did NOT prevent the requester from setting
--       decided_by = requested_by themselves. RLS allows any household
--       parent to update the row, so without a UI gate (#399 design owns
--       it but the gate doesn't exist yet, and `decideSwapRequest` is
--       already exported), a parent can accept their own swap request.
--       Closes that hole with a CHECK constraint — defense in depth so the
--       hole stays closed even when the eventual review-screen flow
--       lands and a future bug or test path bypasses UI validation.

-- ─── (1) handoff_day_index convention fix ──────────────────────────────

-- Update the column default first so any future inserts that omit the
-- field land on Sunday per the design.
alter table public.custody_schedules
    alter column handoff_day_index set default 6;

-- Backfill existing rows that are still on the old default. We cannot
-- distinguish "user explicitly picked Monday" from "never edited," but
-- because the editor's cell 0 IS the Monday cell, anyone who saved with
-- 0 either took the default OR genuinely wanted Monday — and the latter
-- group can re-pick Monday in 1 tap once the convention is consistent.
-- Conservative: only update rows that haven't been touched since their
-- creation (no separate updated_at delta yet — fall back to a flat
-- update since the migration window is small).
update public.custody_schedules
    set handoff_day_index = 6
    where handoff_day_index = 0;

-- ─── (2) swap_requests self-approval guard ─────────────────────────────

-- The original constraint stays; we just add a sibling one that enforces
-- decided_by != requested_by when a decision was made. Two separate
-- constraints means the failure message points at the right invariant
-- depending on what's actually wrong.
alter table public.swap_requests
    add constraint swap_requests_no_self_approval
    check (
        decided_by_profile_id is null
        or decided_by_profile_id <> requested_by_profile_id
    );

-- Defense-in-depth on the RLS side too: tighten the update policy so the
-- requester can ONLY transition their own row to 'cancelled'. Any other
-- target status (accepted/declined) must come from a different parent.
-- Combined with the CHECK above, a self-approving SQL query against the
-- table fails twice — once at the policy layer (the requester can't UPDATE
-- to accepted/declined), and once at the constraint layer if the policy
-- is ever loosened.
drop policy if exists "swap_requests update parents" on public.swap_requests;
create policy "swap_requests update parents"
    on public.swap_requests for update
    using (public.is_household_parent(household_id))
    with check (
        public.is_household_parent(household_id)
        and (
            -- Requester can cancel their own pending row.
            (auth.uid() = requested_by_profile_id and status = 'cancelled')
            -- OR a different parent decides / un-decides.
            or auth.uid() <> requested_by_profile_id
        )
    );
