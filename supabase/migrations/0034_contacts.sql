-- Contacts: household-scoped list of frequently-dialed people. Caregiver,
-- handyman, gardener, pediatrician — anyone whose number the household
-- wants one tap away. Tap a row in the Contacts tab → confirm → dial.
--
-- Permissions model:
--   * Read: any household member (is_household_member). Caregivers need to
--     be able to call the handyman if the kitchen sink starts spraying;
--     locking them out would defeat the point of having them in the
--     household at all.
--   * Write (insert/update/delete): parents only (is_household_parent).
--     Contacts are a parent-curated list, same as locations and children.
--     A caregiver shouldn't be able to silently add a number to the household's
--     emergency-dialer surface.
--
-- Schema notes:
--   * `phone` is stored as a free-form string. Phone-number validation is a
--     swamp (international formats, extensions, click-to-dial conventions),
--     and `tel:` URI handlers on every modern OS already strip non-digit
--     chars at dial time. We trust the user to enter something dialable.
--   * `company` + `descriptor` both nullable. Most contacts won't have a
--     company; descriptor is the freeform short label ("plumber",
--     "babysitter", "doctor") that helps a stressed-out user locate the
--     right row without reading every name.
--   * `sort_order` lets users hand-order their list. Same int-with-gaps
--     scheme as lists/children — new rows append with max+1.
--
-- Idempotent: CREATE IF NOT EXISTS / DROP-then-CREATE for policies.

create table if not exists public.contacts (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    name text not null check (length(trim(name)) > 0),
    -- Free-form phone string. Whatever the user typed, the client passes
    -- to `tel:` which strips non-digits before dialing. No format check
    -- at the DB layer.
    phone text not null check (length(trim(phone)) > 0),
    company text,
    descriptor text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists contacts_household_sort_idx
    on public.contacts (household_id, sort_order, created_at);

-- Updated-at trigger pattern (mirrors other tables in the project).
create or replace function public.contacts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at
    before update on public.contacts
    for each row execute function public.contacts_touch_updated_at();

alter table public.contacts enable row level security;

-- Read: any household member. Caregivers see + dial.
drop policy if exists "contacts read" on public.contacts;
create policy "contacts read"
    on public.contacts for select
    using (public.is_household_member(household_id));

-- Write: parents only. Caregivers cannot add / rename / delete.
drop policy if exists "contacts write" on public.contacts;
create policy "contacts write"
    on public.contacts for all
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));
