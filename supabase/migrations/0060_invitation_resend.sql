-- ════════════════════════════════════════════════════════════════════════
-- 0060 — Pending-invite RESEND action + reminder tracking (#403)
-- ════════════════════════════════════════════════════════════════════════
--
-- The Members screen surfaces pending invitations with COPY (copy the
-- private link) and CANCEL (revoke). The CANCEL path already routes
-- through the existing parents-only DELETE policy in 0004, but there
-- was no first-class RESEND action — a parent who wanted to nudge an
-- unjoined invitee had to revoke + re-issue, which churns the token
-- and breaks any link the recipient might still have in their inbox.
--
-- This migration adds the columns + RPC needed to support RESEND
-- without rotating the token, plus tracks how many times each invite
-- has been reminded so the UI can render meta like "Resent 1 hour ago"
-- and "Reminded 3×" without re-reading the underlying activity log.
--
-- New columns on household_invitations:
--   reminder_count   – how many times RESEND has fired since the
--                      invite was first sent. Starts at 0. Bumps once
--                      per resend_invitation() call.
--   last_reminded_at – when the most recent RESEND happened, or NULL
--                      if no reminder has been sent yet.
--
-- New RPC:
--   resend_invitation(p_invitation_id uuid)
--     • caller must be a household parent on the invitation's
--       household (mirrors the existing INSERT/DELETE policies);
--     • refuses if the invitation is already accepted (nothing to
--       remind) or already expired (use revoke + recreate instead —
--       the design intentionally doesn't let a single click recover a
--       fully-expired invite, so the parent has to acknowledge the
--       lifecycle reset);
--     • bumps expires_at to now() + 14 days so the link keeps working
--       for the same 14-day window the original invite had — this
--       matches what users naively expect "resend" to do;
--     • increments reminder_count + stamps last_reminded_at = now();
--     • returns the updated invitation row so the client can update
--       its in-memory list without a second roundtrip.
--
-- The token itself is intentionally NOT regenerated. Keeping the same
-- token means any existing email or message the parent already sent
-- the invitee still works — the resend is "wake them up", not
-- "invalidate the previous link."
--
-- A future iteration may add automated pg_cron-driven reminder emails
-- (e.g. "3 days left to accept your invite"); the reminder_count +
-- last_reminded_at columns are designed to support that without
-- another schema change — the cron job would call resend_invitation
-- with the same semantics.

-- ─── Schema additions ────────────────────────────────────────────────
-- Idempotent guards so re-running the migration on a partially
-- migrated DB doesn't fail.

alter table public.household_invitations
    add column if not exists reminder_count int not null default 0;

alter table public.household_invitations
    add column if not exists last_reminded_at timestamptz;

comment on column public.household_invitations.reminder_count is
    'How many times resend_invitation has fired for this row. 0 means '
    'the invitee has never been reminded since the initial send.';

comment on column public.household_invitations.last_reminded_at is
    'Timestamp of the most recent resend_invitation call, or NULL if '
    'no reminder has been sent yet. The Members screen uses this to '
    'render "Resent N ago" copy in place of the initial "Sent N ago".';

-- ─── resend_invitation RPC ────────────────────────────────────────────

create or replace function public.resend_invitation(
    p_invitation_id uuid
)
returns public.household_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite public.household_invitations;
begin
    select * into v_invite
      from public.household_invitations
     where id = p_invitation_id
     for update;

    if not found then
        raise exception 'resend_invitation: invitation % not found',
            p_invitation_id using errcode = 'P0002';
    end if;

    if not public.is_household_parent(v_invite.household_id) then
        raise exception 'resend_invitation: not a household parent'
            using errcode = '42501';
    end if;

    if v_invite.accepted_at is not null then
        raise exception 'resend_invitation: invitation already accepted'
            using errcode = '22023';
    end if;

    -- Fully-expired invites need explicit recreate so the parent
    -- acknowledges the lifecycle reset (different from "send another
    -- nudge"). The UI surfaces an "expired" badge in this state and
    -- routes the click to revoke + open invite form pre-filled.
    if v_invite.expires_at <= now() then
        raise exception 'resend_invitation: invitation expired — use revoke + recreate'
            using errcode = '22023';
    end if;

    update public.household_invitations
       set reminder_count = coalesce(reminder_count, 0) + 1,
           last_reminded_at = now(),
           -- Refresh the 14-day window from "now" so the resend
           -- actually buys the recipient more time. Without this,
           -- a resend the day before expiry would have almost no
           -- runway left.
           expires_at = now() + interval '14 days'
     where id = p_invitation_id
     returning * into v_invite;

    return v_invite;
end;
$$;

revoke all on function public.resend_invitation(uuid) from public;
grant execute on function public.resend_invitation(uuid) to authenticated;

comment on function public.resend_invitation(uuid) is
    'Bumps reminder_count + last_reminded_at + refreshes expires_at to '
    'now() + 14 days for an unaccepted, unexpired invitation. Keeps '
    'the token stable so previously shared links keep working. Caller '
    'must be a parent on the invitation''s household (#403).';
