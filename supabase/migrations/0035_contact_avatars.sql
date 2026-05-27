-- Optional photo avatars for contacts. Adds:
--   1. avatar_url column on contacts (nullable; null → InitialsAvatar renders
--      the contact's initials in a name-hashed muted color instead).
--   2. A "contact-avatars" Storage bucket scoped per household. Path layout:
--        contact-avatars/{household_id}/{contact_id}.{ext}
--      Storing under household_id means RLS can scope ownership by parsing
--      the path's first segment — same trick the supabase Storage docs
--      recommend for per-tenant images.
--
-- Permission shape mirrors the contacts table itself:
--   • Read: any authenticated user whose household_id matches the path's
--     first segment. Caregivers see avatars just like names + numbers.
--   • Write (insert/update/delete): the household's parents only. Caregivers
--     cannot change a photo (or any other contact field).
--
-- The bucket is private. Clients fetch images via signed URLs we mint at
-- read time. Setting public = true would dodge the URL plumbing but expose
-- every household's contact photos to anyone who guesses a UUID; not worth
-- the convenience for what's effectively a directory of phone numbers + faces.
--
-- Idempotent throughout. The Storage bucket insert uses ON CONFLICT DO NOTHING
-- so re-running this migration in any environment is safe.

-- ─── 1. avatar_url column ───────────────────────────────────────────────────

alter table public.contacts
    add column if not exists avatar_url text;

-- ─── 2. Storage bucket ──────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('contact-avatars', 'contact-avatars', false)
on conflict (id) do nothing;

-- ─── 3. Storage RLS policies ────────────────────────────────────────────────
--
-- The path layout is {household_id}/{contact_id}.{ext}. Storage exposes the
-- path as `name` on storage.objects rows; the first slash-delimited segment
-- is the household_id we check membership against.
--
-- Read (select): is_household_member of the path's first segment.
-- Insert / update / delete: is_household_parent of same.

do $$
begin
    -- Drop any prior policies with these names before recreating, so this
    -- migration is safe to re-run.
    execute $sql$drop policy if exists "contact-avatars read" on storage.objects$sql$;
    execute $sql$create policy "contact-avatars read"
        on storage.objects for select
        using (
            bucket_id = 'contact-avatars'
            and public.is_household_member((storage.foldername(name))[1]::uuid)
        )$sql$;

    execute $sql$drop policy if exists "contact-avatars insert" on storage.objects$sql$;
    execute $sql$create policy "contact-avatars insert"
        on storage.objects for insert
        with check (
            bucket_id = 'contact-avatars'
            and public.is_household_parent((storage.foldername(name))[1]::uuid)
        )$sql$;

    execute $sql$drop policy if exists "contact-avatars update" on storage.objects$sql$;
    execute $sql$create policy "contact-avatars update"
        on storage.objects for update
        using (
            bucket_id = 'contact-avatars'
            and public.is_household_parent((storage.foldername(name))[1]::uuid)
        )
        with check (
            bucket_id = 'contact-avatars'
            and public.is_household_parent((storage.foldername(name))[1]::uuid)
        )$sql$;

    execute $sql$drop policy if exists "contact-avatars delete" on storage.objects$sql$;
    execute $sql$create policy "contact-avatars delete"
        on storage.objects for delete
        using (
            bucket_id = 'contact-avatars'
            and public.is_household_parent((storage.foldername(name))[1]::uuid)
        )$sql$;
end$$;
