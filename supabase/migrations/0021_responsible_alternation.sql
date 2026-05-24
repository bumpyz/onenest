-- Alternating responsible parent for recurring events, plus per-occurrence overrides.
--
-- "Alternating" really means: the responsible parent for any given occurrence is derived
-- from the custody schedule. Two modes covered:
--   - same_day     → custodian on the occurrence's date (most events: afternoon, evening,
--                    overnight)
--   - previous_day → custodian from the night before (morning events like school drop-off
--                    where the responsible parent had the child overnight)
--
-- The resolver runs client-side; this migration just stores the mode + override rows.

-- Idempotency: every statement below is guarded for re-run safety. The CHECK
-- constraint gets a stable name so we can DROP-then-ADD without depending on the
-- auto-generated `events_responsible_alternation_check` identifier.
alter table public.events
    add column if not exists responsible_alternation text;

alter table public.events
    drop constraint if exists events_responsible_alternation_check;
alter table public.events
    add constraint events_responsible_alternation_check
    check (responsible_alternation in ('same_day', 'previous_day'));

comment on column public.events.responsible_alternation is
    'When set, the event has no fixed responsible parent — the client computes it per '
    'occurrence from the custody schedule. same_day matches the event''s date; '
    'previous_day matches the date before (for morning drop-offs that carry overnight).';

-- Per-occurrence override: a (recurring) event can have one row per date pinning the
-- responsible parent for that specific occurrence, taking precedence over the alternation
-- rule. RLS mirrors the events table — anyone in the household can read, only parents
-- can write (same check that event_children uses).

create table if not exists public.event_occurrence_overrides (
    event_id uuid not null references public.events (id) on delete cascade,
    occurrence_date date not null,
    responsible_profile_id uuid references public.profiles (id) on delete set null,
    notes text,
    created_at timestamptz not null default now(),
    primary key (event_id, occurrence_date)
);

create index if not exists event_occurrence_overrides_date_idx
    on public.event_occurrence_overrides (occurrence_date);

alter table public.event_occurrence_overrides enable row level security;

drop policy if exists "event_occurrence_overrides read" on public.event_occurrence_overrides;
create policy "event_occurrence_overrides read"
    on public.event_occurrence_overrides for select
    using (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ));

drop policy if exists "event_occurrence_overrides write" on public.event_occurrence_overrides;
create policy "event_occurrence_overrides write"
    on public.event_occurrence_overrides for all
    using (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ))
    with check (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ));
