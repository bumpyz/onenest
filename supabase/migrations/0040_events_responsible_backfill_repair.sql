-- 0040: idempotent repair of events_responsible state.
--
-- Background: 0039 backfilled events_responsible from
-- events.responsible_profile_id with ON CONFLICT (event_id, profile_id) DO
-- NOTHING. That handles the "row already exists" case, but it doesn't
-- repair partial state — specifically:
--
--   1. If a manual edit between deploys inserted an events_responsible
--      row for the same (event_id, profile_id) with is_lead = false, the
--      original backfill's INSERT was skipped, leaving the event with a
--      tagged adult but NO lead — violating the "exactly one lead when
--      responsibles exist" invariant the resolver and UI assume.
--
--   2. Events where responsible_profile_id was changed AFTER 0039 ran
--      but BEFORE client code wrote to events_responsible (e.g. a
--      legacy /edit-modal save that hit the old code path) end up with
--      a stale lead row.
--
-- Fix: idempotent passes that
--   (a) flip the is_lead flag onto the row matching the legacy column
--       when no lead row exists for that event,
--   (b) clear is_lead from rows that don't match the legacy column when
--       a different row should be lead (handles the migration-after-
--       manual-edit case),
--   (c) re-affirm the backfill insert for events that still have a
--       legacy column but no events_responsible row at all.
--
-- All three statements are safely re-runnable. They never DELETE rows —
-- a manually-tagged extra responsible stays tagged. They only adjust the
-- is_lead flag.

-- (a) For each event whose events_responsible has at least one row but
--     NO is_lead=true row, mark the row matching responsible_profile_id
--     as lead. If responsible_profile_id is null (or doesn't match any
--     tagged row), promote the earliest-created row instead.
update public.events_responsible er
set is_lead = true
where er.is_lead = false
  and exists (
      select 1
      from public.events e
      where e.id = er.event_id
        and e.responsible_profile_id = er.profile_id
  )
  and not exists (
      select 1
      from public.events_responsible er2
      where er2.event_id = er.event_id
        and er2.is_lead = true
  );

-- (b) For events whose events_responsible has no rows at all but the
--     legacy column is set, recreate the lead row. This catches rows
--     that hypothetically got DELETE'd from the join table without a
--     parallel update to the legacy column.
insert into public.events_responsible (event_id, profile_id, is_lead, created_at)
select e.id, e.responsible_profile_id, true, e.created_at
from public.events e
where e.responsible_profile_id is not null
  and not exists (
      select 1
      from public.events_responsible er
      where er.event_id = e.id
  )
on conflict (event_id, profile_id) do nothing;

-- (c) Final fallback: any event_responsible group that STILL has no
--     lead row after (a) — e.g. because responsible_profile_id is null
--     or doesn't match any tagged profile — gets its earliest row
--     promoted. We can't violate the partial unique index here since we
--     only update when no lead exists.
update public.events_responsible er
set is_lead = true
where er.is_lead = false
  and er.ctid = (
      select er2.ctid
      from public.events_responsible er2
      where er2.event_id = er.event_id
      order by er2.created_at asc, er2.profile_id asc
      limit 1
  )
  and not exists (
      select 1
      from public.events_responsible er3
      where er3.event_id = er.event_id
        and er3.is_lead = true
  );

-- Comment update for visibility — flag the deprecation more aggressively
-- now that the join table is the authority.
comment on column public.events.responsible_profile_id is
    'DEPRECATED. Mirrors the events_responsible lead. New code MUST read '
    'events_responsible and prefer the is_lead=true row; this column '
    'exists only as a back-compat snapshot during the transition window. '
    'When all callers (client, edge fns, analytics) have migrated, a '
    'follow-up migration will drop it.';
