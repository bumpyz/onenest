-- ════════════════════════════════════════════════════════════════════════
-- 0057 — Custody override notification fan-out (Phase E, #499)
-- ════════════════════════════════════════════════════════════════════════
--
-- Extends create_custody_override (from 0056) with a notification
-- fan-out step. The notify_affected toggle on each override row gates
-- whether anything fires at all; recipients vary by approval status.
--
--   auto_approved (no external co-parent affected) →
--     Each OTHER household parent gets an 'override_change' notification
--     so they know the schedule was just updated.
--     (Caregivers + non-parent members are skipped for v1; if there's
--      demand we extend the recipient set in a follow-up.)
--
--   pending (external co-parent affected) →
--     Each profile in requires_approval_from gets an 'override_request'
--     notification — they need to decide before the override applies.
--
-- All inserts go through enqueue_notification (from 0052) so the
-- standard caller-+-recipient-membership check still runs. No new
-- notification kinds are persisted to a column — `kind` is free text.
-- The corresponding NotificationKind union in src/lib/db.ts gets the
-- new strings in a sibling client commit.
--
-- Schema kinds in use after this migration:
--   override_change   (in-household FYI)
--   override_request  (external co-parent approval ask)
--   override_decision (approver responded — fired from decide RPC; this
--                      migration also extends that fan-out symmetrically)
--
-- Idempotent — replaces the RPCs in place; nothing column-level changes.

-- ─── create_custody_override (with fan-out) ────────────────────────────
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

    -- requires_approval_from: external co-parents whose linked kid is
    -- in this override's scope. For an empty child_ids (household-wide
    -- override), every external co-parent linked to ANY household kid
    -- is required.
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

    -- ─── notification fan-out ──────────────────────────────────────
    -- Skip the whole block if the user unchecked "Notify everyone
    -- affected" in the editor.
    if p_notify_affected then
        -- Compose human strings once.
        select display_name into v_caller_name
          from public.profiles where id = v_caller;
        select display_name into v_custodian_name
          from public.profiles where id = p_custodian_profile_id;
        v_caller_name := coalesce(v_caller_name, 'A co-parent');
        v_custodian_name := coalesce(v_custodian_name, 'the other parent');

        -- "May 28" for same-day overrides, "May 28–30" for ranges. To
        -- avoid month-boundary edge cases we just include the month in
        -- both ends when the months differ.
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
            -- Recipients: every household_member who's a parent, minus
            -- the caller (no reason to notify yourself about your own
            -- change). Caregivers + non-parent roles are skipped for v1.
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
            -- Pending: ask the external co-parents in requires_approval_from
            -- to decide. Body should make the call to action obvious.
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

-- ─── decide_custody_override (with fan-out symmetric on the response) ──
-- When an external co-parent (or any household parent) decides a
-- pending override, the requester needs to know. Mirror the swap
-- request → swap decision flow.
create or replace function public.decide_custody_override(
    p_override_id uuid,
    p_decision text
)
returns public.custody_overrides
language plpgsql
security definer
set search_path = public
as $$
declare
    v_override public.custody_overrides;
    v_can_decide boolean;
    v_decider_name text;
    v_requester_name text;
    v_range_label text;
    v_title text;
    v_body text;
begin
    if p_decision not in ('approved', 'declined') then
        raise exception 'decide_custody_override: invalid decision %', p_decision
            using errcode = '22023';
    end if;

    select * into v_override
      from public.custody_overrides
     where id = p_override_id;

    if not found then
        raise exception 'decide_custody_override: override % not found', p_override_id
            using errcode = 'P0002';
    end if;

    if v_override.approval_status <> 'pending' then
        raise exception 'decide_custody_override: override % is not pending (status: %)',
            p_override_id, v_override.approval_status
            using errcode = '22023';
    end if;

    v_can_decide := auth.uid() = any(v_override.requires_approval_from)
                    or public.is_household_parent(v_override.household_id);
    if not v_can_decide then
        raise exception 'decide_custody_override: not authorized'
            using errcode = '42501';
    end if;

    update public.custody_overrides
       set approval_status = p_decision::public.custody_override_status,
           decided_at = now(),
           decided_by_profile_id = auth.uid()
     where id = p_override_id
     returning * into v_override;

    -- Notify the requester (and any other household parent) about the
    -- decision. Same notify_affected gate as create.
    if v_override.notify_affected then
        select display_name into v_decider_name
          from public.profiles where id = v_override.decided_by_profile_id;
        select display_name into v_requester_name
          from public.profiles where id = v_override.created_by;
        v_decider_name := coalesce(v_decider_name, 'A co-parent');
        v_requester_name := coalesce(v_requester_name, 'a co-parent');

        if v_override.override_date = v_override.end_date then
            v_range_label := to_char(v_override.override_date, 'FMMon FMDD');
        elsif date_part('month', v_override.override_date)
              = date_part('month', v_override.end_date) then
            v_range_label := to_char(v_override.override_date, 'FMMon FMDD') || '–' ||
                             to_char(v_override.end_date, 'FMDD');
        else
            v_range_label := to_char(v_override.override_date, 'FMMon FMDD') || '–' ||
                             to_char(v_override.end_date, 'FMMon FMDD');
        end if;

        if p_decision = 'approved' then
            v_title := 'Override approved · ' || v_range_label;
            v_body := v_decider_name || ' approved your custody override.';
        else
            v_title := 'Override declined · ' || v_range_label;
            v_body := v_decider_name || ' declined your custody override.';
        end if;

        -- Recipient: the requester (the household parent who created
        -- the override). Skip if they're the same as the decider —
        -- e.g. when a household parent decides their own request,
        -- which shouldn't normally happen but is allowed by the
        -- v_can_decide check above for symmetry.
        if v_override.created_by is not null
           and v_override.created_by <> v_override.decided_by_profile_id then
            perform public.enqueue_notification(
                v_override.created_by,
                v_override.household_id,
                'override_decision',
                v_title,
                v_body,
                jsonb_build_object(
                    'override_id', v_override.id,
                    'decision', p_decision,
                    'decided_by_profile_id', v_override.decided_by_profile_id,
                    'start_date', v_override.override_date,
                    'end_date', v_override.end_date
                ),
                '/custody/schedule'
            );
        end if;
    end if;

    return v_override;
end;
$$;

grant execute on function public.decide_custody_override(uuid, text) to authenticated;

comment on function public.create_custody_override(
    uuid, date, date, uuid, uuid[], public.custody_override_kind,
    text, boolean, boolean, boolean
) is
    'Insert a custody override + fan out notifications (override_change for in-household, override_request for external co-parent approval). Computes requires_approval_from + approval_status server-side from child_external_coparents.';

comment on function public.decide_custody_override(uuid, text) is
    'External co-parent (or any household parent) decides a pending custody override. Flips approval_status + fans out an override_decision notification to the original requester.';
