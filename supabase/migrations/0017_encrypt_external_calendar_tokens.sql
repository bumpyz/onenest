-- Moves OAuth tokens (access + refresh) out of the plaintext columns
-- external_calendars.encrypted_access_token / .encrypted_refresh_token (column names that
-- were always aspirational — the values were stored in the clear) into Supabase Vault.
--
-- The table now holds only UUID references (access_token_secret_id, refresh_token_secret_id)
-- pointing at vault.secrets rows. Decryption goes through SECURITY DEFINER RPCs that
-- enforce ownership via auth.uid(); the authenticated role has no direct read access to
-- vault.secrets or vault.decrypted_secrets, so a leaked anon JWT or compromised RLS
-- policy cannot expose the tokens.
--
-- Threat model this addresses:
--   * Supabase service role key leaks → ciphertext is dumped, Vault root key still needed.
--   * SQL injection in a future RPC → same.
--   * Dashboard / admin database access → ciphertext only.
--
-- Threat model this does NOT address: an attacker with the Vault root key (Supabase
-- platform compromise) can decrypt everything. That's the same trust boundary as the
-- Sunday-summary service-role key already held in Vault.
--
-- PREREQUISITE: Supabase Vault must already be enabled in this project. The 0013
-- (sunday-summary cron) migration enabled it. The block below double-checks.

do $$ begin
    if not exists (
        select 1 from pg_extension where extname = 'supabase_vault'
    ) then
        raise exception
            'supabase_vault extension is required. Enable it in Integrations → Vault before applying.';
    end if;
end $$;

-- 1. Add the new secret-id columns. Nullable during the migration so we can backfill row
--    by row before flipping the access token to NOT NULL at the end.

alter table public.external_calendars
    add column if not exists access_token_secret_id uuid,
    add column if not exists refresh_token_secret_id uuid;

-- 2. Backfill: for each row, push its plaintext tokens into Vault and record the secret
--    ids on the row. Skipped if a row was already backfilled (allows re-running the
--    migration safely after a partial failure).
do $$
declare
    r record;
    v_access_id uuid;
    v_refresh_id uuid;
begin
    for r in
        select id, encrypted_access_token, encrypted_refresh_token
        from public.external_calendars
        where access_token_secret_id is null
    loop
        v_access_id := vault.create_secret(r.encrypted_access_token);
        if r.encrypted_refresh_token is not null then
            v_refresh_id := vault.create_secret(r.encrypted_refresh_token);
        else
            v_refresh_id := null;
        end if;
        update public.external_calendars
            set access_token_secret_id = v_access_id,
                refresh_token_secret_id = v_refresh_id
            where id = r.id;
    end loop;
end $$;

-- 3. Drop the plaintext columns. From this point clients can no longer SELECT them — the
--    db.ts type and saveGoogleCalendarPairing / saveMicrosoftCalendarPairing functions
--    must be updated in the same deploy.

alter table public.external_calendars
    drop column if exists encrypted_access_token,
    drop column if exists encrypted_refresh_token;

-- 4. Now that every row has an access-token secret, lock the column down.
alter table public.external_calendars
    alter column access_token_secret_id set not null;

-- 5. Cleanup trigger: when a calendar row is deleted, also remove its Vault secrets.
--    Without this a "Disconnect" leaves dead ciphertext rows accumulating in vault.secrets.

create or replace function public.cleanup_external_calendar_vault_secrets()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
begin
    if OLD.access_token_secret_id is not null then
        delete from vault.secrets where id = OLD.access_token_secret_id;
    end if;
    if OLD.refresh_token_secret_id is not null then
        delete from vault.secrets where id = OLD.refresh_token_secret_id;
    end if;
    return OLD;
end;
$$;

drop trigger if exists external_calendars_cleanup_secrets on public.external_calendars;
create trigger external_calendars_cleanup_secrets
    before delete on public.external_calendars
    for each row execute function public.cleanup_external_calendar_vault_secrets();

-- 6. Save (insert-or-update) pairing. Handles the OAuth-completion and reconnect flows.
--    Returns the calendar row id. Idempotent on (profile_id, provider, external_account_email)
--    matching the existing unique constraint.
--
--    Refresh-token nuance: providers sometimes omit refresh_token on re-auth (Google
--    only emits it with prompt=consent + access_type=offline). When p_refresh_token is
--    null but a refresh secret already exists, we keep the existing one — losing it
--    would silently break the auto-refresh path until the user manually reconnects.

create or replace function public.save_external_calendar_pairing(
    p_provider public.calendar_provider,
    p_email text,
    p_access_token text,
    p_refresh_token text,
    p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_user_id uuid := auth.uid();
    v_existing_id uuid;
    v_access_secret_id uuid;
    v_refresh_secret_id uuid;
    v_calendar_id uuid;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;
    if p_access_token is null or length(p_access_token) = 0 then
        raise exception 'Access token is required';
    end if;

    select id, access_token_secret_id, refresh_token_secret_id
        into v_existing_id, v_access_secret_id, v_refresh_secret_id
        from public.external_calendars
        where profile_id = v_user_id
            and provider = p_provider
            and external_account_email = p_email;

    if v_existing_id is not null then
        perform vault.update_secret(v_access_secret_id, p_access_token);

        if p_refresh_token is not null and v_refresh_secret_id is not null then
            perform vault.update_secret(v_refresh_secret_id, p_refresh_token);
        elsif p_refresh_token is not null and v_refresh_secret_id is null then
            v_refresh_secret_id := vault.create_secret(p_refresh_token);
        end if;
        -- p_refresh_token null + existing secret → keep existing, do nothing.

        update public.external_calendars
            set refresh_token_secret_id = v_refresh_secret_id,
                token_expires_at = p_expires_at,
                is_active = true
            where id = v_existing_id;

        return v_existing_id;
    end if;

    v_access_secret_id := vault.create_secret(p_access_token);
    if p_refresh_token is not null then
        v_refresh_secret_id := vault.create_secret(p_refresh_token);
    end if;

    insert into public.external_calendars (
        profile_id, provider, external_account_email,
        access_token_secret_id, refresh_token_secret_id,
        token_expires_at, is_active
    ) values (
        v_user_id, p_provider, p_email,
        v_access_secret_id, v_refresh_secret_id,
        p_expires_at, true
    ) returning id into v_calendar_id;

    return v_calendar_id;
end;
$$;

-- 7. Update tokens on an existing pairing (used after refresh_token grant returns a new
--    access_token, and sometimes a new refresh_token). Same null-refresh handling as
--    save_external_calendar_pairing.

create or replace function public.update_external_calendar_tokens(
    p_calendar_id uuid,
    p_access_token text,
    p_refresh_token text,
    p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_user_id uuid := auth.uid();
    v_access_secret_id uuid;
    v_refresh_secret_id uuid;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select access_token_secret_id, refresh_token_secret_id
        into v_access_secret_id, v_refresh_secret_id
        from public.external_calendars
        where id = p_calendar_id and profile_id = v_user_id;

    if v_access_secret_id is null then
        raise exception 'Calendar % not found or not owned by caller', p_calendar_id;
    end if;

    perform vault.update_secret(v_access_secret_id, p_access_token);

    if p_refresh_token is not null and v_refresh_secret_id is not null then
        perform vault.update_secret(v_refresh_secret_id, p_refresh_token);
    elsif p_refresh_token is not null and v_refresh_secret_id is null then
        v_refresh_secret_id := vault.create_secret(p_refresh_token);
        update public.external_calendars
            set refresh_token_secret_id = v_refresh_secret_id
            where id = p_calendar_id;
    end if;

    update public.external_calendars
        set token_expires_at = p_expires_at
        where id = p_calendar_id;
end;
$$;

-- 8. Read decrypted tokens for the caller's own calendar. SECURITY DEFINER because the
--    authenticated role has no direct access to vault.decrypted_secrets; the WHERE clause
--    is the access check.

create or replace function public.get_external_calendar_tokens(p_calendar_id uuid)
returns table (
    access_token text,
    refresh_token text,
    token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    return query
        select
            (select ds.decrypted_secret
                 from vault.decrypted_secrets ds
                 where ds.id = ec.access_token_secret_id),
            case when ec.refresh_token_secret_id is null then null
                 else (select ds.decrypted_secret
                           from vault.decrypted_secrets ds
                           where ds.id = ec.refresh_token_secret_id)
            end,
            ec.token_expires_at
        from public.external_calendars ec
        where ec.id = p_calendar_id
            and ec.profile_id = v_user_id;
end;
$$;

-- 9. Grant EXECUTE to the authenticated role so the client SDK can invoke the RPCs.
--    These functions handle their own ownership checks internally.

grant execute on function
    public.save_external_calendar_pairing(public.calendar_provider, text, text, text, timestamptz),
    public.update_external_calendar_tokens(uuid, text, text, timestamptz),
    public.get_external_calendar_tokens(uuid)
    to authenticated;
