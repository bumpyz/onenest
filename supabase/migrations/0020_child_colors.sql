-- Per-child color used everywhere we need to visually indicate which kid an event
-- applies to (colored badge with the child's first initial). Palette is intentionally
-- distinct from PARENT_PALETTE (cooler/saturated) — these are warmer pastels — so a
-- parent's color and a child's color never collide on the same event block.
--
-- Mirrors migration 0005 (member colors): default-assigned by trigger so callers don't
-- need to know about colors, backfill walks existing rows in insertion order, palette
-- duplicated literally in src/lib/colors.ts (keep them in lockstep when editing).
--
-- No SECURITY DEFINER update-color RPC here: the existing RLS policy on `children`
-- already restricts UPDATE to parents only, which is the correct guard (only a parent
-- should ever change a kid's color), and there's no role-escalation analog like there
-- was for household_members.color.

-- Idempotency: re-run safe via IF NOT EXISTS on the column add. The backfill DO block
-- only writes to rows with NULL color (skip already-colored rows on retry). The final
-- ALTER ... SET NOT NULL is a no-op once it's already not null.
alter table public.children
    add column if not exists color text;

do $$
declare
    palette text[] := array[
        '#F4A6C0', '#A8DEC5', '#A8C9E8', '#C9B0E0',
        '#F4B895', '#F2D88B', '#F2A088', '#A0D8CC'
    ];
    rec record;
    counters jsonb := '{}'::jsonb;
    idx int;
begin
    for rec in
        select household_id, id
        from public.children
        where color is null
        order by household_id, created_at
    loop
        idx := coalesce((counters ->> rec.household_id::text)::int, 0);
        update public.children
        set color = palette[(idx % array_length(palette, 1)) + 1]
        where id = rec.id;
        counters := counters || jsonb_build_object(rec.household_id::text, idx + 1);
    end loop;
end $$;

alter table public.children
    alter column color set not null;

create or replace function public.child_default_color()
returns trigger
language plpgsql
as $$
declare
    palette text[] := array[
        '#F4A6C0', '#A8DEC5', '#A8C9E8', '#C9B0E0',
        '#F4B895', '#F2D88B', '#F2A088', '#A0D8CC'
    ];
    existing_count int;
begin
    if new.color is null then
        select count(*) into existing_count
        from public.children
        where household_id = new.household_id;
        new.color := palette[(existing_count % array_length(palette, 1)) + 1];
    end if;
    return new;
end;
$$;

drop trigger if exists child_color_default on public.children;
create trigger child_color_default
    before insert on public.children
    for each row execute function public.child_default_color();
