-- Task ↔ child junction. Mirrors task_lists / task_assignees: tasks can be associated
-- with any number of household children, both for event-linked tasks (e.g. "buy
-- ballet shoes" for Anna's ballet class) and standalone tasks (e.g. "schedule Anna's
-- checkup" with no event yet). Powers the Lists tab's by-child view and gives the
-- Sunday-summary edge function a hook for "Anna's open tasks" rollups later.
--
-- We don't backfill anything from events.child_ids — there's no clear policy that
-- says "every existing event-linked task should inherit its event's children." The
-- event form's inline task section will seed new tasks' childIds from the event's
-- selected children at creation time; older tasks stay empty until edited.
--
-- Permissions match task_lists: any household member can read/write, gated through
-- the parent task's household_id. Cascade-deletes with both endpoints.

create table if not exists public.task_children (
    task_id uuid not null references public.tasks (id) on delete cascade,
    child_id uuid not null references public.children (id) on delete cascade,
    primary key (task_id, child_id)
);

create index if not exists task_children_child_idx on public.task_children (child_id);

alter table public.task_children enable row level security;

drop policy if exists "task_children read" on public.task_children;
create policy "task_children read"
    on public.task_children for select
    using (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ));

drop policy if exists "task_children write" on public.task_children;
create policy "task_children write"
    on public.task_children for all
    using (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ))
    with check (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ));
