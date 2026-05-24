-- Per-user default IANA timezone, applied as the new event's `timezone` when the user
-- creates an event in the form. Null means "no explicit default" — the client falls back
-- to the device's current tz at creation time (the behavior before this column existed).
--
-- Lives on profiles (per-user), not households (per-team), because co-parents may live in
-- different timezones and "my preferred default" is fundamentally personal.

alter table public.profiles
    add column if not exists default_timezone text;

comment on column public.profiles.default_timezone is
    'IANA timezone name (e.g. "America/New_York") used as the default tz for events the '
    'user creates. Null = client falls back to Intl.DateTimeFormat().resolvedOptions().timeZone.';
