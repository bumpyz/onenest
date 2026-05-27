-- 0042: harden update_event_with_relations against vanished-row race.
--
-- Background: 0041's update_event_with_relations did
--   `update public.events ... where id = p_event_id returning * into v_event;`
-- without checking `not found` after. If a concurrent DELETE removed the
-- event row between the household-id select and the UPDATE, `v_event`
-- becomes NULL and the function continues into the DELETE/INSERT of
-- event_children and events_responsible against `p_event_id`. The FK
-- constraints would normally reject the inserts and roll the transaction
-- back, but that's relying on FK semantics rather than explicit
-- precondition checking. QA-found risk.
--
-- This migration re-creates the function (CREATE OR REPLACE so it's
-- idempotent on re-run) with an `if not found then raise exception`
-- guard. No call-site changes needed.

create or replace function public.update_event_with_relations(
    p_event_id uuid,
    p_title text,
    p_starts_at timestamptz,
    p_ends_at timestamptz,
    p_all_day boolean,
    p_description text,
    p_location text,
    p_location_id uuid,
    p_recurrence_rule text,
    p_event_type text,
    p_timezone text,
    p_responsible_alternation text,
    p_child_ids jsonb,
    p_responsibles jsonb
) returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_household_id uuid;
    v_event public.events;
    v_lead_id uuid;
    v_count int;
begin
    if v_user_id is null then
        raise exception 'Not authenticated' using errcode = '28000';
    end if;
    select household_id into v_household_id
    from public.events
    where id = p_event_id;
    if v_household_id is null then
        raise exception 'Event % not found', p_event_id using errcode = 'P0002';
    end if;
    if not public.is_household_member(v_household_id) then
        raise exception 'Not a member of household %', v_household_id
            using errcode = '42501';
    end if;

    select (elem ->> 'profile_id')::uuid into v_lead_id
    from jsonb_array_elements(p_responsibles) elem
    where (elem ->> 'is_lead')::boolean = true
    limit 1;
    if v_lead_id is null then
        select (elem ->> 'profile_id')::uuid into v_lead_id
        from jsonb_array_elements(p_responsibles) elem
        limit 1;
    end if;

    update public.events set
        title = p_title,
        description = p_description,
        location = p_location,
        location_id = p_location_id,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        all_day = p_all_day,
        responsible_profile_id = v_lead_id,
        recurrence_rule = p_recurrence_rule,
        event_type = p_event_type,
        timezone = p_timezone,
        responsible_alternation = p_responsible_alternation,
        updated_at = now()
    where id = p_event_id
    returning * into v_event;
    -- QA-found hardening: between the household-id select and this
    -- UPDATE, a concurrent DELETE could have removed the row. Without
    -- this guard the function silently continues to DELETE/INSERT the
    -- join tables against a non-existent event id, relying on FK
    -- constraints to roll the transaction back. Explicit check is
    -- safer and gives a clear error message.
    if not found then
        raise exception 'Event % vanished mid-update', p_event_id
            using errcode = 'P0002';
    end if;

    delete from public.event_children where event_id = p_event_id;
    insert into public.event_children (event_id, child_id)
    select p_event_id, (val)::uuid
    from jsonb_array_elements_text(p_child_ids) val;

    delete from public.events_responsible where event_id = p_event_id;

    select count(*) into v_count
    from jsonb_array_elements(p_responsibles) elem
    where (elem ->> 'is_lead')::boolean = true;

    insert into public.events_responsible (event_id, profile_id, is_lead)
    select
        p_event_id,
        (elem ->> 'profile_id')::uuid,
        case
            when v_count = 0 then
                ord = 1
            when v_count > 1 then
                ord = (
                    select min(ord2)
                    from jsonb_array_elements(p_responsibles) with ordinality e2(elem2, ord2)
                    where (elem2 ->> 'is_lead')::boolean = true
                )
            else
                (elem ->> 'is_lead')::boolean
        end
    from jsonb_array_elements(p_responsibles) with ordinality e(elem, ord);

    return v_event;
end;
$$;

grant execute on function public.update_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb
) to authenticated;
