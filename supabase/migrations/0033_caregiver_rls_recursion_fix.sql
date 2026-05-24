-- Fix infinite RLS recursion introduced by migration 0031.
--
-- Repro (from prod on 2026-05-24):
--   "Web ERROR event submit failed {code: 42P17, message: infinite recursion
--    detected in policy for relation \"tasks\"}"
--
-- Trigger: createEvent + inline tasks (the event/new form). The createTask call
-- inserts a row into `tasks` (fine), then inserts the assignee link into
-- `task_assignees`. The `task_assignees write` policy from 0031 contains
--   exists (select 1 from public.tasks t where t.id = ... and ...)
-- Postgres applies the *tasks SELECT* policy to that subquery. The new tasks
-- SELECT policy from 0031 contains
--   exists (select 1 from public.task_assignees ta where ta.task_id = ...)
-- Postgres applies the *task_assignees SELECT* policy to THAT subquery, which
-- again queries tasks, and so on. Postgres detects the cycle and bails with
-- errcode 42P17 before either subquery completes.
--
-- Root cause: two RLS policies on different tables each select from the other.
-- Even though logically the chain terminates (membership lookups don't depend
-- on actual task/assignee state), Postgres can't prove that statically and
-- refuses to evaluate.
--
-- Fix: replace the inline EXISTS subqueries in the tasks SELECT policy with
-- SECURITY DEFINER helper functions. SECURITY DEFINER bypasses RLS on the
-- inner query (it runs as the function owner), which terminates the dependency
-- chain at the helper-call boundary. Same trick used for `is_household_parent`
-- / `is_household_caregiver` in 0002 / 0031.
--
-- We also refactor `task_assignees`, `task_lists`, `task_children`, and
-- `event_children` SELECT policies to use the same helpers — not because their
-- current form is broken (the chain terminates once tasks SELECT uses the
-- helpers), but so future policy edits can't accidentally reintroduce a cycle.
-- One vocabulary, used consistently.
--
-- Idempotent throughout.

-- ─── SECURITY DEFINER helpers ──────────────────────────────────────────────
-- Stable + security definer = the function executes with the owner's RLS
-- context (effectively bypassing RLS) and Postgres can cache results within
-- a query. set search_path = public guards against search-path injection.

create or replace function public.task_has_assignees(p_task_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select exists (
        select 1 from public.task_assignees
        where task_id = p_task_id
    );
$$;

create or replace function public.is_task_assignee(
    p_task_id uuid,
    p_profile_id uuid
)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select exists (
        select 1 from public.task_assignees
        where task_id = p_task_id
          and profile_id = p_profile_id
    );
$$;

-- Convenience wrapper: "can a caregiver see this task?" — true if they're
-- in the assignee set, or if the task has no assignees (Anyone bucket).
-- Pulled out so callers don't have to remember the two-pronged check.
create or replace function public.caregiver_can_see_task(p_task_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select public.is_task_assignee(p_task_id, auth.uid())
        or not public.task_has_assignees(p_task_id);
$$;

grant execute on function public.task_has_assignees(uuid) to authenticated;
grant execute on function public.is_task_assignee(uuid, uuid) to authenticated;
grant execute on function public.caregiver_can_see_task(uuid) to authenticated;

-- ─── tasks SELECT — break the recursion ────────────────────────────────────

drop policy if exists "tasks read" on public.tasks;
create policy "tasks read"
    on public.tasks for select
    using (
        public.is_household_parent(household_id)
        or (
            public.is_household_caregiver(household_id)
            and public.caregiver_can_see_task(tasks.id)
        )
    );

-- ─── task_assignees SELECT — same helper, future-proofs against re-loops ──

drop policy if exists "task_assignees read" on public.task_assignees;
create policy "task_assignees read"
    on public.task_assignees for select
    using (
        exists (
            select 1 from public.tasks t
            where t.id = task_assignees.task_id
              and (
                  public.is_household_parent(t.household_id)
                  or (
                      public.is_household_caregiver(t.household_id)
                      and public.caregiver_can_see_task(t.id)
                  )
              )
        )
    );

-- ─── task_lists SELECT ────────────────────────────────────────────────────

drop policy if exists "task_lists read" on public.task_lists;
create policy "task_lists read"
    on public.task_lists for select
    using (
        exists (
            select 1 from public.tasks t
            where t.id = task_lists.task_id
              and (
                  public.is_household_parent(t.household_id)
                  or (
                      public.is_household_caregiver(t.household_id)
                      and public.caregiver_can_see_task(t.id)
                  )
              )
        )
    );

-- ─── task_children SELECT (only if the table exists in this env) ──────────

do $$
begin
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'task_children'
    ) then
        execute $sql$drop policy if exists "task_children read" on public.task_children$sql$;
        execute $sql$create policy "task_children read"
            on public.task_children for select
            using (
                exists (
                    select 1 from public.tasks t
                    where t.id = task_children.task_id
                      and (
                          public.is_household_parent(t.household_id)
                          or (
                              public.is_household_caregiver(t.household_id)
                              and public.caregiver_can_see_task(t.id)
                          )
                      )
                )
            )$sql$;
    end if;
end$$;

-- ─── event_children SELECT — uses events (no task_assignees in the chain) ─
-- This one didn't recurse, but re-asserting the policy in the same migration
-- keeps the "policy bodies live in 0031/0033, not elsewhere" rule tidy.

do $$
begin
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'event_children'
    ) then
        execute $sql$drop policy if exists "event_children read" on public.event_children$sql$;
        execute $sql$create policy "event_children read"
            on public.event_children for select
            using (
                exists (
                    select 1 from public.events e
                    where e.id = event_children.event_id
                      and (
                          public.is_household_parent(e.household_id)
                          or (
                              public.is_household_caregiver(e.household_id)
                              and (
                                  e.responsible_profile_id = auth.uid()
                                  or (
                                      e.responsible_profile_id is null
                                      and e.responsible_alternation is null
                                  )
                              )
                          )
                      )
                )
            )$sql$;
    end if;
end$$;
