-- ════════════════════════════════════════════════════════════════════════
-- 0062 — Drop profile avatars (cuts #402 from scope)
-- ════════════════════════════════════════════════════════════════════════
--
-- Migration 0061 added a `profile-avatars` Storage bucket + an
-- `avatar_url` column on profiles for user-uploaded photos. The product
-- decision is to drop the feature entirely — initials-in-color avatars
-- carry enough identity for the surfaces we render today, and the
-- upload UX wasn't pulling its weight.
--
-- This migration reverses 0061:
--   1. Drop the four storage.objects RLS policies scoped to the bucket.
--   2. Empty + delete the `profile-avatars` Storage bucket. Buckets with
--      remaining objects can't be deleted, so we wipe rows from
--      storage.objects first (matched by bucket_id).
--   3. Drop `profiles.avatar_url`.
--
-- Idempotent throughout — `drop policy if exists`, conditional delete,
-- `drop column if exists`.

-- ─── 1. Drop RLS policies ────────────────────────────────────────────────

do $$
begin
    execute $sql$drop policy if exists "profile-avatars read" on storage.objects$sql$;
    execute $sql$drop policy if exists "profile-avatars insert" on storage.objects$sql$;
    execute $sql$drop policy if exists "profile-avatars update" on storage.objects$sql$;
    execute $sql$drop policy if exists "profile-avatars delete" on storage.objects$sql$;
end$$;

-- ─── 2. Drop the Storage bucket ─────────────────────────────────────────
--
-- Wipe any objects first so the bucket can be deleted. RLS is bypassed
-- here because migrations run as the postgres role.

delete from storage.objects where bucket_id = 'profile-avatars';
delete from storage.buckets where id = 'profile-avatars';

-- ─── 3. Drop the column ─────────────────────────────────────────────────

alter table public.profiles
    drop column if exists avatar_url;
