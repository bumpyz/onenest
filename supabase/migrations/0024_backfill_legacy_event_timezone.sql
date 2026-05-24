-- One-shot backfill: events created before migration 0015 (events.timezone column)
-- carry NULL timezones. The recurrence expander falls back to "floating-time" semantics
-- for null tz (just uses the stored UTC instant), which is fine for one-off events but
-- not great for recurring ones across DST boundaries.
--
-- We backfill NULLs to 'UTC' rather than guessing the creator's tz: UTC is the safe
-- default because the stored starts_at/ends_at are already in UTC, so wall-clock-in-UTC
-- equals the existing instant. Users can re-edit affected recurring events to pick a
-- real tz; new events created via /event/new or /event/[id] already capture the
-- editor's tz (see event-form's editorTz logic in initialValues).
--
-- Column stays nullable: future inserts that genuinely don't care about tz (e.g. data
-- imports) shouldn't be forced to pick one.

update public.events
set timezone = 'UTC'
where timezone is null;
