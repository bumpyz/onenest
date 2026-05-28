-- Event reminders (R2, #308 + #419 partial).
--
-- Per-recipient reminder rows for events. Each row = "remind this
-- profile, N minutes before event X." The cron'd edge function reads
-- this table on a 5-minute cadence, sends pushes for any row whose
-- fire time has arrived, and marks fired_at so we don't double-send.
--
-- Per-recipient (rather than per-event) is the right shape because:
--   • Dad wants "30 min before"; Mom wants "60 min before" — same
--     event, two different reminder rows.
--   • "Also notify other parent" creates a second row for the other
--     parent at creation time.
--   • Caregivers can have reminders independent of parents.
--
-- Offset semantics: `offset_minutes` is signed. Negative = before
-- event start; positive = after. Most reminders are negative (-15,
-- -30, -60, -1440 = day before). After-event reminders are rare but
-- supported for things like "Did you remember to upload photos?"
-- follow-ups.
--
-- Range: ±10080 minutes (one week). Beyond that, push reminders
-- become unreliable and users should use a separate calendar app.

create table if not exists public.event_reminders (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    offset_minutes int not null
        check (offset_minutes between -10080 and 10080),
    fired_at timestamptz,
    created_at timestamptz not null default now(),
    -- Per (event, profile, offset) uniqueness — if a user sets a
    -- reminder for an offset they already had, we update the same
    -- row instead of duplicating. Doesn't prevent (event, profile,
    -- -15) AND (event, profile, -60) from coexisting; only blocks
    -- exact dupes.
    constraint event_reminders_unique_idx unique (event_id, profile_id, offset_minutes)
);

-- Fire-window query: the cron function scans for rows whose
-- fire_at (= events.starts_at + offset_minutes) falls inside the
-- last poll window. Partial index keeps it cheap by excluding
-- already-fired rows.
create index if not exists event_reminders_pending_idx
    on public.event_reminders (event_id)
    where fired_at is null;

-- Per-event lookup for the EventForm editor + EventDetail display.
create index if not exists event_reminders_event_idx
    on public.event_reminders (event_id);

alter table public.event_reminders enable row level security;

-- SELECT: anyone in the event's household can read all reminders for
-- the event. Visibility of other people's reminder offsets is
-- intentional — a parent should be able to see "30-min reminder set
-- for Casey" so they don't both ping the kid.
create policy "event_reminders read household"
    on public.event_reminders for select
    using (
        exists (
            select 1 from public.events e
            where e.id = event_reminders.event_id
              and public.is_household_member(e.household_id)
        )
    );

-- INSERT / UPDATE / DELETE: household parents can manage reminders
-- for any household member (the "Also notify other parent" toggle
-- needs this). Caregivers + viewers can manage only their own rows.
create policy "event_reminders write parents"
    on public.event_reminders for all
    using (
        exists (
            select 1 from public.events e
            where e.id = event_reminders.event_id
              and public.is_household_parent(e.household_id)
        )
        or profile_id = auth.uid()
    )
    with check (
        exists (
            select 1 from public.events e
            where e.id = event_reminders.event_id
              and public.is_household_parent(e.household_id)
        )
        or profile_id = auth.uid()
    );

comment on table public.event_reminders is
    'Per-recipient pre-event push reminders. Cron edge function fires them; fired_at gates re-send.';

-- ─── pg_cron schedule ──────────────────────────────────────────────────
--
-- Same setup as 0028 (task-reminders cron). Reuses the same Vault
-- secret pattern so service-role rotation stays consistent.
--
-- PREREQUISITES (one-time in the Supabase dashboard):
--   1. Vault → create secret `event_reminders_service_key` with the
--      service_role JWT value. (Reuse the same key as
--      task_reminders_service_key if you want fewer rotations.)
--   2. Database → Extensions → pg_cron + pg_net (already enabled if
--      sunday-summary / task-reminders cron is running).
--   3. Deploy the function:
--        supabase functions deploy event-reminders --no-verify-jwt
--   4. Apply this migration.

do $$ begin
    if not exists (
        select 1 from vault.secrets where name = 'event_reminders_service_key'
    ) then
        raise exception 'Vault secret "event_reminders_service_key" is missing — create it before running this migration (see comments above).';
    end if;
end $$;

-- Idempotent: drop any previous version of this job before re-scheduling.
do $$ begin
    if exists (select 1 from cron.job where jobname = 'onenest-event-reminders') then
        perform cron.unschedule('onenest-event-reminders');
    end if;
end $$;

select cron.schedule(
    'onenest-event-reminders',
    '*/5 * * * *',  -- every 5 minutes; matches task-reminders cadence
    $$
    select net.http_post(
        url := 'https://bsagadozeneyudesuufn.supabase.co/functions/v1/event-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'event_reminders_service_key'
            )
        ),
        body := '{}'::jsonb
    ) as request_id;
    $$
);
