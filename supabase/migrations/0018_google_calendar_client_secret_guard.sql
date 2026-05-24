-- Confirms that the Vault secret used by the upcoming google-token-refresh / google-token-
-- exchange edge functions is in place. This migration introduces NO schema changes — its
-- only job is to surface a config error here, where it's obvious, instead of inside the
-- edge function (where it would manifest as a confusing 500 during user pairing flows).
--
-- The secret carries the client_secret of a NEW "Web application" OAuth client that the
-- user creates in Google Cloud Console (separate from the OAuth client Supabase Auth uses
-- for sign-in). Storing it in Vault keeps it out of edge-function source and out of the
-- function's plain-env settings.
--
-- PREREQUISITE (do this once in the Supabase dashboard):
--   1. Google Cloud Console → APIs & Services → Credentials → Create credentials →
--      OAuth client ID → Web application. Redirect URI: http://localhost:8081/oauth/google
--      (add prod URLs later). Copy the client_secret.
--   2. Integrations → Vault → New secret:
--        Name:  google_calendar_client_secret
--        Value: <the client_secret from step 1>
--      (Or via SQL Editor:
--         select vault.create_secret(
--             '<client-secret>',
--             'google_calendar_client_secret',
--             'OAuth client_secret for the Google Calendar refresh proxy edge function.'
--         );)
--   3. Apply this migration. It will pass once the secret exists, fail otherwise.
--
-- Mirrors the 0013 guard pattern (which validates sunday_summary_service_key).

do $$ begin
    if not exists (
        select 1 from vault.secrets where name = 'google_calendar_client_secret'
    ) then
        raise exception
            'Vault secret "google_calendar_client_secret" is missing — create it before applying this migration (see comments above).';
    end if;
end $$;
