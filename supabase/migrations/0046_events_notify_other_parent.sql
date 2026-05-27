-- Per-event "Also notify other parent" flag (#322).
--
-- The 04.2 Notifications section in EventForm has two affordances:
--   1. "Remind me"               — per-recipient reminder lead time (#419)
--   2. "Also notify other parent" — when on, the dispatch path pings every
--                                   responsible adult who isn't the
--                                   current viewer, regardless of their
--                                   per-event reminder settings.
--
-- This column gives the writer + Notifications section something honest to
-- persist. The actual dispatch path lives under #308 (event reminder fire);
-- until that ships, the column stores intent but doesn't push notifications.
-- That's strictly better than the previous "Coming soon" UX — users at
-- least record the preference, and #308 picks it up without form churn.
--
-- Defaults to false: an event broadcasts only to people who opted in via
-- their own settings. Existing rows pick up the default synchronously
-- (NOT NULL DEFAULT) — no backfill needed.

alter table public.events
    add column if not exists notify_other_parent boolean
        not null
        default false;

comment on column public.events.notify_other_parent is
    'When true, the event reminder dispatch path pings every tagged adult '
    'on this event in addition to the creator''s default notification scope. '
    'Owner opt-in; defaults to false. Dispatch path lands with #308.';
