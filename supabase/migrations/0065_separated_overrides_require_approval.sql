-- ════════════════════════════════════════════════════════════════════════
-- 0065 — Separated households: in-household co-parent must approve overrides
-- ════════════════════════════════════════════════════════════════════════
--
-- Product framing: in a 'separated' household, the two parents live in
-- separate physical homes but share a single OneNest household record
-- (both as `household_members` rows with role='parent'). Schedule swaps
-- between them are exactly the kind of thing the other parent should
-- agree to — not silently auto-apply.
--
-- The existing approval flow (0056 + 0057) only gated overrides on
-- EXTERNAL co-parents (the cross-household `child_external_coparents`
-- links). That covered blended families where some kids have a parent
-- in another household, but left the 'separated' household-type case
-- in the auto-approved bucket because there's no external link — both
-- parents are technically in the same household.
--
-- This migration extends `requires_approval_from`:
--
--   For 'separated' households, every OTHER in-household parent
--   (role='parent', profile_id != caller) is added to the array
--   alongside the external co-parents the previous logic already
--   computed. The downstream effects fall out automatically:
--
--     • approval_status flips to 'pending' (was 'auto_approved')
--     • notification kind flips to 'override_request' (was
--       'override_change'), with the call-to-action body and accent
--       warn tint in the Activity inbox
--     • the existing decide_custody_override RPC accepts any
--       profile_id in requires_approval_from — no separate flow
--       needed for in-household parents
--     • event reassignment + applied state still wait on approval
--
-- Other household types stay as-is:
--
--   • single_parent — no other parent exists, requires_approval_from
--     stays empty, auto_approved (unchanged).
--   • couple        — two parents in one home; swaps remain casual
--     FYI notifications (unchanged).
--   • separated     — NEW: other in-household parent now approves.
--
-- Idempotent: re-running on an already-patched DB just replaces the
-- function definition with itself.

create or replace function public.create_custody_override(
    p_household_id uuid,
    p_start_date date,
    p_end_date date,
    p_custodian_profile_id uuid,
    p_child_ids uuid[],
    p_kind public.custody_override_kind,
    p_note text,
    p_notify_affected boolean default true,
    p_add_to_activity_feed boolean default true,
    p_reassign_events boolean default true
)
returns public.custody_overrides
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_caller_name text;
    v_custodian_name text;
    v_required uuid[];
    v_in_household_approvers uuid[];
    v_household_type public.household_type;
    v_status public.custody_override_status;
    v_row public.custody_overrides;
    v_bad_count int;
    v_recipient uuid;
    v_range_label text;
    v_title text;
    v_body text;
begin
    if not public.is_household_parent(p_household_id) then
        raise exception 'create_custody_override: not a household parent'
            using errcode = '42501';
    end if;

    if p_end_date < p_start_date then
        raise exception 'create_custody_override: end_date < start_date'
            using errcode = '22023';
    end if;

    -- Reject cross-household child ids (defense in depth — RLS on
    -- children would block reads too, but failing fast here is clearer).
    if array_length(p_child_ids, 1) is not null then
        select count(*)
          into v_bad_count
          from unnest(p_child_ids) as cid
         where not exists (
             select 1 from public.children c
              where c.id = cid and c.household_id = p_household_id
         );
        if v_bad_count > 0 then
            raise exception 'create_custody_override: % child_id(s) not in household',
                v_bad_count using errcode = '23503';
        end if;
    end if;

    -- ─── requires_approval_from ────────────────────────────────────────
    -- Step 1: external co-parents whose linked kid is in this override's
    -- scope. For an empty child_ids (household-wide override), every
    -- external co-parent linked to ANY household kid is required.
    if array_length(p_child_ids, 1) is null or array_length(p_child_ids, 1) = 0 then
        select coalesce(array_agg(distinct cec.profile_id), '{}'::uuid[])
          into v_required
          from public.child_external_coparents cec
          join public.children c on c.id = cec.child_id
         where c.household_id = p_household_id;
    else
        select coalesce(array_agg(distinct cec.profile_id), '{}'::uuid[])
          into v_required
          from public.child_external_coparents cec
         where cec.child_id = any(p_child_ids);
    end if;

    -- Step 2 (new in #0065): in a 'separated' household, the other
    -- in-household parent(s) also need to approve schedule swaps.
    -- Skipped for 'couple' (swaps are casual when you live together)
    -- and 'single_parent' (nobody else to approve).
    select household_type into v_household_type
      from public.households where id = p_household_id;

    if v_household_type = 'separated' then
        select coalesce(array_agg(profile_id), '{}'::uuid[])
          into v_in_household_approvers
          from public.household_members
         where household_id = p_household_id
           and role = 'parent'
           and profile_id <> v_caller;
        -- Union without duplicates — an external co-parent could
        -- theoretically also be in `household_members` (rare edge
        -- case if the same profile holds both shapes). array_cat +
        -- distinct via a SELECT handles dedupe.
        select coalesce(array_agg(distinct x), '{}'::uuid[])
          into v_required
          from unnest(array_cat(v_required, v_in_household_approvers)) as x;
    end if;

    v_status := case
        when array_length(v_required, 1) is null or array_length(v_required, 1) = 0
            then 'auto_approved'::public.custody_override_status
        else 'pending'::public.custody_override_status
    end;

    insert into public.custody_overrides (
        household_id,
        override_date,
        end_date,
        custodian_profile_id,
        child_ids,
        kind,
        note,
        notify_affected,
        add_to_activity_feed,
        reassign_events,
        requires_approval_from,
        approval_status,
        created_by
    ) values (
        p_household_id,
        p_start_date,
        p_end_date,
        p_custodian_profile_id,
        coalesce(p_child_ids, '{}'),
        p_kind,
        nullif(trim(p_note), ''),
        p_notify_affected,
        p_add_to_activity_feed,
        p_reassign_events,
        v_required,
        v_status,
        v_caller
    )
    returning * into v_row;

    -- ─── notification fan-out ──────────────────────────────────────────
    -- Identical to 0057. v_status now flips to 'pending' for separated
    -- households where another in-household parent is in v_required, so
    -- the approval-request branch runs instead of the FYI branch — no
    -- additional logic needed here.
    if p_notify_affected then
        select display_name into v_caller_name
          from public.profiles where id = v_caller;
        select display_name into v_custodian_name
          from public.profiles where id = p_custodian_profile_id;
        v_caller_name := coalesce(v_caller_name, 'A co-parent');
        v_custodian_name := coalesce(v_custodian_name, 'the other parent');

        if p_start_date = p_end_date then
            v_range_label := to_char(p_start_date, 'FMMon FMDD');
        elsif date_part('month', p_start_date) = date_part('month', p_end_date) then
            v_range_label := to_char(p_start_date, 'FMMon FMDD') || '–' ||
                             to_char(p_end_date, 'FMDD');
        else
            v_range_label := to_char(p_start_date, 'FMMon FMDD') || '–' ||
                             to_char(p_end_date, 'FMMon FMDD');
        end if;

        if v_status = 'auto_approved' then
            v_title := 'Custody updated · ' || v_range_label;
            v_body := v_caller_name || ' swapped custody — ' ||
                      v_custodian_name || ' has the kids.';
            for v_recipient in
                select profile_id from public.household_members
                 where household_id = p_household_id
                   and role = 'parent'
                   and profile_id <> v_caller
            loop
                perform public.enqueue_notification(
                    v_recipient,
                    p_household_id,
                    'override_change',
                    v_title,
                    v_body,
                    jsonb_build_object(
                        'override_id', v_row.id,
                        'start_date', p_start_date,
                        'end_date', p_end_date,
                        'kind', p_kind,
                        'custodian_profile_id', p_custodian_profile_id
                    ),
                    '/custody/schedule'
                );
            end loop;
        else
            v_title := 'Custody approval needed · ' || v_range_label;
            v_body := v_caller_name || ' wants ' || v_custodian_name ||
                      ' to have the kids ' || v_range_label || '.';
            foreach v_recipient in array v_required loop
                perform public.enqueue_notification(
                    v_recipient,
                    p_household_id,
                    'override_request',
                    v_title,
                    v_body,
                    jsonb_build_object(
                        'override_id', v_row.id,
                        'start_date', p_start_date,
                        'end_date', p_end_date,
                        'kind', p_kind,
                        'requester_profile_id', v_caller,
                        'custodian_profile_id', p_custodian_profile_id
                    ),
                    '/custody/schedule'
                );
            end loop;
        end if;
    end if;

    return v_row;
end;
$$;

grant execute on function public.create_custody_override(
    uuid, date, date, uuid, uuid[], public.custody_override_kind,
    text, boolean, boolean, boolean
) to authenticated;

-- PostgREST schema cache reload — the function signature is the same
-- as 0057, but NOTIFY here costs nothing and guarantees any client
-- that called the previous definition picks up the new logic on the
-- next request.
notify pgrst, 'reload schema';
