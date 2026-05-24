-- Per-task push reminders. Adds two columns:
--   * reminder_at  — absolute timestamp when the reminder should fire. Stored as a
--     concrete instant rather than as a "lead minutes" offset because the cron job's
--     filter (`reminder_at <= now()`) becomes a one-clause scan against a partial
--     index, and we don't need to do tz-aware math at delivery time. The trade-off:
--     edits to due_at don't auto-recompute reminder_at — the client recomputes on
--     save (see updateTask in db.ts).
--   * reminded_at  — when the push was actually sent. Lets the cron job filter on
--     `reminded_at IS NULL` so each reminder fires exactly once, and gives us a paper
--     trail for debugging "did the user actually get the notification."
--
-- Partial index keeps the cron job's recurring scan cheap: only rows with a pending,
-- not-yet-sent, not-yet-completed reminder land in it. As tasks complete or their
-- reminders fire, they fall out of the index without taking up space.

alter table public.tasks
    add column if not exists reminder_at timestamptz,
    add column if not exists reminded_at timestamptz;

create index if not exists tasks_pending_reminder_idx
    on public.tasks (reminder_at)
    where reminder_at is not null
      and reminded_at is null
      and completed_at is null;
