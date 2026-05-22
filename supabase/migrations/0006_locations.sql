-- Per-household saved locations (School, Soccer field, etc.) with an optional Google Maps link.
-- Linked from events via events.location_id; the legacy events.location text column stays for
-- backwards compat and as a fallback display when an event has no FK.

create table public.locations (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    name text not null,
    google_maps_url text,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    unique (household_id, name)
);

create index locations_household_idx on public.locations (household_id);

alter table public.locations enable row level security;

create policy "locations read members"
    on public.locations for select
    using (public.is_household_member(household_id));

create policy "locations insert members"
    on public.locations for insert
    with check (
        public.is_household_member(household_id)
        and created_by = auth.uid()
    );

create policy "locations update members"
    on public.locations for update
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));

create policy "locations delete parents"
    on public.locations for delete
    using (public.is_household_parent(household_id));

alter table public.events
    add column location_id uuid references public.locations (id) on delete set null;

create index events_location_id_idx on public.events (location_id);

-- Backfill: for each existing event with a non-empty location text, find or create a matching
-- locations row in the same household and link the event to it. The legacy text column is left
-- in place so older events that never go through the new flow keep displaying their original text.
insert into public.locations (household_id, name, created_by)
select distinct e.household_id, e.location, e.created_by
from public.events e
where e.location is not null and e.location <> ''
on conflict (household_id, name) do nothing;

update public.events e
set location_id = l.id
from public.locations l
where e.location_id is null
  and e.location is not null
  and e.location <> ''
  and l.household_id = e.household_id
  and l.name = e.location;
