-- Allow a household's creator to read it even before they're added as a member.
-- This unblocks the client-side create flow: when we INSERT a household and want
-- RETURNING * back, Postgres applies the SELECT policy to the returned row. Without
-- this tweak the creator can't see their own freshly-inserted row (since they
-- haven't been added to household_members yet — that's the very next statement).

drop policy if exists "households read members" on public.households;

create policy "households read members or creator"
    on public.households for select
    using (public.is_household_member(id) or created_by = auth.uid());
