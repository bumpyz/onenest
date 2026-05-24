-- QA-014 backfill: all-day events have starts_at anchored at UTC midnight (per
-- the QA-005 fix in migration 0029). But the events.timezone column was
-- previously set to the editor's IANA tz (e.g. America/New_York), creating a
-- mismatch: the stored UTC instant says "midnight UTC" but the timezone says
-- "interpret this as NY local time". The recurrence expander's
-- floating-DTSTART transform then re-localizes occurrences across DST
-- boundaries, shifting each instance by an hour, which flips the calendar
-- date of all-day occurrences (read via the UTC date prefix) after every DST
-- transition.
--
-- Fix: set timezone = 'UTC' for every all-day row. Now the wall clock (UTC
-- midnight) and the timezone ('UTC') agree, so rrule produces wall-clock-
-- invariant occurrences across DST. Going forward, event-form.tsx
-- hardcodes 'UTC' on submit for any allDay=true event, so new inserts stay
-- consistent.
--
-- This is idempotent — re-applying just no-ops on rows already at 'UTC'.

update public.events
set timezone = 'UTC'
where all_day = true
  and timezone is distinct from 'UTC';
