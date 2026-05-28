-- ════════════════════════════════════════════════════════════════════════
-- 0064 — Reload PostgREST schema cache for tasks.priority
-- ════════════════════════════════════════════════════════════════════════
--
-- Symptom in the client (web dev console):
--
--     task create failed { code: 'PGRST204',
--       message: "Could not find the 'priority' column of 'tasks' in
--                 the schema cache" }
--
-- PGRST204 is PostgREST's "schema cache miss" — the column either
-- doesn't actually exist OR PostgREST cached the schema before the
-- column landed and hasn't refreshed. Migrations 0037 (introduce
-- task_priority enum + column) and 0038 (extend the enum with 'none'
-- + 'urgent') should have addressed this months ago, but at least one
-- environment is reporting the error live, so this migration:
--
--   1. Re-asserts the priority column with IF NOT EXISTS guards — a
--      no-op when the column already exists; recreates it from scratch
--      if 0037 was somehow skipped. The enum + column shape exactly
--      matches what 0037 + 0038 would produce together.
--   2. Sends `NOTIFY pgrst, 'reload schema'` at the end. PostgREST
--      listens on the `pgrst` channel and reloads its in-memory schema
--      cache on receipt. This guarantees the client sees the column
--      on the next request even if a previous schema cache was stale.
--
-- Idempotent throughout — re-running on a healthy DB is a no-op
-- (column already exists, enum already has every label, schema reload
-- is just a hint to PostgREST).

-- ─── 1. Re-assert the enum + column ──────────────────────────────────────
-- Same shape 0037 + 0038 would produce together. Each guard checks
-- against pg_type / pg_enum so re-running on a healthy DB skips the
-- modification.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'task_priority') then
        create type public.task_priority as enum ('none', 'low', 'normal', 'high', 'urgent');
    end if;
end$$;

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.task_priority'::regtype
          and enumlabel = 'none'
    ) then
        alter type public.task_priority add value 'none' before 'low';
    end if;
end$$;

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.task_priority'::regtype
          and enumlabel = 'urgent'
    ) then
        alter type public.task_priority add value 'urgent' after 'high';
    end if;
end$$;

alter table public.tasks
    add column if not exists priority public.task_priority
        not null
        default 'normal';

-- ─── 2. Force PostgREST to reload its schema cache ──────────────────────
-- PostgREST listens on the `pgrst` LISTEN channel and reloads its
-- in-memory cache on receipt of either 'reload schema' or 'reload
-- config'. Without this, even a freshly-added column can be invisible
-- to the API for up to the cache refresh interval (default 10 minutes
-- in older PostgREST releases). The NOTIFY is a hint, not a
-- guarantee — but it's a one-line operation with no downside.

notify pgrst, 'reload schema';
