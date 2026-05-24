-- Schedules the sunday-summary edge function to fire every Sunday at 9 AM US Eastern
-- (14:00 UTC). The service role key needed to authenticate to the function lives in
-- Supabase Vault (encrypted at rest), NOT in this file.
--
-- PREREQUISITES (do these once in the Supabase dashboard, in order):
--   1. Integrations → Vault → enable (if not already), then create a secret:
--        Name:  sunday_summary_service_key
--        Value: <your service role JWT from Settings → API → service_role>
--      (Or via SQL Editor:
--         select vault.create_secret(
--             '<service-role-key>',
--             'sunday_summary_service_key',
--             'service role JWT used by the sunday-summary cron job'
--         );)
--   2. Database → Extensions → enable `pg_cron` and `pg_net`
--   3. Deploy the function from the project root:
--        supabase functions deploy sunday-summary --no-verify-jwt
--   4. Apply this migration via SQL Editor. The block below verifies the Vault secret
--      exists, unschedules any previous version of the job (idempotent), and creates
--      the new schedule. The Vault reference resolves at function-run time, so the key
--      never appears in plain text in cron.job.

-- Fail loudly if prereq 1 wasn't done.
do $$ begin
    if not exists (
        select 1 from vault.secrets where name = 'sunday_summary_service_key'
    ) then
        raise exception 'Vault secret "sunday_summary_service_key" is missing — create it before running this migration (see comments above).';
    end if;
end $$;

-- Idempotent: drop any previous version of this job before re-scheduling.
do $$ begin
    if exists (select 1 from cron.job where jobname = 'onenest-sunday-summary') then
        perform cron.unschedule('onenest-sunday-summary');
    end if;
end $$;

select cron.schedule(
    'onenest-sunday-summary',
    '0 14 * * SUN',  -- 14:00 UTC every Sunday = 9 AM US Eastern (standard time)
    $$
    select net.http_post(
        url := 'https://bsagadozeneyudesuufn.supabase.co/functions/v1/sunday-summary',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'sunday_summary_service_key'
            )
        ),
        body := '{}'::jsonb
    ) as request_id;
    $$
);

-- Useful follow-up queries (run separately, not part of this migration):
--   Inspect runs:    select * from cron.job_run_details order by start_time desc limit 20;
--   Stop schedule:   select cron.unschedule('onenest-sunday-summary');
--   Rotate key:      select vault.update_secret(
--                        (select id from vault.secrets where name = 'sunday_summary_service_key'),
--                        '<new-service-role-key>'
--                    );
--                    (Cron picks up the new key on its next run — no redeploy.)
