-- Caregiver role post-deploy followups (QA pass found these after 0031 shipped):
--
--   1. event_occurrence_overrides write policy was created in 0021 with
--      is_household_member, which lets a caregiver UPSERT per-occurrence
--      overrides if they ever reach the code path. 0031 only tightened the
--      SELECT side. Tighten the write side too.
--
--   2. household_busy_blocks(uuid, ts, ts) RPC from 0002 gates on
--      is_household_member. That's correct for co-parents (they need to see
--      each other's opaque busy windows for coordination) but exposes one
--      parent's external-calendar pattern to a caregiver, which leaks the
--      quantity and timing of every parent's private commitments. Restrict
--      to parents only — caregivers don't coordinate scheduling, so they
--      don't need this view.
--
-- Idempotent: drop+recreate. Safe to re-run.

-- ─── 1. event_occurrence_overrides write → parent-only ─────────────────────

do $$
begin
    if exists (
        select 1 from pg_tables
        where schemaname = 'public' and tablename = 'event_occurrence_overrides'
    ) then
        execute $sql$drop policy if exists "event_occurrence_overrides write" on public.event_occurrence_overrides$sql$;
        execute $sql$create policy "event_occurrence_overrides write"
            on public.event_occurrence_overrides for all
            using (
                exists (
                    select 1 from public.events e
                    where e.id = event_occurrence_overrides.event_id
                      and public.is_household_parent(e.household_id)
                )
            )
            with check (
                exists (
                    select 1 from public.events e
                    where e.id = event_occurrence_overrides.event_id
                      and public.is_household_parent(e.household_id)
                )
            )$sql$;
    end if;
end$$;

-- ─── 2. household_busy_blocks → parent-only ────────────────────────────────

create or replace function public.household_busy_blocks(
    p_household_id uuid,
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    profile_id uuid,
    starts_at timestamptz,
    ends_at timestamptz,
    is_all_day boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    -- Was: is_household_member. Tightened: parent-only. Caregivers should
    -- not see the quantity/timing pattern of any parent's external calendar
    -- (per privacy model — paired calendars are private per parent and only
    -- shared as opaque busy bars to *co-parents*, not to caregivers).
    if not public.is_household_parent(p_household_id) then
        raise exception 'not a parent of household %', p_household_id using errcode = '42501';
    end if;

    return query
    select ee.profile_id, ee.starts_at, ee.ends_at, ee.is_all_day
    from public.external_events ee
    join public.household_members hm on hm.profile_id = ee.profile_id
    where hm.household_id = p_household_id
      and ee.is_busy = true
      and tstzrange(ee.starts_at, ee.ends_at, '[)') && tstzrange(p_from, p_to, '[)');
end;
$$;

-- grants persist from 0002, but re-asserting for safety
revoke all on function public.household_busy_blocks(uuid, timestamptz, timestamptz) from public;
grant execute on function public.household_busy_blocks(uuid, timestamptz, timestamptz) to authenticated;
