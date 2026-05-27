-- Migration 0043 — children schema buildout for AddChild v2 (spec 07.2).
--
-- The creation-flows spec (docs/design-handoffs/onenest-spec-v1/
-- design_handoff_creation_flows/README.md) expands the child profile
-- from {display_name, birthdate, notes, color} to the full set of
-- fields described in canvas 07.2:
--
--   Basics:    pronouns, nickname  (plus existing display_name + birthdate)
--   School:    school, grade, teacher
--   Custody:   lives_with junction + follows_main_pattern bool
--   Health:    allergies + medications junctions, pediatrician (FK to contacts)
--   Visibility: caregiver_visibility enum
--
-- All new columns are nullable so legacy rows continue to work. New
-- junction tables get RLS policies mirroring the parent children
-- table's "any household member can read / parents can write" model.
--
-- No data migration is required; legacy rows simply expose the new
-- fields as null until the user edits them in AddChild.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- New scalar columns on children
-- ─────────────────────────────────────────────────────────────────────────

alter table public.children
    add column if not exists pronouns text,
    add column if not exists nickname text,
    add column if not exists school text,
    add column if not exists grade text,
    add column if not exists teacher text,
    -- When true, this child inherits the household's custody pattern.
    -- When false, the child has its own pattern (per-child override
    -- flow — separate UI surface, tracked under custody v2).
    add column if not exists follows_main_pattern boolean not null default true,
    -- Pediatrician contact — soft link into the contacts table. On
    -- contact delete the FK is nulled (set null) rather than cascading,
    -- because losing a contact shouldn't lose the child row.
    add column if not exists pediatrician_contact_id uuid
        references public.contacts (id) on delete set null;

-- Visibility enum — what caregivers can see for this child. Mirrors
-- the spec's "Assigned only / Everything / Custom" radio. The Custom
-- variant defers to per-event ACLs (future work); for v1 it acts the
-- same as Assigned only.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'child_caregiver_visibility') then
        create type child_caregiver_visibility as enum (
            'assigned_only',
            'everything',
            'custom'
        );
    end if;
end$$;

alter table public.children
    add column if not exists caregiver_visibility child_caregiver_visibility
        not null default 'assigned_only';

create index if not exists children_pediatrician_idx
    on public.children (pediatrician_contact_id);

-- ─────────────────────────────────────────────────────────────────────────
-- children_living_with — which household members "live with" the child
-- ─────────────────────────────────────────────────────────────────────────
-- Drives shared-custody enablement: tapping an external co-parent into
-- the picker activates shared custody for THIS child. Bare household
-- members (parents in a single household) don't change behavior.

create table if not exists public.children_living_with (
    child_id uuid not null references public.children (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (child_id, profile_id)
);

create index if not exists children_living_with_child_idx
    on public.children_living_with (child_id);
create index if not exists children_living_with_profile_idx
    on public.children_living_with (profile_id);

alter table public.children_living_with enable row level security;

-- Read: any household member can see who a child lives with.
create policy "children_living_with read"
    on public.children_living_with
    for select
    using (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_living_with.child_id
              and hm.profile_id = auth.uid()
        )
    );

-- Write: only parents in the household (matches children write policy).
create policy "children_living_with write"
    on public.children_living_with
    for all
    using (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_living_with.child_id
              and hm.profile_id = auth.uid()
              and hm.role = 'parent'
        )
    )
    with check (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_living_with.child_id
              and hm.profile_id = auth.uid()
              and hm.role = 'parent'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────
-- children_allergies — labeled allergy rows per child + optional severity
-- ─────────────────────────────────────────────────────────────────────────
-- Free-text label so households can capture anything (food, medication,
-- environmental). Severity is a soft enum so the UI can color-flag
-- anaphylactic risks in the Health chip rack.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'allergy_severity') then
        create type allergy_severity as enum ('mild', 'moderate', 'severe');
    end if;
end$$;

create table if not exists public.children_allergies (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null references public.children (id) on delete cascade,
    label text not null,
    severity allergy_severity,
    notes text,
    created_at timestamptz not null default now()
);

create index if not exists children_allergies_child_idx
    on public.children_allergies (child_id);

alter table public.children_allergies enable row level security;

create policy "children_allergies read"
    on public.children_allergies
    for select
    using (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_allergies.child_id
              and hm.profile_id = auth.uid()
        )
    );

create policy "children_allergies write"
    on public.children_allergies
    for all
    using (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_allergies.child_id
              and hm.profile_id = auth.uid()
              and hm.role = 'parent'
        )
    )
    with check (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_allergies.child_id
              and hm.profile_id = auth.uid()
              and hm.role = 'parent'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────
-- children_medications — labeled medication rows per child + dose / notes
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.children_medications (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null references public.children (id) on delete cascade,
    label text not null,
    dose text,
    notes text,
    created_at timestamptz not null default now()
);

create index if not exists children_medications_child_idx
    on public.children_medications (child_id);

alter table public.children_medications enable row level security;

create policy "children_medications read"
    on public.children_medications
    for select
    using (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_medications.child_id
              and hm.profile_id = auth.uid()
        )
    );

create policy "children_medications write"
    on public.children_medications
    for all
    using (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_medications.child_id
              and hm.profile_id = auth.uid()
              and hm.role = 'parent'
        )
    )
    with check (
        exists (
            select 1
            from public.children c
            join public.household_members hm on hm.household_id = c.household_id
            where c.id = children_medications.child_id
              and hm.profile_id = auth.uid()
              and hm.role = 'parent'
        )
    );

commit;
