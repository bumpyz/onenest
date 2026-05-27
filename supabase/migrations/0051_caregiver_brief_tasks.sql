-- Caregiver brief tasks (Phase G, #397 follow-up).
--
-- Brief items live on the household (default_brief_items jsonb, added
-- in migration 0050). On hand-off days the app auto-generates one
-- task per brief item, assigned to the on-duty caregiver, due at the
-- handoff time. The caregiver checks them off as they hand the kids
-- back; the strip's countdown chip flips from soft → alert while any
-- remain open within ~2h of the handoff (design source: strip-variants
-- README · Caregiver countdown).
--
-- This migration tags the task rows so they're identifiable without
-- a separate table. The shared `tasks` table already carries
-- title / due_at / assignees / completed_at — everything we need.
-- A `kind` enum distinguishes brief tasks from standard tasks so:
--
--   • The strip can count open brief tasks for the alert state
--   • The Today list can group them under their own "Hand-off brief"
--     section (Phase G follow-up, not in this migration)
--   • The generator is idempotent — re-running won't dup brief tasks
--     for the same handoff (covered by a unique partial index below)
--
-- Default for existing rows is 'standard'. No backfill needed; all
-- prior tasks become 'standard' automatically.

create type public.task_kind as enum (
    'standard',
    -- Auto-generated brief task: the caregiver hands these back to
    -- the next parent at the handoff (medication notes, school pickup
    -- changes, etc.). Generated from households.default_brief_items.
    'caregiver_brief'
);

alter table public.tasks
    add column if not exists kind public.task_kind not null
        default 'standard';

-- Unique constraint preventing duplicate brief tasks for the same
-- (household, due_at, title) tuple. The generator runs each time the
-- caregiver opens the app on a hand-off day; without this, a slow
-- network or double-tap could insert duplicates.
--
-- Partial — only enforced on caregiver_brief rows so standard tasks
-- keep their existing "duplicate titles are fine" semantics.
create unique index if not exists tasks_brief_unique_idx
    on public.tasks (household_id, due_at, title)
    where kind = 'caregiver_brief';

comment on column public.tasks.kind is
    'Distinguishes auto-generated caregiver brief tasks (kind=caregiver_brief, paired with households.default_brief_items + a handoff date) from standard user-created tasks.';
