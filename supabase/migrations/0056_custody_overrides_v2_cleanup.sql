-- ════════════════════════════════════════════════════════════════════════
-- 0056 — Custody overrides v2 cleanup + create RPC (Phase B, #496)
-- ════════════════════════════════════════════════════════════════════════
--
-- Two follow-ups to 0055 that couldn't ride along cleanly:
--
--   (1) Retire the legacy single-`child_id` column. 0048 added it for
--       per-child overrides (#373), but no UI ever called it — the
--       comment in src/lib/db.ts getCustodyOverridesForRange has been
--       carrying the deferral note. 0055 introduced `child_ids uuid[]`
--       as the canonical multi-kid scope, so child_id is dead weight.
--
--       Migration steps:
--         a) Backfill `child_ids = array[child_id]` for rows where
--            child_id is set (preserves the in-flight scope of any
--            historical row that managed to populate it).
--         b) Drop the partial unique indexes that key off child_id —
--            multi-day + multi-kid ranges make per-day uniqueness
--            incoherent (a 3-day household-wide override only takes
--            one slot at start_date but logically owns 3 dates).
--         c) Drop the lookup index that includes child_id.
--         d) Drop child_id.
--
--   (2) create_custody_override SECURITY DEFINER RPC. The new override
--       editor needs server-side computation of requires_approval_from
--       (which external co-parent profile_ids have a linked kid in the
--       override's child_ids). Letting the client compute that opens a
--       trivial bypass — set requires_approval_from to '{}' and any
--       override auto-applies. Definer + a trusted query inside is the
--       fix.

-- ─── (1a) backfill child_ids from child_id ─────────────────────────────
update public.custody_overrides
   set child_ids = array[child_id]
 where child_id is not null
   and (child_ids = '{}' or child_ids is null);

-- ─── (1b) drop legacy partial uniques ──────────────────────────────────
drop index if exists public.custody_overrides_per_scope_unique;
drop index if exists public.custody_overrides_household_wide_unique;

-- ─── (1c) drop legacy lookup index ─────────────────────────────────────
drop index if exists public.custody_overrides_household_date_child_idx;

-- ─── (1d-pre) drop the policy that references child_id ─────────────────
-- Migration 0050 created an external-co-parent SELECT policy whose
-- USING clause references custody_overrides.child_id. Postgres won't
-- let us drop a column another object depends on, so we drop the
-- policy first, then drop the column, then recreate the policy
-- against child_ids (1d-post below). Behaviorally equivalent — same
-- "external co-parent sees overrides on their linked kid OR
-- household-wide overrides" semantic, just keyed off the array
-- column.
drop policy if exists "custody_overrides read external coparent"
    on public.custody_overrides;

-- ─── (1d) drop child_id column ─────────────────────────────────────────
alter table public.custody_overrides
    drop column if exists child_id;

-- ─── (1d-post) recreate the external-co-parent SELECT policy ───────────
-- child_ids = '{}' (or NULL — defensive; the column is NOT NULL with
-- default '{}') means household-wide. Otherwise the external profile
-- needs to be linked to at least one kid in the array.
create policy "custody_overrides read external coparent"
    on public.custody_overrides for select
    using (
        exists (
            select 1 from public.child_external_coparents cec
            join public.children c on c.id = cec.child_id
            where c.household_id = public.custody_overrides.household_id
              and cec.profile_id = auth.uid()
              and (
                  -- household-wide (empty / null array) → visible to
                  -- every external co-parent of a household kid
                  coalesce(
                      array_length(public.custody_overrides.child_ids, 1),
                      0
                  ) = 0
                  -- otherwise the linked kid must be in the scope
                  or cec.child_id = any(public.custody_overrides.child_ids)
              )
        )
    );

-- ─── (2) create_custody_override RPC ───────────────────────────────────
-- Computes:
--   • requires_approval_from = profile_ids of external co-parents
--     linked to any kid in child_ids (or to any household kid when
--     child_ids is empty / household-wide). Pulled from
--     child_external_coparents.
--   • approval_status = 'pending' if requires_approval_from is
--     non-empty, else 'auto_approved'.
--
-- Validates:
--   • Caller is a household_parent of the override's household.
--   • Every uuid in child_ids belongs to the household (no
--     cross-household scope leaks).
--   • end_date >= start_date.
--
-- Returns the inserted row.

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
    v_required uuid[];
    v_status public.custody_override_status;
    v_row public.custody_overrides;
    v_bad_count int;
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
    'Insert a custody override and compute requires_approval_from + approval_status server-side from child_external_coparents. Validates caller is a household parent and that all child_ids belong to the household.';
