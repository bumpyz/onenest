-- FamilyApp initial schema.
-- Designed for co-parenting: a "household" is a calendar scope, and a person can belong to many households.
-- Two divorced parents + their shared kid live in one "co-parent" household; each parent may also belong to their own home household.

create extension if not exists pgcrypto;

-- One row per signed-in user. Mirrors auth.users; populated by a trigger below.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null,
    avatar_url text,
    created_at timestamptz not null default now()
);

create table public.households (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now()
);

create type public.household_role as enum ('parent', 'caregiver', 'viewer');

create table public.household_members (
    household_id uuid not null references public.households (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    role public.household_role not null default 'parent',
    joined_at timestamptz not null default now(),
    primary key (household_id, profile_id)
);

create index household_members_profile_idx on public.household_members (profile_id);

create table public.children (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    display_name text not null,
    birthdate date,
    notes text,
    created_at timestamptz not null default now()
);

create index children_household_idx on public.children (household_id);

-- Shared, household-scoped calendar events. The "responsible" parent is who's on the hook
-- for the event (e.g. who's doing the school pickup); null means "either / not yet claimed".
create table public.events (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    title text not null,
    description text,
    location text,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    all_day boolean not null default false,
    created_by uuid not null references public.profiles (id),
    responsible_profile_id uuid references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint events_time_order check (ends_at >= starts_at)
);

create index events_household_starts_idx on public.events (household_id, starts_at);

create table public.event_children (
    event_id uuid not null references public.events (id) on delete cascade,
    child_id uuid not null references public.children (id) on delete cascade,
    primary key (event_id, child_id)
);

-- Custody schedule: who has the child(ren) when. A row with null child_id applies to all children in the household.
create table public.custody_periods (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    child_id uuid references public.children (id) on delete cascade,
    custodian_profile_id uuid not null references public.profiles (id),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    notes text,
    created_at timestamptz not null default now(),
    constraint custody_time_order check (ends_at > starts_at)
);

create index custody_household_starts_idx on public.custody_periods (household_id, starts_at);

-- Paired external calendars (work / personal email). Owner-private — RLS in 0002 enforces this.
create type public.calendar_provider as enum ('google', 'microsoft');

create table public.external_calendars (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles (id) on delete cascade,
    provider public.calendar_provider not null,
    external_account_email text not null,
    encrypted_access_token text not null,
    encrypted_refresh_token text,
    token_expires_at timestamptz,
    label text,
    is_active boolean not null default true,
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    unique (profile_id, provider, external_account_email)
);

-- Private events synced from a paired external calendar. profile_id is denormalized from
-- external_calendars to keep RLS cheap (no join on every read).
create table public.external_events (
    id uuid primary key default gen_random_uuid(),
    external_calendar_id uuid not null references public.external_calendars (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    external_event_id text not null,
    title text,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    is_busy boolean not null default true,
    is_all_day boolean not null default false,
    synced_at timestamptz not null default now(),
    unique (external_calendar_id, external_event_id)
);

create index external_events_profile_starts_idx on public.external_events (profile_id, starts_at);

-- Auto-create a profile row when a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data ->> 'avatar_url'
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Keep events.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger events_touch_updated_at
    before update on public.events
    for each row execute function public.touch_updated_at();
