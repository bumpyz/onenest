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
-- This migration reverses the parts of 0061 that touch user-defined
-- schema:
--   1. Drop the four storage.objects RLS policies scoped to the bucket.
--   2. Drop `profiles.avatar_url`.
--
-- The `profile-avatars` Storage bucket itself is NOT removed by this
-- migration. Supabase ships a protective trigger that blocks direct
-- DELETE on `storage.objects` even from the postgres role:
--
--     ERROR: Direct deletion from storage tables is not allowed.
--            Use the Storage API instead. (SQLSTATE 42501)
--
-- So the only safe path to remove the bucket is via the Supabase
-- dashboard or the Storage API. Leaving the bucket in place is
-- harmless — it has no objects (nobody ever uploaded; the feature was
-- cut before public release), the RLS policies are gone so it's
-- inaccessible to clients, and it never accrues cost. Delete it via:
--
--     Supabase Studio → Storage → profile-avatars → ⋮ → Delete bucket
--
-- or, programmatically:
--
--     curl -X DELETE \
--          -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
--          "${SUPABASE_URL}/storage/v1/bucket/profile-avatars"
--
-- Idempotent throughout — `drop policy if exists`, `drop column if exists`.

-- ─── 1. Drop RLS policies ────────────────────────────────────────────────

do $$
begin
    execute $sql$drop policy if exists "profile-avatars read" on storage.objects$sql$;
    execute $sql$drop policy if exists "profile-avatars insert" on storage.objects$sql$;
    execute $sql$drop policy if exists "profile-avatars update" on storage.objects$sql$;
    execute $sql$drop policy if exists "profile-avatars delete" on storage.objects$sql$;
end$$;

-- ─── 2. Drop the column ─────────────────────────────────────────────────

alter table public.profiles
    drop column if exists avatar_url;
