-- ════════════════════════════════════════════════════════════════════════
-- 0059 — Collapse same-range, same-child-set custody overrides on save (#501)
-- ════════════════════════════════════════════════════════════════════════
--
-- Background. 0055 dropped the legacy
-- `custody_overrides_household_id_override_date_key` unique constraint
-- because multi-day + per-kid overrides need multiple rows on the same
-- household_id × override_date. The resolver compensates by reading the
-- latest matching row (`order by updated_at desc limit 1` in the lookup
-- map), so functionally only one override "wins" for any given (date,
-- kid) cell — but the underlying rows accumulate. Re-editing the same
-- day in the override editor leaves behind a trail of superseded
-- inserts that show up in admin dumps, audit history, and the activity
-- feed even though they have no user-visible effect.
--
-- Fix. Before INSERTing a new override, delete any prior row that
-- describes the EXACT same scope — same household, same start date,
-- same end date, same child_ids treated as an unordered set. Anything
-- with a different range or different kid set stays untouched, even if
-- it overlaps — those represent semantically distinct overrides (e.g.
-- a 3-day vacation block plus a 1-day exception inside it) and the
-- resolver's latest-wins ordering already handles the overlap.
--
-- Set-equality on child_ids uses `<@` both ways so order and
-- duplicates don't matter. Empty/NULL arrays coalesce to '{}' so two
-- household-wide overrides (child_ids = {}) dedupe correctly.
--
-- All approval statuses are eligible for deletion. If the previous
-- row was 'pending' approval from an external co-parent, replacing it
-- with a new save is the intended UX — the parent edited and re-saved
-- rather than waiting on the original decision.
--
-- Notifications. The original override's notifications already went
-- out and we can't recall them. The new INSERT runs the standard fan-out
-- path, so recipients get a fresh notification for the latest version.
-- This is the same user-visible behavior we'd have today with the
-- duplicate-row pile — only the row count changes.
--
-- Event reassignment from 0058 still runs unchanged on the new row.
-- Any events previously reassigned by the deleted override stay where
-- they are (the resolver and the events table will be consistent with
-- the surviving row, which has the same custodian + same range +
-- same kids by definition of the dedup key).
--
-- Idempotent — replaces create_custody_override in place.

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

    -- #501: collapse prior rows with the exact same range + child set.
    -- `<@` both ways gives set-equality regardless of order or dupes,
    -- and coalesce('{}'::uuid[]) ensures household-wide overrides
    -- (child_ids null/empty) dedupe against each other.
    delete from public.custody_overrides
     where household_id = p_household_id
       and override_date = p_start_date
       and end_date      = p_end_date
       and coalesce(child_ids, '{}'::uuid[]) <@ coalesce(p_child_ids, '{}'::uuid[])
       and coalesce(p_child_ids, '{}'::uuid[]) <@ coalesce(child_ids, '{}'::uuid[]);

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

    -- ── notification fan-out (unchanged from 0057/0058) ────────────
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

    -- Event reassignment (#500). Pending overrides defer until
    -- decide_custody_override flips approval_status to 'approved'.
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

comment on function public.create_custody_override(
    uuid, date, date, uuid, uuid[], public.custody_override_kind,
    text, boolean, boolean, boolean
) is
    'Insert a custody override + fan out notifications + reassign events '
    'when auto-approved. Before insert, collapses any prior row with the '
    'exact same (household, start_date, end_date, child_ids as set) so '
    'repeated saves of the same scope replace rather than accumulate '
    '(#501). Different ranges or different child sets stay as distinct '
    'rows, even when they overlap — the resolver''s latest-wins ordering '
    'handles overlapping cases.';
