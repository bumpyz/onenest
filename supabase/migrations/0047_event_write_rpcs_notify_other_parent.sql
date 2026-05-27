-- 0047: extend event-write RPCs to thread notify_other_parent (#322).
--
-- 0046 added the column; the create/update_event_with_relations functions
-- need the extra arg so EventForm's "Also notify other parent" Switch
-- actually persists. Same pattern as 0045 (is_private): drop the prior
-- signatures explicitly and recreate with the new 16-arg shape.
--
-- Client commits using this signature land in the same PR; older clients
-- mid-rollout will hit PGRST202 ("function not found") — acceptable for
-- the brief switchover window since both functions are SECURITY DEFINER
-- and rollback to 0046 alone is safe (the column just goes unset).

drop function if exists public.create_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb, boolean
);

drop function if exists public.update_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb, boolean
);

create or replace function public.create_event_with_relations(
    p_household_id uuid,
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
    p_responsibles jsonb,
    p_is_private boolean,
    p_notify_other_parent boolean
) returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_event public.events;
    v_lead_id uuid;
    v_count int;
begin
    if v_user_id is null then
        raise exception 'Not authenticated' using errcode = '28000';
    end if;
    if not public.is_household_member(p_household_id) then
        raise exception 'Not a member of household %', p_household_id
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

    insert into public.events (
        household_id, title, description, location, location_id,
        starts_at, ends_at, all_day, created_by,
        responsible_profile_id, recurrence_rule, event_type,
        timezone, responsible_alternation, is_private, notify_other_parent
    ) values (
        p_household_id, p_title, p_description, p_location, p_location_id,
        p_starts_at, p_ends_at, p_all_day, v_user_id,
        v_lead_id, p_recurrence_rule, p_event_type,
        p_timezone, p_responsible_alternation,
        coalesce(p_is_private, false),
        coalesce(p_notify_other_parent, false)
    )
    returning * into v_event;

    insert into public.event_children (event_id, child_id)
    select v_event.id, (val)::uuid
    from jsonb_array_elements_text(p_child_ids) val;

    select count(*) into v_count
    from jsonb_array_elements(p_responsibles) elem
    where (elem ->> 'is_lead')::boolean = true;

    insert into public.events_responsible (event_id, profile_id, is_lead)
    select
        v_event.id,
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
    p_responsibles jsonb,
    p_is_private boolean,
    p_notify_other_parent boolean
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
        is_private = coalesce(p_is_private, false),
        notify_other_parent = coalesce(p_notify_other_parent, false),
        updated_at = now()
    where id = p_event_id
    returning * into v_event;

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

grant execute on function public.create_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb, boolean, boolean
) to authenticated;
grant execute on function public.update_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb, boolean, boolean
) to authenticated;
