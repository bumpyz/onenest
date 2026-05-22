-- Custody schedules: one per household, defines a repeating A/B day pattern.
-- The actual daily custodian is computed by the client from (anchor_date, cycle_days[],
-- parent_a_profile_id, parent_b_profile_id) — we don't materialize individual day rows.

create table public.custody_schedules (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    pattern_id text not null,
    cycle_days text[] not null,
    parent_a_profile_id uuid not null references public.profiles (id),
    parent_b_profile_id uuid not null references public.profiles (id),
    anchor_date date not null,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint custody_cycle_nonempty check (array_length(cycle_days, 1) > 0),
    constraint custody_cycle_ab_only check (cycle_days <@ array['A', 'B']::text[]),
    constraint custody_parents_distinct check (parent_a_profile_id <> parent_b_profile_id)
);

-- One active schedule per household. To change, the row is updated in place; to remove,
-- it's deleted.
create unique index custody_schedules_household_unique
    on public.custody_schedules (household_id);

alter table public.custody_schedules enable row level security;

create policy "custody_schedules read members"
    on public.custody_schedules for select
    using (public.is_household_member(household_id));

create policy "custody_schedules insert parents"
    on public.custody_schedules for insert
    with check (public.is_household_parent(household_id) and created_by = auth.uid());

create policy "custody_schedules update parents"
    on public.custody_schedules for update
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

create policy "custody_schedules delete parents"
    on public.custody_schedules for delete
    using (public.is_household_parent(household_id));

create trigger custody_schedules_touch_updated_at
    before update on public.custody_schedules
    for each row execute function public.touch_updated_at();
