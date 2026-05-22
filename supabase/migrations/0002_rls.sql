-- Row-level security policies for FamilyApp.
-- Privacy model: shared household data is visible to all household members; external-calendar events are owner-only.
-- A SECURITY DEFINER function projects external events into opaque "busy" blocks for the rest of the household.

-- Helper functions bypass RLS on household_members to avoid recursion in policies and stay cheap.

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select exists (
        select 1 from public.household_members
        where household_id = p_household_id and profile_id = auth.uid()
    );
$$;

create or replace function public.is_household_parent(p_household_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select exists (
        select 1 from public.household_members
        where household_id = p_household_id
          and profile_id = auth.uid()
          and role = 'parent'
    );
$$;

create or replace function public.shares_household_with(p_other_profile_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select exists (
        select 1
        from public.household_members me
        join public.household_members them on them.household_id = me.household_id
        where me.profile_id = auth.uid() and them.profile_id = p_other_profile_id
    );
$$;

-- Enable RLS on every table.

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.children enable row level security;
alter table public.events enable row level security;
alter table public.event_children enable row level security;
alter table public.custody_periods enable row level security;
alter table public.external_calendars enable row level security;
alter table public.external_events enable row level security;

-- profiles: see self and any profile you share a household with.

create policy "profiles read self or shared household"
    on public.profiles for select
    using (id = auth.uid() or public.shares_household_with(id));

create policy "profiles update self"
    on public.profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

-- households: visible to members; any signed-in user can create one (and becomes its creator).

create policy "households read members"
    on public.households for select
    using (public.is_household_member(id));

create policy "households insert authenticated"
    on public.households for insert
    with check (auth.uid() is not null and created_by = auth.uid());

create policy "households update parents"
    on public.households for update
    using (public.is_household_parent(id))
    with check (public.is_household_parent(id));

create policy "households delete parents"
    on public.households for delete
    using (public.is_household_parent(id));

-- household_members: members can see the roster; parents can add/remove members; anyone can remove themselves.

create policy "household_members read members"
    on public.household_members for select
    using (public.is_household_member(household_id));

create policy "household_members insert parents"
    on public.household_members for insert
    with check (public.is_household_parent(household_id) or profile_id = auth.uid());

create policy "household_members delete parents or self"
    on public.household_members for delete
    using (public.is_household_parent(household_id) or profile_id = auth.uid());

create policy "household_members update parents"
    on public.household_members for update
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

-- children: full access for members; only parents can mutate.

create policy "children read members"
    on public.children for select
    using (public.is_household_member(household_id));

create policy "children insert parents"
    on public.children for insert
    with check (public.is_household_parent(household_id));

create policy "children update parents"
    on public.children for update
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

create policy "children delete parents"
    on public.children for delete
    using (public.is_household_parent(household_id));

-- events: any member can read or create; any member can update (including claiming carpool); only the creator or a parent can delete.

create policy "events read members"
    on public.events for select
    using (public.is_household_member(household_id));

create policy "events insert members"
    on public.events for insert
    with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "events update members"
    on public.events for update
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));

create policy "events delete creator or parent"
    on public.events for delete
    using (public.is_household_parent(household_id) or created_by = auth.uid());

-- event_children mirrors event access.

create policy "event_children read"
    on public.event_children for select
    using (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ));

create policy "event_children write"
    on public.event_children for all
    using (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ))
    with check (exists (
        select 1 from public.events e
        where e.id = event_id and public.is_household_member(e.household_id)
    ));

-- custody_periods: any member can read; parents can mutate.

create policy "custody read members"
    on public.custody_periods for select
    using (public.is_household_member(household_id));

create policy "custody write parents"
    on public.custody_periods for all
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

-- external_calendars and external_events: owner-only. No exceptions; the busy projection below
-- is the only way other household members touch this data.

create policy "external_calendars owner all"
    on public.external_calendars for all
    using (profile_id = auth.uid())
    with check (profile_id = auth.uid());

create policy "external_events owner all"
    on public.external_events for all
    using (profile_id = auth.uid())
    with check (profile_id = auth.uid());

-- household_busy_blocks: privileged projection of external_events into opaque busy windows.
-- Caller must be a member of the household; returns only (profile_id, starts_at, ends_at, is_all_day)
-- with no titles, locations, or attendees.

create or replace function public.household_busy_blocks(
    p_household_id uuid,
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    profile_id uuid,
    starts_at timestamptz,
    ends_at timestamptz,
    is_all_day boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if not public.is_household_member(p_household_id) then
        raise exception 'not a member of household %', p_household_id using errcode = '42501';
    end if;

    return query
    select ee.profile_id, ee.starts_at, ee.ends_at, ee.is_all_day
    from public.external_events ee
    join public.household_members hm on hm.profile_id = ee.profile_id
    where hm.household_id = p_household_id
      and ee.is_busy = true
      and tstzrange(ee.starts_at, ee.ends_at, '[)') && tstzrange(p_from, p_to, '[)');
end;
$$;

revoke all on function public.household_busy_blocks(uuid, timestamptz, timestamptz) from public;
grant execute on function public.household_busy_blocks(uuid, timestamptz, timestamptz) to authenticated;
