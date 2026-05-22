-- Household type: drives which features are relevant (custody, co-parent invites).
-- Existing rows default to 'separated' since that's the configuration the app has been
-- behaving as up to this point — keeps every current household working unchanged.

create type public.household_type as enum (
    'single_parent',
    'couple',
    'separated'
);

alter table public.households
    add column household_type public.household_type not null default 'separated';
