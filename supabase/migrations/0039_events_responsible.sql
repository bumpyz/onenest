-- Multi-responsible events: replace the single `events.responsible_profile_id`
-- column with an `events_responsible` join table where one row per (event,
-- responsible adult) lives, with `is_lead` flagging the primary responsible.
--
-- Why a separate table instead of an array column on events:
--   - Tagging IS the sharing primitive. Adding/removing rows from this table
--     is the "share this event with X" action. Array semantics are clunkier
--     for RLS (which is row-scoped) and for analytics joins.
--   - External co-parents and caregivers are valid `profile_id` values here —
--     same row shape, same semantics. The "Tagging = visibility" rule (anyone
--     tagged sees the full event; anyone NOT tagged sees only Busy) is what
--     unlocks cross-household visibility without a separate share dialog.
--   - Per-occurrence override and alternation logic still live on the event
--     row (responsible_alternation column, event_occurrence_overrides table).
--     Those compose with this list: the resolver picks the lead, the
--     alternation modifies who-on-this-date for the lead seat, etc.
--
-- Backward compat: we keep `events.responsible_profile_id` as a deprecated
-- column mirroring the current lead. Writers update both during the
-- transition window; readers prefer the join table when populated and fall
-- back to the legacy column for unmigrated rows. The drop ships in a later
-- migration once all callers have migrated.

create table if not exists public.events_responsible (
    event_id uuid not null references public.events (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    -- Exactly one row per event should have is_lead=true. We enforce this
    -- with a partial unique index rather than a per-row CHECK because the
    -- "exactly one" constraint is across rows, not per-row.
    is_lead boolean not null default false,
    created_at timestamptz not null default now(),
    primary key (event_id, profile_id)
);

-- Partial unique index: at most one is_lead=true row per event. Combined
-- with the application enforcing "at least one when responsibles exist",
-- this gives us the "exactly one lead per event with responsibles" invariant.
create unique index if not exists events_responsible_lead_per_event_idx
    on public.events_responsible (event_id)
    where is_lead = true;

-- Lookup by responsible profile (e.g. "all events I'm tagged on across
-- households") is the multi-home read path. Without this index it scans.
create index if not exists events_responsible_profile_idx
    on public.events_responsible (profile_id);

comment on table public.events_responsible is
    'Multi-responsible event tagging. Each row = one adult tagged as responsible '
    'for an event. is_lead=true marks the primary responsible (gets the primary '
    'push, shows the LEAD chip in UI). Tagging IS the sharing primitive — anyone '
    'tagged sees the full event across households; anyone NOT tagged sees only '
    '"Busy" in that time slot. External co-parents and caregivers are valid '
    'profile_id values here.';

comment on column public.events_responsible.is_lead is
    'Exactly one row per event should have is_lead=true when responsibles exist. '
    'The lead receives the primary push notification when reminders fire; other '
    'responsibles get a secondary FYI push. Enforced as a partial unique index '
    'on (event_id) where is_lead.';

alter table public.events_responsible enable row level security;

-- RLS mirrors the existing event_children / event_occurrence_overrides
-- pattern: anyone in the event's household can read; only members can write.
-- The same is_household_member SECURITY DEFINER function is reused so the
-- recursion-prevention work in 0033 carries over.
drop policy if exists "events_responsible read" on public.events_responsible;
create policy "events_responsible read"
    on public.events_responsible for select
    using (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ));

drop policy if exists "events_responsible write" on public.events_responsible;
create policy "events_responsible write"
    on public.events_responsible for all
    using (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ))
    with check (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ));

-- Backfill: for every existing event with a non-null responsible_profile_id,
-- create a corresponding events_responsible row marked is_lead. Idempotent
-- via ON CONFLICT DO NOTHING so re-running the migration is safe.
--
-- We deliberately do NOT touch events whose responsible_profile_id is null
-- (Anyone / unassigned) — those become "0 responsibles" in the new model,
-- consistent with their original meaning.
insert into public.events_responsible (event_id, profile_id, is_lead, created_at)
select e.id, e.responsible_profile_id, true, e.created_at
from public.events e
where e.responsible_profile_id is not null
on conflict (event_id, profile_id) do nothing;

-- Deprecation marker on the legacy column. We don't drop it yet because:
--   1. RLS policies on related tables may still join on it (audit needed).
--   2. The sunday-summary edge function reads it; needs to ship updated
--      before the column can go.
--   3. Analytics dashboards (if any) that bucket events by responsible
--      need to switch to joining events_responsible first.
-- The drop will land in a follow-up migration once all callers are clean.
comment on column public.events.responsible_profile_id is
    'DEPRECATED. Mirrors the lead from events_responsible during the '
    'multi-responsible transition. New code should read from events_responsible '
    'and treat the row with is_lead=true as the primary responsible. This '
    'column will be dropped in a future migration once all callers (client, '
    'edge functions, analytics) have migrated.';
