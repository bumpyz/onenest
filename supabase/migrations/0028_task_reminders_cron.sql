-- Schedules the task-reminders edge function to run every 5 minutes. The 5-minute
-- cadence is the practical floor for "reminder feels timely without flooding the
-- cron infrastructure" — at 1-min we'd be running 1,440 jobs/day, mostly no-ops;
-- at 15-min reminders feel late. 5 min hits the sweet spot.
--
-- The partial index on tasks (reminder_at) where reminded_at IS NULL keeps each
-- run cheap even with thousands of completed tasks in the table.
--
-- PREREQUISITES (do these once in the Supabase dashboard, in order):
--   1. Integrations → Vault → create a secret:
--        Name:  task_reminders_service_key
--        Value: <your service role JWT from Settings → API → service_role>
--      You can reuse the same key the sunday-summary cron uses (it's just the
--      service role), but giving each cron job its own Vault entry lets you
--      rotate them independently.
--   2. Database → Extensions → enable `pg_cron` and `pg_net` (already enabled if
--      you set up the sunday-summary cron)
--   3. Deploy the function from the project root:
--        supabase functions deploy task-reminders --no-verify-jwt
--   4. Apply this migration via SQL Editor.

-- Fail loudly if prereq 1 wasn't done.
do $$ begin
    if not exists (
        select 1 from vault.secrets where name = 'task_reminders_service_key'
    ) then
        raise exception 'Vault secret "task_reminders_service_key" is missing — create it before running this migration (see comments above).';
    end if;
end $$;

-- Idempotent: drop any previous version of this job before re-scheduling.
do $$ begin
    if exists (select 1 from cron.job where jobname = 'onenest-task-reminders') then
        perform cron.unschedule('onenest-task-reminders');
    end if;
end $$;

select cron.schedule(
    'onenest-task-reminders',
    '*/5 * * * *',  -- every 5 minutes
    $$
    select net.http_post(
        url := 'https://bsagadozeneyudesuufn.supabase.co/functions/v1/task-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'task_reminders_service_key'
            )
        ),
        body := '{}'::jsonb
    ) as request_id;
    $$
);

-- Useful follow-up queries (run separately, not part of this migration):
--   Inspect runs:    select * from cron.job_run_details
--                    where jobid = (select jobid from cron.job where jobname = 'onenest-task-reminders')
--                    order by start_time desc limit 20;
--   Stop schedule:   select cron.unschedule('onenest-task-reminders');
--   Rotate key:      select vault.update_secret(
--                        (select id from vault.secrets where name = 'task_reminders_service_key'),
--                        '<new-service-role-key>'
--                    );
