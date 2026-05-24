-- Records the IANA timezone (e.g. "America/New_York") that the event's wall clock should
-- be anchored to. Critical for recurring events: without a tz, rrule.js generates
-- occurrences at the same UTC instant week after week, which silently shifts the local
-- wall clock by 1 hour at every DST boundary.
--
-- New rows get the column populated from the browser's tz at creation time. Existing rows
-- are left NULL; the client falls back to the legacy (DST-broken) expansion path for
-- those so we don't suddenly drift events that users may have already manually corrected.
--
-- This is a pure additive change — no constraints, no indexes (queries don't filter on it).

alter table public.events
    add column if not exists timezone text;

comment on column public.events.timezone is
    'IANA timezone name anchoring the event''s wall clock (e.g. "America/New_York"). '
    'Null for legacy rows created before per-event tz was added.';
