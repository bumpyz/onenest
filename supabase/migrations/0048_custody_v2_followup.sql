-- Custody v2 follow-up cluster (#372–#379).
--
-- One migration covers the schema needs across the cluster:
--
--   (1) swap_requests table (#372) — pending swap proposals + their status.
--       Read-only banner on Family Hub for now; #399 will build the dedicated
--       review screen and the parent accept/decline flow.
--
--   (2) custody_schedules columns (#374, #375, #376):
--          handoff_time         — time of day the kids change hands
--          handoff_day_index    — which weekday the rotation flips on
--          handoff_location_id  — optional pickup/dropoff location
--          auto_assign          — auto-fill responsible from custody pattern
--          handoff_reminders    — push hand-off reminders
--          notify_externals     — share busy/free with external co-parent
--          disabled_at          — soft-stop for the "Stop using a pattern" flow
--
--   (3) custody_overrides.child_id (#373) — scope an override to one kid
--       (e.g. "Mei stays with Casey on Friday, others on the regular cycle").
--       NULL keeps today's whole-household semantics. The existing
--       unique(household_id, override_date) constraint can't survive — we
--       want exactly one override per (household, date, child) tuple,
--       including (household, date, NULL) for whole-household overrides.
--       Postgres treats NULLs as distinct in unique constraints by default,
--       which is actually what we want here: a whole-household override and
--       a per-child override can coexist on the same date (the resolver
--       prefers the per-child match, falling back to the household-wide).
--
--   (4) custody_schedules.cycle_days check loosened to allow 'AB' (#379).
--       Pre-existing rows are all A/B-only so the cast is safe. Resolver +
--       cycle_days editor learn to handle the third state in lib/custody.ts.
--
-- All changes are additive + nullable / defaulted. Existing rows continue
-- to work without backfill.

-- ─── (1) swap_requests ──────────────────────────────────────────────────

create table public.swap_requests (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    requested_by_profile_id uuid not null references public.profiles (id),
    -- NULL = whole-household swap (all kids that day move together).
    -- Non-NULL scopes the request to one child (e.g. only Mei swaps).
    affected_child_id uuid references public.children (id) on delete cascade,
    from_date date not null,
    -- Inclusive end of the swap range. Single-day swaps set to_date = from_date.
    to_date date not null,
    note text,
    -- pending: open, awaiting other-parent decision
    -- accepted: approved (downstream effect TBD by #399; for now the request
    --           just sits in 'accepted' and a parent manually adds the override)
    -- declined: rejected (kept for activity log)
    -- cancelled: requester withdrew it before a decision
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'declined', 'cancelled')),
    decided_by_profile_id uuid references public.profiles (id),
    decided_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint swap_requests_range_valid check (to_date >= from_date),
    constraint swap_requests_decision_complete check (
        (status in ('pending', 'cancelled') and decided_by_profile_id is null and decided_at is null)
        or (status in ('accepted', 'declined') and decided_by_profile_id is not null and decided_at is not null)
    )
);

-- Banner reads "pending" rows per household; the Family Hub query
-- filters on (status, created_at desc) so this index covers it.
create index swap_requests_household_status_idx
    on public.swap_requests (household_id, status, created_at desc);

alter table public.swap_requests enable row level security;

create policy "swap_requests read members"
    on public.swap_requests for select
    using (public.is_household_member(household_id));

create policy "swap_requests insert parents"
    on public.swap_requests for insert
    with check (
        public.is_household_parent(household_id)
        and requested_by_profile_id = auth.uid()
    );

-- Parents update: either the requester cancelling, or the other parent
-- deciding. The status-transition guards (e.g. you can't decide your own
-- request) live in the eventual /custody/swap/[id] flow, not here — RLS
-- only governs "can this user touch this row at all."
create policy "swap_requests update parents"
    on public.swap_requests for update
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

create policy "swap_requests delete parents"
    on public.swap_requests for delete
    using (public.is_household_parent(household_id));

create trigger swap_requests_touch_updated_at
    before update on public.swap_requests
    for each row execute function public.touch_updated_at();

-- ─── (2) custody_schedules new columns ──────────────────────────────────

alter table public.custody_schedules
    -- 18:00 matches the current hardcoded subtitle in /custody/schedule
    -- so existing households see no behavior change before they edit.
    add column if not exists handoff_time time not null default '18:00:00',
    -- 6 = Sunday in date-fns's 0-indexed-from-Sunday week (matches the
    -- existing pattern editor segmented control). Stored as smallint so
    -- the check constraint is straightforward.
    add column if not exists handoff_day_index smallint not null default 0
        check (handoff_day_index between 0 and 6),
    add column if not exists handoff_location_id uuid
        references public.locations (id) on delete set null,
    add column if not exists auto_assign boolean not null default true,
    add column if not exists handoff_reminders boolean not null default true,
    add column if not exists notify_externals boolean not null default false,
    -- Soft-stop. When set, the schedule row stays in place (so historical
    -- events keep their assignments) but every resolver treats the
    -- household as having no active pattern. Re-enable by clearing this.
    add column if not exists disabled_at timestamptz;

-- ─── (3) custody_overrides.child_id ─────────────────────────────────────

alter table public.custody_overrides
    add column if not exists child_id uuid
        references public.children (id) on delete cascade;

-- The original unique(household_id, override_date) is too strict — a
-- household-wide override AND a per-child override should be able to
-- coexist on the same date. Postgres's default "NULLs distinct" treatment
-- of unique constraints gives us exactly that without extra effort:
--   (household_x, 2026-05-26, NULL)            — household-wide override
--   (household_x, 2026-05-26, child_mei)       — Mei-specific override
--   (household_x, 2026-05-26, child_oliver)    — Oliver-specific override
-- All three can coexist; a second household-wide override on the same
-- date still collides (both rows have child_id IS NULL and unique
-- treats those as distinct, so we need an explicit guard below).
alter table public.custody_overrides
    drop constraint if exists custody_overrides_household_id_override_date_key;

create unique index if not exists custody_overrides_per_scope_unique
    on public.custody_overrides (household_id, override_date, child_id)
    where child_id is not null;

-- Whole-household overrides (child_id IS NULL): one per (household, date).
create unique index if not exists custody_overrides_household_wide_unique
    on public.custody_overrides (household_id, override_date)
    where child_id is null;

-- Refresh the lookup index to cover the new column.
drop index if exists public.custody_overrides_household_date_idx;
create index custody_overrides_household_date_child_idx
    on public.custody_overrides (household_id, override_date, child_id);

-- ─── (4) custody_schedules cycle 'AB' support ──────────────────────────

-- Drop the old A/B-only check; replace with one that allows 'AB' too.
-- The resolver in lib/custody.ts learns to treat 'AB' as "both parents
-- present" (#379 "Together this week" state).
alter table public.custody_schedules
    drop constraint if exists custody_cycle_ab_only;

alter table public.custody_schedules
    add constraint custody_cycle_labels_only
    check (cycle_days <@ array['A', 'B', 'AB']::text[]);
