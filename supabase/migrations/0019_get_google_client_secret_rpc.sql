-- Server-side accessor for the google_calendar_client_secret Vault secret. The
-- google-oauth-proxy edge function calls this with its service_role JWT to retrieve the
-- secret right before it relays a token exchange / refresh request to Google.
--
-- Why an RPC rather than a direct vault.decrypted_secrets query from the function:
--   * Vault is restricted; even service_role doesn't get a default SELECT grant on
--     vault.decrypted_secrets (it's owned by supabase_admin).
--   * SECURITY DEFINER bridges that gap cleanly — function runs as the owner (postgres),
--     which can read Vault, and we restrict EXECUTE to service_role so authenticated
--     users / anon can't call it themselves.
--
-- If you ever rotate the client_secret, just update the Vault entry — the RPC reads it
-- fresh on every call, no redeploy.

create or replace function public.get_google_calendar_client_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'google_calendar_client_secret';
$$;

-- Lock down execution: only the service_role (the edge function's identity) can call this.
-- Authenticated users with the publishable key cannot, even if they discover the function
-- name. PUBLIC includes anon + authenticated, so revoking from PUBLIC covers them both.
revoke execute on function public.get_google_calendar_client_secret() from public;
revoke execute on function public.get_google_calendar_client_secret() from authenticated;
revoke execute on function public.get_google_calendar_client_secret() from anon;
grant execute on function public.get_google_calendar_client_secret() to service_role;
