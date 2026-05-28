-- ════════════════════════════════════════════════════════════════════════
-- 0061 — Profile photo avatars (#402)
-- ════════════════════════════════════════════════════════════════════════
--
-- Adds:
--   1. avatar_url column on profiles (nullable; null → MemberAvatar renders
--      the initial in the member's color the same way it does today).
--   2. A `profile-avatars` Storage bucket scoped per profile. Path layout:
--        profile-avatars/{profile_id}/avatar.{ext}
--      Storing under profile_id (= auth.uid()) means the bucket's RLS
--      policies can compare path-first-segment against auth.uid() directly
--      — same trick the supabase Storage docs recommend for per-user assets.
--
-- Permission shape:
--   • Read: any authenticated user. Member avatars get rendered across
--     household surfaces (chips, sheets, custody strip, hand-off cards)
--     and gating the URL behind per-household membership would mean
--     re-querying for every render. Profile avatars are essentially
--     public-facing once a user signs in — display name + initials are
--     already exposed at every chip, so the photo isn't carrying extra
--     privacy weight. The bucket stays private so URLs need to be signed,
--     which keeps the path UUIDs from being scraped.
--   • Write (insert/update/delete): only the owner — `auth.uid()` must
--     match the path's first segment. Nobody can stomp another user's
--     avatar bytes.
--
-- The bucket is private. Clients fetch images via signed URLs we mint at
-- read time (same pattern as contact-avatars).
--
-- Idempotent throughout. The Storage bucket insert uses ON CONFLICT DO NOTHING
-- so re-running this migration in any environment is safe.

-- ─── 1. avatar_url column ───────────────────────────────────────────────────

alter table public.profiles
    add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
    'Storage path within the profile-avatars bucket — `{profile_id}/avatar.{ext}`. '
    'Null when the user has not uploaded a photo; the UI falls back to the '
    'initial-in-color avatar. The bucket is private; getProfileAvatarSignedUrl '
    'mints a signed URL for display.';

-- ─── 2. Storage bucket ──────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

-- ─── 3. Storage RLS policies ────────────────────────────────────────────────
--
-- Path layout: {profile_id}/avatar.{ext}. Storage exposes the path as `name`
-- on storage.objects rows; the first slash-delimited segment is the
-- profile_id we check against auth.uid() for writes.

do $$
begin
    -- Drop any prior policies with these names before recreating, so this
    -- migration is safe to re-run.
    execute $sql$drop policy if exists "profile-avatars read" on storage.objects$sql$;
    execute $sql$create policy "profile-avatars read"
        on storage.objects for select
        using (
            bucket_id = 'profile-avatars'
            and auth.role() = 'authenticated'
        )$sql$;

    execute $sql$drop policy if exists "profile-avatars insert" on storage.objects$sql$;
    execute $sql$create policy "profile-avatars insert"
        on storage.objects for insert
        with check (
            bucket_id = 'profile-avatars'
            and (storage.foldername(name))[1]::uuid = auth.uid()
        )$sql$;

    execute $sql$drop policy if exists "profile-avatars update" on storage.objects$sql$;
    execute $sql$create policy "profile-avatars update"
        on storage.objects for update
        using (
            bucket_id = 'profile-avatars'
            and (storage.foldername(name))[1]::uuid = auth.uid()
        )
        with check (
            bucket_id = 'profile-avatars'
            and (storage.foldername(name))[1]::uuid = auth.uid()
        )$sql$;

    execute $sql$drop policy if exists "profile-avatars delete" on storage.objects$sql$;
    execute $sql$create policy "profile-avatars delete"
        on storage.objects for delete
        using (
            bucket_id = 'profile-avatars'
            and (storage.foldername(name))[1]::uuid = auth.uid()
        )$sql$;
end$$;
