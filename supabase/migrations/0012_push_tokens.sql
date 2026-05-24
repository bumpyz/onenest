-- Expo push tokens for the sunday-summary edge function (and any future push needs).
-- One row per (profile, device-token) pair. The edge function joins this against
-- household_members + events + external_events to produce per-user notifications.

create table public.push_tokens (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles (id) on delete cascade,
    expo_token text not null,
    platform text,
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (profile_id, expo_token)
);

create index push_tokens_profile_idx on public.push_tokens (profile_id);

alter table public.push_tokens enable row level security;

-- Users can only see / manage their own tokens.
create policy "push_tokens read self"
    on public.push_tokens for select
    using (profile_id = auth.uid());

create policy "push_tokens insert self"
    on public.push_tokens for insert
    with check (profile_id = auth.uid());

create policy "push_tokens update self"
    on public.push_tokens for update
    using (profile_id = auth.uid())
    with check (profile_id = auth.uid());

create policy "push_tokens delete self"
    on public.push_tokens for delete
    using (profile_id = auth.uid());

-- register_push_token: idempotent upsert + last_seen_at refresh. Called by the client every
-- time the app boots so a stale device pruning policy can use last_seen_at later.
create or replace function public.register_push_token(
    p_expo_token text,
    p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Must be signed in to register a push token' using errcode = '42501';
    end if;
    insert into public.push_tokens (profile_id, expo_token, platform, last_seen_at)
    values (auth.uid(), p_expo_token, p_platform, now())
    on conflict (profile_id, expo_token) do update
        set last_seen_at = now(),
            platform = excluded.platform;
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
