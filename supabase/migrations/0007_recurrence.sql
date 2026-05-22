-- Recurring events.
-- recurrence_rule stores an iCal RRULE string (without DTSTART — events.starts_at is the
-- DTSTART). When the column is null the event is a one-off.
-- The server returns master events; the client expands rules into instances within the
-- visible range using the rrule.js library.

alter table public.events
    add column recurrence_rule text;

-- Helpful index: when fetching events for a week, we want to grab all recurring events
-- whose master row started before the end of the visible range. This index makes that scan
-- cheap once we have many recurring events in a household.
create index events_household_recurring_idx
    on public.events (household_id, starts_at)
    where recurrence_rule is not null;
