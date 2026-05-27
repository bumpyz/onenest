-- Personal / private events (#466).
--
-- Before this column, any event with zero children tagged was effectively
-- "household-wide": the EventForm copy literally said "Leave blank for
-- household-wide events" and the UI offered no way to hide a personal
-- appointment from the other adults in the home. That conflates two
-- distinct ideas:
--   1. Tagged children = whose calendar this affects (visibility scope).
--   2. Personal vs. visible to household = whether the OWNER wants
--      anyone else seeing the title at all.
--
-- `is_private` is the explicit opt-in for the second axis. When true,
-- viewers who AREN'T in the event's responsibles list see the time slot
-- as a generic "Busy" block — same vocabulary as the external paired-
-- calendar busy blocks already in the app (household_busy_blocks). The
-- responsible adult(s) still see the full event.
--
-- Defaults to false so every existing row keeps its current behavior;
-- Postgres fills NOT NULL DEFAULT columns synchronously, no backfill
-- statement needed.
--
-- No new indexes: privacy isn't a filter axis. Render-time gates check
-- `is_private` against the viewer's id and the responsibles join, which
-- both already load with the event row.

alter table public.events
    add column if not exists is_private boolean
        not null
        default false;

comment on column public.events.is_private is
    'When true, viewers not in events_responsible see this event as a generic Busy block (no title, no detail). Owner-controlled opt-in for personal events; defaults to false.';
