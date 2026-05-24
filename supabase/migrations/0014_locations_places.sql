-- Adds Google Places data to saved locations so we can:
--   * Avoid duplicate rows when the same Place is picked twice (via google_place_id)
--   * Show a human-readable formatted address under the name in lists
-- All columns are nullable: rows backfilled from the legacy text path won't have place data,
-- and users can still add locations by typing manually without picking a Google suggestion.

alter table public.locations
    add column if not exists google_place_id text,
    add column if not exists formatted_address text;

-- Partial unique index: when a location IS linked to a Google Place, the same household
-- can't have two rows for it. Locations without a place_id are unconstrained (people can have
-- multiple "School field" entries if they really want to).
create unique index if not exists locations_household_place_id_unique
    on public.locations (household_id, google_place_id)
    where google_place_id is not null;
