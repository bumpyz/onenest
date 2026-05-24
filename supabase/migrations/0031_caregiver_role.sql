-- Caregiver role: a household member who can be assigned events / tasks and mark
-- those tasks complete, but cannot create events / tasks / lists / custody data
-- and cannot see household items they're not assigned to. Implements the
-- "Only their assignments + Anyone" visibility model the product spec landed on.
--
-- Schema baseline (already in place): household_role enum includes 'caregiver';
-- household_members.role + invitations.role both default to 'parent'.
--
-- What this migration does:
--   1. Add is_household_caregiver() helper.
--   2. Replace events SELECT / INSERT / UPDATE / DELETE policies with role-aware
--      versions: parents keep full access, caregivers see only events where
--      they're the responsible profile or Anyone (without alternation, since
--      alternation events resolve to a parent A/B, never a caregiver), and
--      cannot write events at all.
--   3. Replace tasks SELECT / write policies: parents read-write everything,
--      caregivers see only tasks they're assigned to or Anyone tasks, and
--      cannot write directly (a SECURITY DEFINER RPC below is their only
--      write path).
--   4. Replace task_assignees / task_lists / task_children / event_children
--      SELECT policies so they honor the caregiver visibility filter via the
--      parent task / event row.
--   5. Block caregivers from SELECT on custody_periods / custody_schedules /
--      custody_overrides / event_occurrence_overrides — those are parent-only
--      coordination tables.
--   6. mark_task_complete(task_id, completed) SECURITY DEFINER RPC: callable
--      by parents OR by caregivers assigned to the task (or any caregiver if
--      Anyone), writes completed_at + completed_by atomically.
--
-- Idempotent throughout via `drop policy if exists` before each create.

-- ─── Helper ─────────────────────────────────────────────────────────────────

create or replace function public.is_household_caregiver(p_household_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
    select exists (
        select 1 from public.household_members
        where household_id = p_household_id
          and profile_id = auth.uid()
          and role = 'caregiver'
    );
$$;

-- ─── Events ─────────────────────────────────────────────────────────────────
-- Caregiver visibility: events where responsible_profile_id = caregiver OR
-- "Anyone" events that are not parent-alternation events (alternation always
-- resolves to a custody parent — caregivers shouldn't see those even when
-- responsible_profile_id is null).

drop policy if exists "events read members" on public.events;
drop policy if exists "events read" on public.events;
create policy "events read"
    on public.events for select
    using (
        public.is_household_parent(household_id)
        or (
            public.is_household_caregiver(household_id)
            and (
                responsible_profile_id = auth.uid()
                or (
                    responsible_profile_id is null
                    and responsible_alternation is null
                )
            )
        )
    );

drop policy if exists "events insert members" on public.events;
drop policy if exists "events insert" on public.events;
create policy "events insert"
    on public.events for insert
    with check (public.is_household_parent(household_id));

drop policy if exists "events update members" on public.events;
drop policy if exists "events update" on public.events;
create policy "events update"
    on public.events for update
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

drop policy if exists "events delete creator or parent" on public.events;
drop policy if exists "events delete" on public.events;
create policy "events delete"
    on public.events for delete
    using (public.is_household_parent(household_id));

-- ─── Tasks ──────────────────────────────────────────────────────────────────

drop policy if exists "tasks read" on public.tasks;
create policy "tasks read"
    on public.tasks for select
    using (
        public.is_household_parent(household_id)
        or (
            public.is_household_caregiver(household_id)
            and (
                -- Caregiver is in the assignee set, OR Anyone task (no assignees).
                exists (
                    select 1 from public.task_assignees ta
                    where ta.task_id = tasks.id and ta.profile_id = auth.uid()
                )
                or not exists (
                    select 1 from public.task_assignees ta
                    where ta.task_id = tasks.id
                )
            )
        )
    );

drop policy if exists "tasks write" on public.tasks;
create policy "tasks write"
    on public.tasks for all
    using (public.is_household_parent(household_id))
    with check (public.is_household_parent(household_id));

-- ─── task_assignees: read-only access tied to the parent task's visibility ──

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
                      and (
                          exists (
                              select 1 from public.task_assignees ta2
                              where ta2.task_id = t.id and ta2.profile_id = auth.uid()
                          )
                          or not exists (
                              select 1 from public.task_assignees ta3
                              where ta3.task_id = t.id
                          )
                      )
                  )
              )
        )
    );

drop policy if exists "task_assignees write" on public.task_assignees;
create policy "task_assignees write"
    on public.task_assignees for all
    using (
        exists (
            select 1 from public.tasks t
            where t.id = task_assignees.task_id
              and public.is_household_parent(t.household_id)
        )
    )
    with check (
        exists (
            select 1 from public.tasks t
            where t.id = task_assignees.task_id
              and public.is_household_parent(t.household_id)
        )
    );

-- ─── task_lists: same shape as task_assignees, tied to task visibility ──────

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
                      and (
                          exists (
                              select 1 from public.task_assignees ta
                              where ta.task_id = t.id and ta.profile_id = auth.uid()
                          )
                          or not exists (
                              select 1 from public.task_assignees ta
                              where ta.task_id = t.id
                          )
                      )
                  )
              )
        )
    );

drop policy if exists "task_lists write" on public.task_lists;
create policy "task_lists write"
    on public.task_lists for all
    using (
        exists (
            select 1 from public.tasks t
            where t.id = task_lists.task_id
              and public.is_household_parent(t.household_id)
        )
    )
    with check (
        exists (
            select 1 from public.tasks t
            where t.id = task_lists.task_id
              and public.is_household_parent(t.household_id)
        )
    );

-- ─── task_children (if exists): same shape ──────────────────────────────────

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
                              and (
                                  exists (
                                      select 1 from public.task_assignees ta
                                      where ta.task_id = t.id and ta.profile_id = auth.uid()
                                  )
                                  or not exists (
                                      select 1 from public.task_assignees ta
                                      where ta.task_id = t.id
                                  )
                              )
                          )
                      )
                )
            )$sql$;
        execute $sql$drop policy if exists "task_children write" on public.task_children$sql$;
        execute $sql$create policy "task_children write"
            on public.task_children for all
            using (
                exists (
                    select 1 from public.tasks t
                    where t.id = task_children.task_id
                      and public.is_household_parent(t.household_id)
                )
            )
            with check (
                exists (
                    select 1 from public.tasks t
                    where t.id = task_children.task_id
                      and public.is_household_parent(t.household_id)
                )
            )$sql$;
    end if;
end$$;

-- ─── event_children: parent of children badges; deny caregiver write ────────

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
        execute $sql$drop policy if exists "event_children write" on public.event_children$sql$;
        execute $sql$create policy "event_children write"
            on public.event_children for all
            using (
                exists (
                    select 1 from public.events e
                    where e.id = event_children.event_id
                      and public.is_household_parent(e.household_id)
                )
            )
            with check (
                exists (
                    select 1 from public.events e
                    where e.id = event_children.event_id
                      and public.is_household_parent(e.household_id)
                )
            )$sql$;
    end if;
end$$;

-- ─── Custody (parent-only data) ─────────────────────────────────────────────
-- Caregivers do not participate in custody patterns; deny SELECT + write.

drop policy if exists "custody read members" on public.custody_periods;
drop policy if exists "custody_periods read" on public.custody_periods;
create policy "custody_periods read"
    on public.custody_periods for select
    using (public.is_household_parent(household_id));

-- write policy already exists ("custody write parents"); leave it alone.

do $$
begin
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'custody_schedules'
    ) then
        execute $sql$drop policy if exists "custody_schedules read" on public.custody_schedules$sql$;
        execute $sql$create policy "custody_schedules read"
            on public.custody_schedules for select
            using (public.is_household_parent(household_id))$sql$;
    end if;
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'custody_overrides'
    ) then
        execute $sql$drop policy if exists "custody_overrides read" on public.custody_overrides$sql$;
        execute $sql$create policy "custody_overrides read"
            on public.custody_overrides for select
            using (public.is_household_parent(household_id))$sql$;
    end if;
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'event_occurrence_overrides'
    ) then
        execute $sql$drop policy if exists "event_occurrence_overrides read" on public.event_occurrence_overrides$sql$;
        execute $sql$create policy "event_occurrence_overrides read"
            on public.event_occurrence_overrides for select
            using (
                exists (
                    select 1 from public.events e
                    where e.id = event_occurrence_overrides.event_id
                      and public.is_household_parent(e.household_id)
                )
            )$sql$;
    end if;
end$$;

-- ─── mark_task_complete RPC ─────────────────────────────────────────────────
-- Caregivers cannot UPDATE tasks directly (policy denies). This RPC is the
-- one and only path for them to flip completion. Parents can call it too —
-- handy for keeping the client path single instead of branching on role.
--
-- Sets reminded_at = now() when marking complete, so the cron's pending-
-- reminders partial index excludes the row and we don't double-fire a push
-- between "marked complete" and "row gets a follow-up edit."
--
-- Permission check is explicit inside the function (SECURITY DEFINER bypasses
-- RLS). Raises with a clear message on permission failure so the client can
-- surface "you can't complete this task" rather than a silent no-op.

create or replace function public.mark_task_complete(
    p_task_id uuid,
    p_completed boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
    v_household_id uuid;
    v_has_assignees boolean;
    v_caller_is_assignee boolean;
begin
    -- Look up the task's household + assignee state. Bypasses RLS since we're
    -- SECURITY DEFINER; the permission check below enforces the right boundary.
    select household_id
      into v_household_id
      from public.tasks
     where id = p_task_id;
    if v_household_id is null then
        raise exception 'task not found' using errcode = 'P0002';
    end if;

    -- Parent: always allowed.
    if public.is_household_parent(v_household_id) then
        -- ok
    elsif public.is_household_caregiver(v_household_id) then
        -- Caregiver: only if they're an assignee or the task is Anyone.
        select exists (
            select 1 from public.task_assignees
            where task_id = p_task_id and profile_id = auth.uid()
        ) into v_caller_is_assignee;
        select exists (
            select 1 from public.task_assignees
            where task_id = p_task_id
        ) into v_has_assignees;
        if not (v_caller_is_assignee or not v_has_assignees) then
            raise exception 'caregiver not permitted to modify this task'
                using errcode = '42501';
        end if;
    else
        raise exception 'not a household member of this task'
            using errcode = '42501';
    end if;

    if p_completed then
        update public.tasks
           set completed_at = now(),
               completed_by = auth.uid(),
               reminded_at = now()  -- block the cron from firing a "still pending" push
         where id = p_task_id;
    else
        update public.tasks
           set completed_at = null,
               completed_by = null
         where id = p_task_id;
    end if;
end;
$$;

grant execute on function public.mark_task_complete(uuid, boolean) to authenticated;

-- ─── Lists: caregivers can read (so task pills show names) but not write ───
-- Migration 0023's "lists write" used is_household_member, which would let a
-- caregiver create / rename / reorder / delete lists. Tighten to parent-only.

do $$
begin
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'lists'
    ) then
        execute $sql$drop policy if exists "lists write" on public.lists$sql$;
        execute $sql$create policy "lists write"
            on public.lists for all
            using (public.is_household_parent(household_id))
            with check (public.is_household_parent(household_id))$sql$;
    end if;
end$$;

-- ─── Invitations: caregivers cannot invite ─────────────────────────────────
-- Existing policy already gates on is_household_parent for INSERT/UPDATE;
-- nothing to change here. Re-asserting via drop+create for self-documentation.

do $$
begin
    if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'invitations'
    ) then
        execute $sql$drop policy if exists "invitations write parents" on public.invitations$sql$;
        execute $sql$create policy "invitations write parents"
            on public.invitations for all
            using (public.is_household_parent(household_id))
            with check (public.is_household_parent(household_id))$sql$;
    end if;
end$$;
