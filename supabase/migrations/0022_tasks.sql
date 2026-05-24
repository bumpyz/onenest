-- Tasks (todo items): household-scoped, optionally linked to an event and/or a list.
-- This migration ships the table + a multi-assign junction + RLS. The `lists` table
-- doesn't exist yet — when we build the Lists tab, we'll add it plus an FK constraint
-- on tasks.list_id. For now list_id is an unconstrained nullable uuid so event-linked
-- tasks (the only kind users can create today) don't carry orphaned references.
--
-- Threat model / RLS: tasks are collaborative. Any household member (parent, caregiver,
-- viewer) can read and write them — a caregiver should be able to add "buy diapers"
-- without needing a parent role. Events use a stricter "parent only" write policy
-- because event scheduling is a coordination concern; tasks are a logistics concern
-- and benefit from low friction.

create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    -- Optional event link. When set, the task surfaces in the event's task section and
    -- in the Home/Sunday digest for the event's owner(s). Cascade-deletes with the event.
    event_id uuid references public.events (id) on delete cascade,
    -- Optional list link (lists table TBD). No FK yet; will be added when the Lists tab
    -- ships, along with a one-time backfill if needed.
    list_id uuid,
    title text not null,
    notes text,
    -- Default for event-linked tasks is the event's start time (set client-side; we
    -- don't have a trigger because the event's start can change after task creation).
    -- For standalone tasks (no event), null = "no due date."
    due_at timestamptz,
    -- Done state: completed_at is the timestamp of completion; completed_by names the
    -- person who checked it off. Both are nullable while the task is open.
    completed_at timestamptz,
    completed_by uuid references public.profiles (id) on delete set null,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create index tasks_household_idx on public.tasks (household_id, due_at);
create index tasks_event_idx on public.tasks (event_id) where event_id is not null;
-- Partial index optimized for the "incomplete tasks due in window" query — the Home
-- digest's primary read pattern. Skips completed rows entirely so the index stays small.
create index tasks_due_open_idx on public.tasks (household_id, due_at)
    where completed_at is null;

alter table public.tasks enable row level security;

create policy "tasks read"
    on public.tasks for select
    using (public.is_household_member(household_id));

create policy "tasks write"
    on public.tasks for all
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));

-- Multi-assign via junction. Empty rows for a task = "anyone in the household" (we
-- treat absence-of-assignees as the default unassigned bucket on the client). Mirrors
-- the event_children pattern.

create table public.task_assignees (
    task_id uuid not null references public.tasks (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    primary key (task_id, profile_id)
);

create index task_assignees_profile_idx on public.task_assignees (profile_id);

alter table public.task_assignees enable row level security;

create policy "task_assignees read"
    on public.task_assignees for select
    using (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ));

create policy "task_assignees write"
    on public.task_assignees for all
    using (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ))
    with check (exists (
        select 1 from public.tasks t
        where t.id = task_id and public.is_household_member(t.household_id)
    ));
