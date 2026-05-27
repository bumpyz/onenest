-- Per-task priority (Phase 11 task detail design).
--
-- The TaskDetail design renders a HIGH PRIORITY pill in the hero alongside
-- the due-date pill — a one-glance urgency signal independent of due_at.
-- Three levels keep the spec small and the picker compact:
--   * low    — quiet, no pill
--   * normal — quiet, no pill (default; matches existing behavior)
--   * high   — accent-tinted HIGH PRIORITY pill in the hero
--
-- We store it as a Postgres enum rather than a string so the schema constrains
-- legal values at the DB layer (RLS won't help us against a hand-crafted JSON
-- payload otherwise). 'normal' is the default so every existing row picks up
-- the same effective behavior without a backfill statement — Postgres fills
-- NOT NULL DEFAULT columns synchronously.
--
-- No new indexes: priority isn't a filter axis anywhere yet. If a future
-- "show me everything high-priority" view lands, add a partial index then.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'task_priority') then
        create type public.task_priority as enum ('low', 'normal', 'high');
    end if;
end$$;

alter table public.tasks
    add column if not exists priority public.task_priority
        not null
        default 'normal';
