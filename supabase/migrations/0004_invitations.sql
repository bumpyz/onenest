-- Co-parent (and caregiver / viewer) invitation flow.
-- A household parent generates an invitation; the invitee follows a tokenized link, signs
-- in, and calls accept_invitation(token). The accept function runs as SECURITY DEFINER so
-- it can insert the membership row server-side — this keeps the household_members INSERT
-- policy strict (parents only) for everyone else.

create table public.household_invitations (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    invited_email text not null,
    token text not null unique default replace(gen_random_uuid()::text, '-', ''),
    role public.household_role not null default 'parent',
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '14 days'),
    accepted_at timestamptz,
    accepted_by uuid references public.profiles (id)
);

create index household_invitations_household_idx on public.household_invitations (household_id);
create index household_invitations_token_idx on public.household_invitations (token);

alter table public.household_invitations enable row level security;

-- Members of the household can see invitations issued for it.
create policy "invitations read members"
    on public.household_invitations for select
    using (public.is_household_member(household_id));

-- Only parents of the household can create invitations.
create policy "invitations insert parents"
    on public.household_invitations for insert
    with check (
        public.is_household_parent(household_id)
        and created_by = auth.uid()
    );

-- Parents can revoke (delete) any invitation for their household.
create policy "invitations delete parents"
    on public.household_invitations for delete
    using (public.is_household_parent(household_id));

-- get_invitation_preview: lets an authenticated invitee fetch a friendly preview
-- (household name, who invited them) BEFORE accepting. Runs as SECURITY DEFINER because
-- the invitee isn't yet a household member and so can't see the invitation row via RLS.
create or replace function public.get_invitation_preview(p_token text)
returns table (
    household_id uuid,
    household_name text,
    inviter_name text,
    invited_email text,
    role public.household_role,
    expires_at timestamptz
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
        p.display_name as inviter_name,
        i.invited_email,
        i.role,
        i.expires_at
    from public.household_invitations i
    join public.households h on h.id = i.household_id
    join public.profiles p on p.id = i.created_by
    where i.token = p_token
      and i.accepted_at is null
      and i.expires_at > now();
end;
$$;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to authenticated;

-- accept_invitation: atomically joins the caller to the household and marks the invitation accepted.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite record;
begin
    if auth.uid() is null then
        raise exception 'Must be signed in to accept an invitation' using errcode = '42501';
    end if;

    select * into v_invite
    from public.household_invitations
    where token = p_token
      and accepted_at is null
      and expires_at > now()
    for update;

    if not found then
        raise exception 'Invitation not found, already used, or expired' using errcode = '22023';
    end if;

    insert into public.household_members (household_id, profile_id, role)
    values (v_invite.household_id, auth.uid(), v_invite.role)
    on conflict (household_id, profile_id) do nothing;

    update public.household_invitations
    set accepted_at = now(), accepted_by = auth.uid()
    where id = v_invite.id;

    return v_invite.household_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;
