-- 0045: extend event-write RPCs to thread is_private (#466).
--
-- Migration 0044 added events.is_private. The atomic write RPCs from 0041
-- predate that column and ignore it on insert/update — meaning the
-- EventForm's "Mark private" toggle would be silently dropped on save
-- (the events row keeps its default `false` and the user's choice
-- vanishes). This migration adds p_is_private to both signatures and
-- threads it into the actual write.
--
-- Backward compatibility: PostgreSQL function overloading means we can't
-- add an optional default arg without breaking the OLD signature (older
-- builds still calling the 14-arg form). We instead drop the old
-- functions explicitly and recreate with the new 15-arg shape. Clients
-- bundled before this migration's matching client update will get a
-- PGRST202 ("function not found") — same error class users hit during
-- the 0041/0042 rollout. The TypeScript client in src/lib/db.ts is
-- updated in the same PR so the new build can find the new signature.

drop function if exists public.create_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb
);

drop function if exists public.update_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb
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
    p_is_private boolean
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
        timezone, responsible_alternation, is_private
    ) values (
        p_household_id, p_title, p_description, p_location, p_location_id,
        p_starts_at, p_ends_at, p_all_day, v_user_id,
        v_lead_id, p_recurrence_rule, p_event_type,
        p_timezone, p_responsible_alternation, coalesce(p_is_private, false)
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
    p_is_private boolean
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
    text, text, text, text, jsonb, jsonb, boolean
) to authenticated;
grant execute on function public.update_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb, boolean
) to authenticated;
