-- 0041: atomic event-write RPCs.
--
-- Background: src/lib/db.ts createEvent / updateEvent run three sequential
-- queries — events.insert/update, then setEventChildren (event_children
-- DELETE-then-INSERT), then setEventResponsibles (events_responsible
-- DELETE-then-INSERT). Without a transaction, a partial failure leaves
-- inconsistent state: e.g. the events row updates the legacy
-- responsible_profile_id mirror to the new lead, but the events_responsible
-- DELETE succeeds while the INSERT fails — leaving the event with the
-- mirrored lead pointing at a profile that's not in the join table. The
-- resolver then prefers the (empty) join, falls back to the legacy column,
-- and the UI looks fine for single-responsible flows; but the multi-
-- responsible UI and conflict resolver see "Anyone" until the user
-- re-saves. QA-found race.
--
-- Fix: SECURITY DEFINER RPCs that do everything in one transaction.
-- Callers go from three round-trips to one and get all-or-nothing
-- semantics. RLS still enforced via the existing is_household_member()
-- check at the top of each function — callers can only mutate events
-- in households they belong to.
--
-- The RPC takes JSONB arrays for child_ids and responsibles to keep the
-- argument list short (PostgREST has a sane limit on positional args but
-- jsonb is its native scalar). Inside the function we cast/unpack with
-- jsonb_array_elements_text / jsonb_to_recordset.
--
-- responsibles arg shape: [{"profile_id": "uuid", "is_lead": true|false}, ...]
-- child_ids arg shape:    ["uuid", "uuid", ...]

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
    p_responsibles jsonb
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

    -- Derive the lead from the responsibles JSON. We honor an explicit
    -- is_lead=true row; if none flagged, promote the first entry. Mirrors
    -- src/lib/db.ts's `leadProfileIdFromList` so the legacy column stays
    -- consistent with the join-table state.
    select (elem ->> 'profile_id')::uuid into v_lead_id
    from jsonb_array_elements(p_responsibles) elem
    where (elem ->> 'is_lead')::boolean = true
    limit 1;
    if v_lead_id is null then
        select (elem ->> 'profile_id')::uuid into v_lead_id
        from jsonb_array_elements(p_responsibles) elem
        limit 1;
    end if;

    -- (1) Insert the event row. responsible_profile_id mirrors the lead
    -- (back-compat for code paths that haven't migrated to the join table).
    insert into public.events (
        household_id, title, description, location, location_id,
        starts_at, ends_at, all_day, created_by,
        responsible_profile_id, recurrence_rule, event_type,
        timezone, responsible_alternation
    ) values (
        p_household_id, p_title, p_description, p_location, p_location_id,
        p_starts_at, p_ends_at, p_all_day, v_user_id,
        v_lead_id, p_recurrence_rule, p_event_type,
        p_timezone, p_responsible_alternation
    )
    returning * into v_event;

    -- (2) Insert child_ids (event_children rows).
    insert into public.event_children (event_id, child_id)
    select v_event.id, (val)::uuid
    from jsonb_array_elements_text(p_child_ids) val;

    -- (3) Insert events_responsible rows. Defensive lead normalization
    -- here too: if the JSON had multiple is_lead=true rows (UI bug),
    -- keep only the first one — the partial unique index would reject
    -- the second insert otherwise.
    select count(*) into v_count
    from jsonb_array_elements(p_responsibles) elem
    where (elem ->> 'is_lead')::boolean = true;

    insert into public.events_responsible (event_id, profile_id, is_lead)
    select
        v_event.id,
        (elem ->> 'profile_id')::uuid,
        case
            when v_count = 0 then
                -- No lead flagged in input → promote the FIRST entry.
                -- ordinality 1 gets is_lead=true; others stay false.
                ord = 1
            when v_count > 1 then
                -- Multiple leads → only the first lead row keeps it.
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

    -- Same lead-derivation as create.
    select (elem ->> 'profile_id')::uuid into v_lead_id
    from jsonb_array_elements(p_responsibles) elem
    where (elem ->> 'is_lead')::boolean = true
    limit 1;
    if v_lead_id is null then
        select (elem ->> 'profile_id')::uuid into v_lead_id
        from jsonb_array_elements(p_responsibles) elem
        limit 1;
    end if;

    -- (1) Update the events row.
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

    -- (2) Replace event_children — DELETE then INSERT.
    delete from public.event_children where event_id = p_event_id;
    insert into public.event_children (event_id, child_id)
    select p_event_id, (val)::uuid
    from jsonb_array_elements_text(p_child_ids) val;

    -- (3) Replace events_responsible — DELETE then INSERT with the same
    -- lead normalization as create_event_with_relations.
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

-- Grants — RPCs are callable by authenticated users; the SECURITY DEFINER
-- function then enforces the household-member check internally. Anon role
-- doesn't get access since there's no use case for creating/updating
-- events without auth.
grant execute on function public.create_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb
) to authenticated;
grant execute on function public.update_event_with_relations(
    uuid, text, timestamptz, timestamptz, boolean, text, text, uuid,
    text, text, text, text, jsonb, jsonb
) to authenticated;

comment on function public.create_event_with_relations is
    'Atomic event create — inserts the event row, event_children rows, and '
    'events_responsible rows in a single transaction. Mirrors the join-table '
    'lead into events.responsible_profile_id for back-compat. RLS enforced '
    'via is_household_member() on the household_id arg.';

comment on function public.update_event_with_relations is
    'Atomic event update — updates the event row, replaces event_children, '
    'and replaces events_responsible in a single transaction. Same lead '
    'mirroring + RLS as create_event_with_relations.';
