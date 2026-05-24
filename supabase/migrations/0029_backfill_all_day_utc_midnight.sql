-- QA-005 backfill: prior to this migration, all-day events were stored at LOCAL
-- midnight in the creator's tz, then serialized to UTC. A Tokyo creator's
-- "May 22" was saved as 2026-05-21T15:00:00Z, which renders as May 21 for any
-- viewer west of UTC. Going forward the app writes all-day events at UTC
-- midnight (event-form.tsx handleSubmit). This migration normalizes any
-- legacy rows so every consumer can rely on a single shape.
--
-- Strategy: for each all-day row, compute the "intended" calendar date by
-- converting the stored UTC timestamp back to wall-clock in the event's own
-- timezone, then rebuild starts_at/ends_at as UTC midnight on those dates.
-- Idempotent: rows already at UTC midnight resolve to the same UTC date in any
-- timezone (because midnight UTC is just one instant), so the rebuilt value
-- equals the existing value — no-op.
--
-- We guard the WHERE clause so the update only touches rows that aren't
-- already UTC midnight. Avoids needlessly bumping updated_at on already-normal
-- rows and makes the migration safe to rerun.

update public.events
set
    starts_at = (
        to_char((starts_at at time zone coalesce(timezone, 'UTC'))::date, 'YYYY-MM-DD')
        || 'T00:00:00Z'
    )::timestamptz,
    ends_at = (
        to_char((ends_at at time zone coalesce(timezone, 'UTC'))::date, 'YYYY-MM-DD')
        || 'T00:00:00Z'
    )::timestamptz
where all_day = true
  and (
    -- Not currently UTC midnight (any non-zero time component qualifies).
    extract(hour from starts_at at time zone 'UTC') <> 0
    or extract(minute from starts_at at time zone 'UTC') <> 0
    or extract(second from starts_at at time zone 'UTC') <> 0
  );
