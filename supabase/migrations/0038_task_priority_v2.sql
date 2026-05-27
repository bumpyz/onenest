-- Expand task_priority enum for the Phase 11 v2 TaskDetail redesign.
--
-- The original 0037 migration introduced three levels (low / normal / high).
-- The v2 design adds two more ends of the scale so the picker matches the
-- design source (screens-task-edit.jsx PrioritySheet):
--   * 'none'   — quiet, no pill (no priority indicator)
--   * 'low'    — quiet, no pill (existing)
--   * 'normal' — quiet, no pill (existing, default)
--   * 'high'   — accent HIGH PRIORITY pill in the detail hero (existing)
--   * 'urgent' — alert URGENT pill, surfaces above everything
--
-- Postgres can ADD values to an existing enum but can't REMOVE or REORDER
-- without a full type swap. We append 'none' and 'urgent' so the existing
-- column keeps its data + default. 'none' goes BEFORE 'low' alphabetically
-- but enum sort order is declared order, not lexical — we use BEFORE/AFTER
-- to control where the new variants land in the ordering.

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.task_priority'::regtype
          and enumlabel = 'none'
    ) then
        -- 'none' sorts as the lowest priority (lower than 'low'). Useful for
        -- a future "show me only prioritized tasks" filter that excludes both
        -- 'none' AND 'low'.
        alter type public.task_priority add value 'none' before 'low';
    end if;
end$$;

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.task_priority'::regtype
          and enumlabel = 'urgent'
    ) then
        alter type public.task_priority add value 'urgent' after 'high';
    end if;
end$$;
