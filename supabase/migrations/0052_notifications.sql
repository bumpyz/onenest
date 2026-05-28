-- Notifications foundation (R1, #381).
--
-- Persisted per-recipient notification log. Replaces the SAMPLE
-- scaffolds on /notifications. Every notification has exactly one
-- recipient (profile_id) — fan-out happens at the writer (e.g. a
-- swap-request decision writes two rows, one per parent).
--
-- The schema is intentionally generic so new notification kinds can
-- land without a migration each time:
--   • `kind` is text, not an enum — adding a new kind is a code
--     change in the writers / readers, no DB churn.
--   • `payload` is jsonb — each kind defines its own shape (event_id,
--     task_id, swap_id, …). The reader switches on `kind`.
--
-- Writes are gated through a SECURITY DEFINER RPC
-- (`enqueue_notification`) because cross-recipient inserts can't be
-- expressed cleanly in row-level INSERT policies (the row's
-- profile_id may not equal auth.uid() — e.g. when parent A's swap
-- request creates a row for parent B). The RPC verifies both the
-- caller and the recipient are members of the same household before
-- inserting; everything else uses standard RLS.

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles (id) on delete cascade,
    -- Nullable household_id: most rows are household-scoped, but
    -- future kinds (account-level notifications, invite acceptance
    -- mirrors) may not have one. Keep nullable to avoid forcing a
    -- placeholder.
    household_id uuid references public.households (id) on delete cascade,
    -- Free-text kind. Current values (see consumer code for the full
    -- list): 'swap_request', 'swap_decision', 'event_reminder',
    -- 'task_reminder', 'task_complete', 'mention', 'digest',
    -- 'invite', 'connect', 'conflict'. The reader switches on this
    -- to pick the right icon + render path.
    kind text not null,
    title text not null,
    body text,
    -- Per-kind context. Examples:
    --   swap_request   → { swap_request_id, requester_profile_id, from_date, to_date }
    --   event_reminder → { event_id, occurrence_date }
    --   task_reminder  → { task_id }
    -- Always a JSON object (never an array or scalar) so readers can
    -- destructure safely.
    payload jsonb not null default '{}'::jsonb,
    -- Optional deep-link target (e.g. '/event/abc-123'). The Inbox
    -- routes here on tap.
    href text,
    created_at timestamptz not null default now(),
    read_at timestamptz,
    dismissed_at timestamptz,
    check (jsonb_typeof(payload) = 'object')
);

-- Fast inbox query: notifications for current user, newest first,
-- not dismissed.
create index if not exists notifications_inbox_idx
    on public.notifications (profile_id, created_at desc)
    where dismissed_at is null;

-- Unread-only count badge (Today screen header bell, etc.).
create index if not exists notifications_unread_idx
    on public.notifications (profile_id)
    where read_at is null and dismissed_at is null;

alter table public.notifications enable row level security;

-- SELECT: own rows only. Notification visibility is strictly per-
-- recipient even within a household — a co-parent can't read another
-- co-parent's inbox.
create policy "notifications read own"
    on public.notifications for select
    using (profile_id = auth.uid());

-- UPDATE: own rows only. Used for read_at + dismissed_at.
create policy "notifications update own"
    on public.notifications for update
    using (profile_id = auth.uid())
    with check (profile_id = auth.uid());

-- DELETE: own rows only. Most callers prefer dismissal (soft delete
-- via dismissed_at) so the inbox can show "recently dismissed"
-- history, but allow hard delete for storage hygiene.
create policy "notifications delete own"
    on public.notifications for delete
    using (profile_id = auth.uid());

-- Direct INSERT is blocked — go through enqueue_notification().
-- This prevents a malicious client from spamming another user's
-- inbox; the RPC verifies same-household membership first.

-- ─── enqueue_notification RPC ──────────────────────────────────────────

create or replace function public.enqueue_notification(
    p_profile_id uuid,
    p_household_id uuid,
    p_kind text,
    p_title text,
    p_body text default null,
    p_payload jsonb default '{}'::jsonb,
    p_href text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid;
    v_caller_member boolean;
    v_recipient_member boolean;
    v_id uuid;
begin
    v_caller := auth.uid();
    if v_caller is null then
        raise exception 'Not authenticated';
    end if;

    -- Caller must be a household member of the named household.
    -- For account-level notifications (household_id is null), the
    -- caller must equal the recipient (self-enqueue only — e.g. an
    -- edge function writing on the user's own behalf).
    if p_household_id is null then
        if v_caller <> p_profile_id then
            raise exception 'Cross-recipient enqueue requires a household_id';
        end if;
    else
        select exists(
            select 1 from public.household_members
            where household_id = p_household_id
              and profile_id = v_caller
        ) into v_caller_member;
        if not v_caller_member then
            raise exception 'Caller is not a member of the household';
        end if;
        -- Recipient must also be a member of the same household, OR
        -- an external co-parent linked to a kid in the household
        -- (so swap requests / event reminders can reach an external
        -- parent who's not a household_members row).
        select exists(
            select 1 from public.household_members
            where household_id = p_household_id
              and profile_id = p_profile_id
        ) into v_recipient_member;
        if not v_recipient_member then
            -- Fall back to the external-coparent path (#398).
            select exists(
                select 1 from public.child_external_coparents cec
                join public.children c on c.id = cec.child_id
                where c.household_id = p_household_id
                  and cec.profile_id = p_profile_id
            ) into v_recipient_member;
            if not v_recipient_member then
                raise exception 'Recipient is not a member of the household';
            end if;
        end if;
    end if;

    insert into public.notifications (
        profile_id, household_id, kind, title, body, payload, href
    ) values (
        p_profile_id, p_household_id, p_kind, p_title, p_body, p_payload, p_href
    )
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.enqueue_notification(
    uuid, uuid, text, text, text, jsonb, text
) to authenticated;

comment on function public.enqueue_notification is
    'Insert a notification row for another household member. SECURITY DEFINER bypasses the table''s INSERT policy after verifying caller + recipient are in the same household.';
