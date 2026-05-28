-- Notification preferences (R3, #420).
--
-- Per-profile, per-kind enable/disable for notifications. Used by the
-- /settings/notifications sub-route and honored by the edge functions
-- before firing pushes / writing inbox rows.
--
-- Sparse model: rows are created on-demand when the user explicitly
-- changes a default. Absent rows mean "default is on" — every kind
-- defaults to enabled until the user mutes it. This avoids a
-- backfill at the moment a new notification kind is added.

create table if not exists public.notification_preferences (
    profile_id uuid not null references public.profiles (id) on delete cascade,
    -- Free-text kind. Mirrors the public.notifications kind vocab
    -- (swap_request, swap_decision, event_reminder, task_reminder,
    -- task_complete, mention, digest, invite, connect, conflict).
    -- 'all' is reserved for a future global-mute toggle.
    kind text not null,
    enabled boolean not null default true,
    updated_at timestamptz not null default now(),
    primary key (profile_id, kind)
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences read own"
    on public.notification_preferences for select
    using (profile_id = auth.uid());

create policy "notification_preferences write own"
    on public.notification_preferences for all
    using (profile_id = auth.uid())
    with check (profile_id = auth.uid());

comment on table public.notification_preferences is
    'Per-profile per-kind notification enable/disable. Absent row means enabled (default-on).';
