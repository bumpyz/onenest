-- Per-member color, picked by each member from a fixed palette.
-- Default-assigned on insert via a trigger so accept_invitation() doesn't need to know
-- about colors; users can later change theirs via update_my_color().

alter table public.household_members
    add column color text;

-- Backfill: assign palette colors to existing members by join order within each household.
-- Keeps existing event colors consistent with what the client previously derived from
-- assignColorsByJoinOrder.
do $$
declare
    palette text[] := array[
        '#208AEF', '#E94B6A', '#F2A93C', '#5BBE91',
        '#A678D6', '#3FAFD6', '#D6803F', '#7CB342'
    ];
    rec record;
    counters jsonb := '{}'::jsonb;
    idx int;
begin
    for rec in
        select household_id, profile_id
        from public.household_members
        order by household_id, joined_at
    loop
        idx := coalesce((counters ->> rec.household_id::text)::int, 0);
        update public.household_members
        set color = palette[(idx % array_length(palette, 1)) + 1]
        where household_id = rec.household_id and profile_id = rec.profile_id;
        counters := counters || jsonb_build_object(rec.household_id::text, idx + 1);
    end loop;
end $$;

alter table public.household_members
    alter column color set not null;

-- Trigger: when a new member is inserted without a color, pick the next palette slot
-- based on how many members the household already has.
create or replace function public.household_member_default_color()
returns trigger
language plpgsql
as $$
declare
    palette text[] := array[
        '#208AEF', '#E94B6A', '#F2A93C', '#5BBE91',
        '#A678D6', '#3FAFD6', '#D6803F', '#7CB342'
    ];
    existing_count int;
begin
    if new.color is null then
        select count(*) into existing_count
        from public.household_members
        where household_id = new.household_id;
        new.color := palette[(existing_count % array_length(palette, 1)) + 1];
    end if;
    return new;
end;
$$;

create trigger household_member_color_default
    before insert on public.household_members
    for each row execute function public.household_member_default_color();

-- update_my_color: lets a member change their own color without weakening the table's
-- UPDATE policy (which stays "parents only" to prevent role-escalation by a self-update
-- of the role column).
create or replace function public.update_my_color(
    p_household_id uuid,
    p_color text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Must be signed in' using errcode = '42501';
    end if;

    if p_color !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Invalid color format. Expected #RRGGBB.' using errcode = '22023';
    end if;

    update public.household_members
    set color = p_color
    where household_id = p_household_id
      and profile_id = auth.uid();

    if not found then
        raise exception 'You are not a member of that household' using errcode = '42501';
    end if;
end;
$$;

revoke all on function public.update_my_color(uuid, text) from public;
grant execute on function public.update_my_color(uuid, text) to authenticated;
