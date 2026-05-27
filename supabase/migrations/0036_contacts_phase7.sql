-- Phase 7 contact-screen redesign — schema bump.
--
-- Adds the eight fields the redesigned Contacts + Contact Detail screens
-- depend on (screens-extra.jsx:1238 / :1659). These were green-fielded for
-- this phase rather than predicted at table creation in migration 0034 so
-- the original schema could stay tight while we figured out which fields
-- earned their keep. The audit's product call (Phase 7 = "Full schema
-- buildout") was to add them all in one pass rather than dribbling them
-- in across phases.
--
-- Fields:
--   * category — short string with a CHECK constraint covering the design's
--     five known categories + 'other' (default). Text rather than enum so
--     a) we don't have to maintain a Postgres enum across migrations,
--     b) we can grow categories without a follow-up DDL. The CHECK still
--     gives us a closed set the UI can rely on for chip filters.
--   * is_favorite — boolean. Powers the Favorites strip at top of /contacts.
--   * is_emergency — boolean. Powers the Emergency strip pinned above the
--     category sections. A contact can be both favorite + emergency.
--   * email — text, optional. The detail screen exposes a mailto link.
--   * best_time — free text, e.g. "After 4 PM" or "Weekends only". No
--     schema; this is a human-readable hint, not a parsed window.
--   * address — free text, optional. The detail screen renders a static
--     map preview keyed off this. No place_id linkage (the linked
--     `locations` table is for events; contacts use plain text per
--     Phase 7's "lightweight" treatment).
--   * notes — multi-line text, optional. Free-form context the user keeps
--     about the contact (allergies, languages spoken, history).
--   * linked_event_id — optional FK to events for the "Linked to / Recurring
--     event" SGroup. ON DELETE SET NULL so deleting the event doesn't
--     cascade-delete the contact; just unlinks it.
--
-- Idempotent: each ALTER uses IF NOT EXISTS where supported (added in
-- Postgres 9.6 for ADD COLUMN); the CHECK constraint is added separately
-- with NOT VALID + VALIDATE so re-running doesn't crash on duplicate name.

-- Add the columns.
alter table public.contacts
    add column if not exists category text not null default 'other',
    add column if not exists is_favorite boolean not null default false,
    add column if not exists is_emergency boolean not null default false,
    add column if not exists email text,
    add column if not exists best_time text,
    add column if not exists address text,
    add column if not exists notes text,
    add column if not exists linked_event_id uuid references public.events (id) on delete set null;

-- Closed-set CHECK on category. ALTER ADD CHECK doesn't support IF NOT
-- EXISTS in current Postgres, so we drop-then-add for idempotency.
alter table public.contacts
    drop constraint if exists contacts_category_check;
alter table public.contacts
    add constraint contacts_category_check
    check (category in ('medical', 'school', 'activities', 'family', 'emergency', 'other'));

-- Helpful indices for the two strip-renders. Without these, the Emergency
-- + Favorites strips would do a full table scan filter each render — fine
-- at 24 contacts, painful at 240.
create index if not exists contacts_household_favorite_idx
    on public.contacts (household_id, is_favorite)
    where is_favorite = true;

create index if not exists contacts_household_emergency_idx
    on public.contacts (household_id, is_emergency)
    where is_emergency = true;

-- Category filter index — supports the chip-strip's WHERE category = X.
create index if not exists contacts_household_category_idx
    on public.contacts (household_id, category);
