-- Optional event type ("pickup", "sports", "school", "vacation", etc.). Used by the client
-- to render an emoji icon next to the event title. Stored as free-form text so we can add
-- new types in client code without a migration each time.

alter table public.events
    add column event_type text;
