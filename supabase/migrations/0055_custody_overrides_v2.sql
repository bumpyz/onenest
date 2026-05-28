-- ════════════════════════════════════════════════════════════════════════
-- 0055 — Custody overrides v2 (NewOverride spec 06.3, ticket #494)
-- ════════════════════════════════════════════════════════════════════════
--
-- The legacy custody_overrides table is single-day, single-custodian, and
-- household-wide. The canonical NewOverride design (onenest-spec-v1
-- screens-custody.jsx:1078) wants:
--
--   • date RANGES (start + end) instead of one day
--   • per-kid scoping via child_ids[] (empty = legacy household-wide)
--   • a kind tag ("Family trip" / "Birthday" / etc) for context + filter
--   • approval workflow for overrides affecting an external co-parent's
--     linked kid — those need that co-parent to accept before they apply
--   • toggles for notification fan-out, activity-feed write-through, and
--     event reassignment, all persisted with the override row so reading
--     it tells the full story without joining ancillary tables
--
-- Schema is purely additive — every new column has a default + a backfill
-- so existing single-date rows keep their meaning AND the v1 client path
-- (db.ts upsertCustodyOverride, untouched in this phase) keeps working
-- without setting the new columns. The old (household_id, override_date)
-- unique drops because multi-day + per-kid means multiple overrides per
-- date are now legitimate. App-level logic handles overlap UX.

-- ─── kind enum ──────────────────────────────────────────────────────────
do $$
begin
    if not exists (select 1 from pg_type where typname = 'custody_override_kind') then
        create type public.custody_override_kind as enum (
            'family_trip',
            'birthday',
            'work_travel',
            'anniversary',
            'just_swapping',
            'other'
        );
    end if;
end$$;

-- ─── approval status enum ───────────────────────────────────────────────
do $$
begin
    if not exists (select 1 from pg_type where typname = 'custody_override_status') then
        create type public.custody_override_status as enum (
            -- No external co-parent affected; takes effect immediately.
            'auto_approved',
            -- Waiting for an external co-parent decision.
            'pending',
            -- External co-parent accepted; override applies.
            'approved',
            -- External co-parent declined; override is inert (resolver
            -- treats it the same as a deleted row).
            'declined'
        );
    end if;
end$$;

-- ─── new columns (defaults set so legacy inserts keep working) ──────────
-- The v1 client (db.ts upsertCustodyOverride at this point in the branch)
-- INSERTs without naming the new columns. Defaults must therefore
-- produce a coherent legacy-equivalent row:
--   • kind = 'just_swapping' (closest match to the old "no reason"
--     semantic — and the design's default chip)
--   • approval_status = 'auto_approved' (takes effect immediately,
--     matching the old behavior where overrides applied on save)
--   • child_ids = '{}' (empty = household-wide, the only thing the v1
--     UI could express)
-- end_date is NULL by default + filled by trigger below to equal
-- override_date when not supplied (single-day legacy semantic).
alter table public.custody_overrides
    add column if not exists end_date date,
    add column if not exists kind public.custody_override_kind
        default 'just_swapping'::public.custody_override_kind,
    add column if not exists child_ids uuid[] not null default '{}',
    add column if not exists approval_status public.custody_override_status
        default 'auto_approved'::public.custody_override_status,
    add column if not exists requires_approval_from uuid[] not null default '{}',
    add column if not exists notify_affected boolean not null default true,
    add column if not exists add_to_activity_feed boolean not null default true,
    add column if not exists reassign_events boolean not null default true,
    add column if not exists decided_at timestamptz,
    add column if not exists decided_by_profile_id uuid references public.profiles (id);

-- ─── trigger: end_date defaults to override_date when not supplied ─────
-- A column default can't reference another column, but a BEFORE INSERT
-- trigger can. Runs on UPDATE too in case end_date is cleared back to
-- NULL by an editor that doesn't know about the new field.
create or replace function public.custody_overrides_default_end_date()
returns trigger
language plpgsql
as $$
begin
    if NEW.end_date is null then
        NEW.end_date := NEW.override_date;
    end if;
    return NEW;
end;
$$;

drop trigger if exists custody_overrides_default_end_date_trg
    on public.custody_overrides;
create trigger custody_overrides_default_end_date_trg
    before insert or update on public.custody_overrides
    for each row execute function public.custody_overrides_default_end_date();

-- ─── backfill defaults for existing single-date rows ────────────────────
-- These rows pre-date this migration so their new columns are NULL even
-- with defaults set (column-default applies at INSERT time only).
update public.custody_overrides
   set end_date = override_date
 where end_date is null;

update public.custody_overrides
   set kind = 'just_swapping'
 where kind is null;

update public.custody_overrides
   set approval_status = 'auto_approved'
 where approval_status is null;

-- ─── tighten constraints now that backfill ran ──────────────────────────
alter table public.custody_overrides
    alter column end_date set not null,
    alter column kind set not null,
    alter column approval_status set not null;

-- end_date >= override_date — override_date is the inclusive start.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'custody_overrides_date_range_ck'
    ) then
        alter table public.custody_overrides
            add constraint custody_overrides_date_range_ck
                check (end_date >= override_date);
    end if;
end$$;

-- Drop the legacy single-date unique. Multi-day + per-kid overrides
-- mean multiple rows per (household_id, override_date) are now valid.
-- Overlap UX is handled in the editor.
alter table public.custody_overrides
    drop constraint if exists custody_overrides_household_id_override_date_key;

-- Range-friendly index for the resolver's date-window queries. Replaces
-- the now-narrower single-date index for the common
-- "give me overrides intersecting [from, to]" lookup.
create index if not exists custody_overrides_household_range_idx
    on public.custody_overrides (household_id, override_date, end_date);

-- ─── decide RPC ────────────────────────────────────────────────────────
-- External co-parents don't get a direct UPDATE policy on the table
-- (we'd need column-level RLS to lock down everything except the four
-- approval columns, and Postgres doesn't have that). Instead they call
-- this SECURITY DEFINER RPC, which validates membership in
-- requires_approval_from and flips only the approval-related fields.
--
-- Household parents can ALSO call this (e.g. an in-house override that
-- the OTHER parent should accept first — rare today since the
-- create-RPC sets auto_approved when no external co-parent affected,
-- but kept open for symmetry + future intra-household flows).
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

    return v_override;
end;
$$;

grant execute on function public.decide_custody_override(uuid, text) to authenticated;

-- ─── resolver hint: filter non-effective rows in callers ───────────────
-- The client-side resolver (src/lib/custody.ts buildOverrideMap) needs
-- to treat 'pending' and 'declined' as if the override didn't exist.
-- Schema can't enforce that — it's a Phase B (db.ts) responsibility.
-- This comment is the canonical pointer.

comment on column public.custody_overrides.end_date is
    'Inclusive end of override range; equals override_date for single-day. #494 NewOverride.';
comment on column public.custody_overrides.kind is
    'Override category (family_trip / birthday / work_travel / anniversary / just_swapping / other).';
comment on column public.custody_overrides.child_ids is
    'Kids the override scopes to. Empty array = household-wide (legacy semantic preserved).';
comment on column public.custody_overrides.approval_status is
    'auto_approved (no ext. co-parent) | pending | approved | declined. Resolver applies only auto_approved + approved.';
comment on column public.custody_overrides.requires_approval_from is
    'Set of external-co-parent profile_ids whose decision is needed. Populated server-side on insert based on child_ids + child_external_coparents.';
comment on column public.custody_overrides.notify_affected is
    'When true, save fans out override_request / override_decision notifications.';
comment on column public.custody_overrides.add_to_activity_feed is
    'When true, override save writes a family-activity-feed entry.';
comment on column public.custody_overrides.reassign_events is
    'When true, save reassigns events in the date range from old custodian to new one. Phase F.';

comment on function public.decide_custody_override(uuid, text) is
    'External co-parent (or any household parent) decides a pending custody override. Flips approval_status to approved|declined and stamps decided_at + decided_by_profile_id.';
