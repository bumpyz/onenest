-- Multi-list tasks: replace the single tasks.list_id FK with a task_lists junction so
-- a task can live in any number of lists simultaneously (e.g. "Buy cake" in both
-- "Urgent" and "Groceries"). Mirrors the task_assignees pattern we already use for
-- multi-assignee tasks.
--
-- Migration flow:
--   1. Create task_lists junction + RLS
--   2. Backfill from the existing tasks.list_id column
--   3. Drop the old default-to-Inbox INSERT trigger — the responsibility moves to
--      createTask in db.ts (single source of truth for "what list did this task land
--      in" lives in the app code, not split between trigger + helper)
--   4. Drop the tasks.list_id column and FK
--
-- Why not keep tasks.list_id alongside the junction: two sources of truth would mean
-- every read needs to merge them, and any sync bug shows up as "I dragged this into
-- Groceries but Inbox still shows it." Migrating cleanly to the junction is worth the
-- one-time refactor cost.
--
-- Idempotent: safe to re-run. CREATE IF NOT EXISTS for the table/index, DROP IF
-- EXISTS for policies/trigger/function/constraint/column, ON CONFLICT DO NOTHING for
-- the backfill.

create table if not exists public.task_lists (
    task_id uuid not null references public.tasks (id) on delete cascade,
    list_id uuid not null references public.lists (id) on delete cascade,
    primary key (task_id, list_id)
);

create index if not exists task_lists_list_idx on public.task_lists (list_id);

alter table public.task_lists enable row level security;

drop policy if exists "task_lists read" on public.task_lists;
create policy "task_lists read"
    on public.task_lists for select
    using (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ));

drop policy if exists "task_lists write" on public.task_lists;
create policy "task_lists write"
    on public.task_lists for all
    using (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ))
    with check (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ));

-- Backfill: snapshot the single-list assignment into the junction. Skip rows that are
-- already there (ON CONFLICT) so the migration can be re-run after a partial apply.
-- The "list_id is not null" guard is paranoia — every task got a list_id from the 0023
-- backfill — but keeps the migration self-contained even if 0023 was tweaked later.
insert into public.task_lists (task_id, list_id)
select id, list_id from public.tasks
where list_id is not null
on conflict do nothing;

-- Drop the now-obsolete single-list default trigger + function. The app's createTask in
-- src/lib/db.ts handles the "no list → default to Inbox" semantic going forward, which
-- is simpler than a deferred constraint trigger and keeps the multi-list write path
-- centralized in one place.
drop trigger if exists task_list_default on public.tasks;
drop function if exists public.task_default_list();

-- Finally drop the FK + column. ON DELETE SET NULL on the FK means we don't lose any
-- task_lists rows during the drop (the junction has its own FK to lists with the same
-- semantic).
alter table public.tasks drop constraint if exists tasks_list_id_fkey;
alter table public.tasks drop column if exists list_id;
