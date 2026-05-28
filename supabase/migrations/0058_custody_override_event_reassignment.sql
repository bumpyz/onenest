-- ════════════════════════════════════════════════════════════════════════
-- 0058 — Custody override event reassignment (Phase F, #500)
-- ════════════════════════════════════════════════════════════════════════
--
-- Closes the #494 NewOverride cluster. The override editor (#498) already
-- collected a `reassign_events` boolean and persisted it on the override
-- row (#495 schema, #497 phase D screen). The notification fan-out (#499)
-- told everyone about the override. This migration adds the actual
-- reassignment: when an override is approved AND `reassign_events` is
-- true, walk all events in [start_date, end_date] whose lead responsible
-- isn't the new custodian and swap the lead to the new custodian.
--
-- The semantic intentionally matches the client-side `conflictCount`
-- preview in /custody/[date].tsx:420 — "events with an explicit lead
-- responsible different from the new custodian, optionally filtered by
-- the override's child_ids." Events with NO lead responsible are not
-- touched: the resolver already falls back to custody for those, so
-- they auto-inherit the new custodian via the override row itself.
--
-- Two writes happen per affected event:
--   1. events.responsible_profile_id ← custodian
--      (the deprecated single-id column still drives the resolver +
--       the conflict-detection summary; legacy reads must keep working)
--   2. events_responsible: drop the displaced parent's `is_lead=true`
--      row, upsert the custodian as the lead
--      (the canonical multi-responsible source of truth from 0039)
--
-- The displaced parent stays tagged on the event if they had a non-lead
-- row — we don't strip their visibility, just their lead-ship. The
-- override "takes the kids" for the date range; it doesn't strip
-- co-parents from their kid's events entirely.
--
-- Reassignment fires from BOTH RPCs that can transition an override
-- into the 'approved' state:
--   * create_custody_override → when no external approval is needed,
--     the override is born approved and reassignment fires inline.
--   * decide_custody_override → when an external co-parent approves a
--     pending override, the new 'approved' status triggers reassignment.
--
-- Declined and pending overrides leave events alone. Removing an
-- override (DELETE) does NOT revert previously reassigned events —
-- without per-event change history we can't reliably identify which
-- events to revert. Tracked as a known follow-up.
--
-- Idempotent — replaces the two RPCs in place; the helper is created
-- with `create or replace function`.

-- ─── Reassignment helper ──────────────────────────────────────────────
--
-- Called from create_custody_override + decide_custody_override after
-- the override transitions to 'approved'. Idempotent: re-calling on
-- the same override does extra UPDATE work but yields the same end
-- state (events already pointing at the custodian match no rows).

create or replace function public.reassign_events_for_override(
    p_override_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_override public.custody_overrides%rowtype;
    v_count int := 0;
begin
    select * into v_override
      from public.custody_overrides
     where id = p_override_id;
    if not found then return 0; end if;

    -- Guards: only fire on approved overrides where the user opted in.
    -- Both gates also enforced at the call sites, but defending here
    -- means the helper is safe to call from anywhere (e.g. a future
    -- "re-apply override" admin tool).
    if v_override.approval_status <> 'approved' then return 0; end if;
    if not v_override.reassign_events then return 0; end if;

    -- Stage affected events into a temp table so we can write both
    -- the legacy `events.responsible_profile_id` column and the
    -- canonical `events_responsible` join in coordinated passes
    -- without re-evaluating the date / child filter twice.
    --
    -- Criteria mirror the conflictCount client filter:
    --   * household scope
    --   * responsible_profile_id set AND != custodian
    --   * start date (in event tz) inside [override_date, end_date]
    --   * child_ids overlap when override is per-kid; no filter for
    --     household-wide overrides (empty child_ids array)
    --
    -- timestamptz → date conversion respects each event's stored
    -- timezone so an evening event in NYC doesn't get pushed to the
    -- next UTC day, which would land it outside the override range.
    create temp table _override_reassign_affected on commit drop as
    select e.id as event_id, e.responsible_profile_id as displaced_id
      from public.events e
     where e.household_id = v_override.household_id
       and e.responsible_profile_id is not null
       and e.responsible_profile_id <> v_override.custodian_profile_id
       and (date(e.starts_at at time zone coalesce(e.timezone, 'UTC')))
           between v_override.override_date and v_override.end_date
       and (
           coalesce(array_length(v_override.child_ids, 1), 0) = 0
           or e.child_ids && v_override.child_ids
       );

    select count(*) into v_count from _override_reassign_affected;
    if v_count = 0 then return 0; end if;

    -- 1. Bump the legacy single-id mirror to the custodian.
    update public.events e
       set responsible_profile_id = v_override.custodian_profile_id
      from _override_reassign_affected a
     where e.id = a.event_id;

    -- 2. Strip the displaced parent's lead row from events_responsible.
    --    Their non-lead row (if any) stays untouched — the override
    --    transfers lead-ship, not full visibility.
    delete from public.events_responsible er
     using _override_reassign_affected a
     where er.event_id = a.event_id
       and er.profile_id = a.displaced_id
       and er.is_lead = true;

    -- 3. Upsert the custodian as the new lead. ON CONFLICT path
    --    handles the case where the custodian was already a non-lead
    --    responsible on the event (e.g. tagged as a backup) — we
    --    promote that existing row instead of inserting a duplicate.
    insert into public.events_responsible (event_id, profile_id, is_lead)
    select a.event_id, v_override.custodian_profile_id, true
      from _override_reassign_affected a
    on conflict (event_id, profile_id) do update set is_lead = true;

    return v_count;
end;
$$;

grant execute on function public.reassign_events_for_override(uuid)
    to authenticated;

comment on function public.reassign_events_for_override(uuid) is
    'Closes #500: walks events in an approved custody override''s date '
    'range and swaps the lead responsible from any displaced parent to '
    'the override''s custodian (respecting child_ids filter when set). '
    'Returns the number of events reassigned. No-op when the override '
    'is not approved or reassign_events is false.';

-- ─── create_custody_override — fire reassignment when auto-approved ──
--
-- Same body as 0057 + a tail call to reassign_events_for_override when
-- the override lands in the 'auto_approved' status. Pending overrides
-- skip this and pick up reassignment later via decide_custody_override.
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

    -- ── notification fan-out (unchanged from 0057) ─────────────────
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

    -- ── NEW (#500): event reassignment when auto-approved ──────────
    -- Pending overrides skip; they'll pick up reassignment from
    -- decide_custody_override when an external co-parent approves.
    if v_status = 'auto_approved' and p_reassign_events then
        perform public.reassign_events_for_override(v_row.id);
    end if;

    return v_row;
end;
$$;

grant execute on function public.create_custody_override(
    uuid, date, date, uuid, uuid[], public.custody_override_kind,
    text, boolean, boolean, boolean
) to authenticated;

-- ─── decide_custody_override — fire reassignment when approved ────────
--
-- Same body as 0057 + a tail call when the decision was 'approved'.
-- Declines stay no-op for events.
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

    -- ── notification fan-out (unchanged from 0057) ─────────────────
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

    -- ── NEW (#500): event reassignment when approved ───────────────
    -- 'declined' decisions leave events alone — the override doesn't
    -- apply, so nothing changes.
    if p_decision = 'approved' and v_override.reassign_events then
        perform public.reassign_events_for_override(v_override.id);
    end if;

    return v_override;
end;
$$;

grant execute on function public.decide_custody_override(uuid, text) to authenticated;

-- Re-stamp the function comments so anyone running \df+ sees the
-- current behavior (notification fan-out + event reassignment).
comment on function public.create_custody_override(
    uuid, date, date, uuid, uuid[], public.custody_override_kind,
    text, boolean, boolean, boolean
) is
    'Insert a custody override + fan out notifications (override_change '
    'for in-household, override_request for external co-parent approval) '
    '+ reassign events to the new custodian when the override is '
    'auto-approved and the reassign_events flag is true. Pending '
    'overrides defer reassignment to decide_custody_override.';

comment on function public.decide_custody_override(uuid, text) is
    'External co-parent (or any household parent) decides a pending '
    'custody override. Flips approval_status + fans out an '
    'override_decision notification to the original requester + '
    'reassigns events when the decision is ''approved'' and the '
    'override''s reassign_events flag is true.';
