-- Lists: household-scoped buckets for grouping tasks. Each household gets a default
-- "Inbox" list auto-created at insertion time (and backfilled below for existing rows).
-- Lists are deletable; the FK on tasks.list_id is ON DELETE SET NULL so a list's tasks
-- survive its deletion — the client renders null list_id under "Inbox" (visually
-- equivalent to belonging to the default list).
--
-- Why a default Inbox at all:
--   * Gives the Lists tab a non-empty home state from day one — no "create a list first"
--     dead-end on a freshly invited member.
--   * Trigger-defaults new tasks (no list specified) to Inbox so every task has a bucket
--     in the UI without each createTask caller having to look up the Inbox id.
--
-- Permissions: same model as tasks — any household member can CRUD lists. Lists are
-- logistics, not coordination, and a caregiver should be able to create "Groceries"
-- without a parent role. The Inbox row is protected client-side from deletion (its
-- is_default flag suppresses the delete button in the UI) since the auto-default-task
-- trigger expects it to exist.
--
-- Idempotent throughout: safe to re-run if a previous run failed partway. CREATE IF NOT
-- EXISTS for tables/indexes, DROP-then-CREATE for policies/triggers/constraint, OR
-- REPLACE for functions, and the backfill DO block already guards against duplicate
-- Inbox rows via the partial unique index below.

create table if not exists public.lists (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    name text not null check (length(trim(name)) > 0),
    -- Pastel hex; trigger below assigns a palette color when caller omits it.
    color text,
    -- Display order in the Lists tab. Lower = first. Default Inbox seeds at 0; user-
    -- created lists default to 100 so they sort below Inbox unless explicitly reordered.
    sort_order int not null default 100,
    -- True for the auto-created Inbox. Surfaced in the UI as a non-deletable badge so
    -- the household can't accidentally lose the default-task target.
    is_default boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists lists_household_idx
    on public.lists (household_id, sort_order);
-- One default list per household. Partial unique index lets us run the backfill below
-- idempotently and protects against double-inserts from a future migration accident.
create unique index if not exists lists_one_default_per_household
    on public.lists (household_id)
    where is_default;

alter table public.lists enable row level security;

drop policy if exists "lists read" on public.lists;
create policy "lists read"
    on public.lists for select
    using (public.is_household_member(household_id));

drop policy if exists "lists write" on public.lists;
create policy "lists write"
    on public.lists for all
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));

-- Default color when caller omits it. Cycles through a palette intentionally distinct
-- from PARENT_PALETTE and CHILDREN_PALETTE so a list color never collides with a
-- person's color on shared surfaces (e.g. a colored chip strip).
create or replace function public.list_default_color()
returns trigger
language plpgsql
as $$
declare
    palette text[] := array[
        '#FFD3B6', '#FFAAA5', '#A8E6CF', '#DCEDC1',
        '#B8E0D2', '#E8C5E5', '#C7CEEA', '#FFDFD3'
    ];
    existing_count int;
begin
    if new.color is null then
        select count(*) into existing_count
        from public.lists
        where household_id = new.household_id;
        new.color := palette[(existing_count % array_length(palette, 1)) + 1];
    end if;
    return new;
end;
$$;

drop trigger if exists list_color_default on public.lists;
create trigger list_color_default
    before insert on public.lists
    for each row execute function public.list_default_color();

-- Auto-create the Inbox when a household is inserted. AFTER trigger is safe because the
-- whole household-insert transaction commits atomically — any task insert in the same
-- session will see the Inbox row.
create or replace function public.household_create_inbox()
returns trigger
language plpgsql
as $$
begin
    insert into public.lists (household_id, name, color, sort_order, is_default)
    values (new.id, 'Inbox', '#E8E8F0', 0, true);
    return new;
end;
$$;

drop trigger if exists household_inbox_default on public.households;
create trigger household_inbox_default
    after insert on public.households
    for each row execute function public.household_create_inbox();

-- Backfill: create an Inbox for every existing household that doesn't have one, then
-- snap any pre-existing tasks (which all carry null list_id today since the Lists tab
-- didn't exist) onto their household's Inbox so the FK we attach below is satisfied.
-- The lists_one_default_per_household unique index above guarantees this is safe to
-- re-run — the "create Inbox if missing" branch becomes a no-op on the second pass.
do $$
declare
    h record;
    inbox_id uuid;
begin
    for h in select id from public.households loop
        select id into inbox_id
        from public.lists
        where household_id = h.id and is_default
        limit 1;
        if inbox_id is null then
            insert into public.lists (household_id, name, color, sort_order, is_default)
            values (h.id, 'Inbox', '#E8E8F0', 0, true)
            returning id into inbox_id;
        end if;
        update public.tasks
        set list_id = inbox_id
        where household_id = h.id
          and list_id is null;
    end loop;
end $$;

-- Default new tasks to the household's Inbox when no list specified. Keeps the
-- createTask call sites simple (they don't have to fetch Inbox first) and ensures
-- every task is bucketed at insert. Tasks can still end up with null list_id later if
-- their list is deleted (SET NULL below) — the UI handles that by rendering them in
-- Inbox.
create or replace function public.task_default_list()
returns trigger
language plpgsql
as $$
declare
    inbox_id uuid;
begin
    if new.list_id is null then
        select id into inbox_id
        from public.lists
        where household_id = new.household_id and is_default
        limit 1;
        new.list_id := inbox_id;
    end if;
    return new;
end;
$$;

drop trigger if exists task_list_default on public.tasks;
create trigger task_list_default
    before insert on public.tasks
    for each row execute function public.task_default_list();

-- FK with ON DELETE SET NULL: a list's tasks survive its deletion, falling back to
-- "no list" — rendered under Inbox in the UI. Cascading delete would be cleaner data-
-- model-wise but is a worse UX (users would lose tasks they've been collecting).
alter table public.tasks drop constraint if exists tasks_list_id_fkey;
alter table public.tasks
    add constraint tasks_list_id_fkey
    foreign key (list_id) references public.lists (id) on delete set null;
