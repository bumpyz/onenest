-- Custody overrides: per-day exceptions to the household's custody_schedules pattern.
-- The client always consults overrides first when computing the custodian for a date; the
-- pattern is the fallback.

create table public.custody_overrides (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    override_date date not null,
    custodian_profile_id uuid not null references public.profiles (id),
    note text,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (household_id, override_date)
);

create index custody_overrides_household_date_idx
    on public.custody_overrides (household_id, override_date);

alter table public.custody_overrides enable row level security;

create policy "custody_overrides read members"
    on public.custody_overrides for select
    using (public.is_household_member(household_id));

create policy "custody_overrides insert parents"
    on public.custody_overrides for insert
    with check (public.is_household_parent(household_id) and created_by = auth.uid());

create policy "custody_overrides update parents"
    on public.custody_overrides for update
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

create policy "custody_overrides delete parents"
    on public.custody_overrides for delete
    using (public.is_household_parent(household_id));

create trigger custody_overrides_touch_updated_at
    before update on public.custody_overrides
    for each row execute function public.touch_updated_at();
