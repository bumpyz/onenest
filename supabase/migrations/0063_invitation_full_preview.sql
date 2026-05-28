-- ════════════════════════════════════════════════════════════════════════
-- 0063 — Extended invitation preview for the redesigned Join screen (#296)
-- ════════════════════════════════════════════════════════════════════════
--
-- The Phase 9 Join Household screen renders a "family preview" card —
-- inviter avatar + ring, parent stack, kid list — so the invitee can see
-- exactly who and what they're joining before accepting. The existing
-- `get_invitation_preview` RPC only returns scalar fields (household name,
-- inviter name, role, expires_at) which the older minimal join screen
-- got by on. The new design needs counts + name + color arrays for the
-- stacks.
--
-- This migration adds `get_invitation_full_preview` — a superset RPC that
-- returns the same scalar fields PLUS aggregated arrays:
--   • parent_names / parent_colors / parent_initials — adults in the
--     household (parent + caregiver roles)
--   • kid_names / kid_colors — children rows linked to the household
--   • household_type — so the meta line can render the family-type tag
--
-- The older `get_invitation_preview` stays as-is for back-compat; nothing
-- on the schema gets touched, only the function namespace grows.
--
-- SECURITY DEFINER mirrors the original — the invitee isn't a member yet,
-- so RLS won't grant them direct row access. The function gates on
-- auth.uid() and only returns rows for tokens that are still pending +
-- unexpired, identical to the original preview's eligibility check.
--
-- Why arrays vs. a JSON column: arrays type-check at the function
-- boundary and the supabase-js client unwraps them as native string[] /
-- text[] — JSON would force a JSON.parse on the client. The aggregation
-- order is deterministic (members joined_at asc, children created_at
-- asc) so the order of names always matches the order of colors.

create or replace function public.get_invitation_full_preview(p_token text)
returns table (
    household_id uuid,
    household_name text,
    household_type public.household_type,
    inviter_name text,
    inviter_color text,
    invited_email text,
    role public.household_role,
    expires_at timestamptz,
    parent_names text[],
    parent_colors text[],
    kid_names text[],
    kid_colors text[]
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Must be signed in to preview an invitation' using errcode = '42501';
    end if;

    return query
    select
        i.household_id,
        h.name as household_name,
        h.household_type,
        p.display_name as inviter_name,
        -- Inviter's color comes from their household_members row, not the
        -- profile (color is per-household). LEFT JOIN so a missing color
        -- doesn't drop the whole row — the client falls back to accent.
        mi.color as inviter_color,
        i.invited_email,
        i.role,
        i.expires_at,
        -- Aggregated household-member arrays. We strip the inviter row
        -- from the parents list so the avatar+ring hero doesn't visually
        -- echo into the stack below — the design has the inviter
        -- elevated above the stack, not duplicated inside it.
        coalesce(parents.names, array[]::text[]) as parent_names,
        coalesce(parents.colors, array[]::text[]) as parent_colors,
        coalesce(kids.names, array[]::text[]) as kid_names,
        coalesce(kids.colors, array[]::text[]) as kid_colors
    from public.household_invitations i
    join public.households h on h.id = i.household_id
    join public.profiles p on p.id = i.created_by
    left join public.household_members mi
        on mi.household_id = i.household_id and mi.profile_id = i.created_by
    left join lateral (
        select
            array_agg(pp.display_name order by hm.joined_at) as names,
            -- Coalesce per-element so members who haven't picked a color
            -- yet still get an array slot in lockstep with names — the
            -- client renders them with the accent fallback.
            array_agg(coalesce(hm.color, '') order by hm.joined_at) as colors
        from public.household_members hm
        join public.profiles pp on pp.id = hm.profile_id
        where hm.household_id = i.household_id
          and hm.profile_id <> i.created_by
    ) parents on true
    left join lateral (
        select
            array_agg(c.display_name order by c.created_at) as names,
            array_agg(coalesce(c.color, '') order by c.created_at) as colors
        from public.children c
        where c.household_id = i.household_id
    ) kids on true
    where i.token = p_token
      and i.accepted_at is null
      and i.expires_at > now();
end;
$$;

revoke all on function public.get_invitation_full_preview(text) from public;
grant execute on function public.get_invitation_full_preview(text) to authenticated;

comment on function public.get_invitation_full_preview(text) is
    'Extended invitation preview for the redesigned Join screen (#296). '
    'Returns the scalar fields from get_invitation_preview plus aggregated '
    'parent/kid name + color arrays so the family preview card can render '
    'avatar stacks before the invitee accepts. SECURITY DEFINER because the '
    'invitee isn''t yet a household member.';
