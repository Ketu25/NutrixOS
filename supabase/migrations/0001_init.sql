-- ============================================================================
-- NutrixOS — initial schema
-- ----------------------------------------------------------------------------
-- Design notes:
--
--   * Every table carries user_id and has RLS enabled with a policy keyed to
--     auth.uid(). There is no table a user can read another user's rows from.
--     This is nutrition and body-weight data — the default has to be closed.
--
--   * Targets are versioned rather than mutated. The copilot adapts them over
--     time, and "what was I aiming for in March" has to remain answerable.
--
--   * Entry totals are denormalised onto log_entries and maintained by a
--     trigger, so a day's rollup never has to fan out across entry_items.
--     The trigger is the only writer, so the two cannot drift.
-- ============================================================================

create extension if not exists "pgcrypto";

-- -- Enumerations --------------------------------------------------------------

create type sex as enum ('male', 'female');

create type activity_level as enum (
  'sedentary', 'light', 'moderate', 'active', 'athlete'
);

create type goal_type as enum (
  'lose_fat', 'maintain', 'gain_muscle', 'improve_nutrition', 'custom'
);

create type goal_pace as enum ('gentle', 'steady', 'aggressive');

create type dietary_pattern as enum (
  'omnivore', 'vegetarian', 'vegan', 'pescatarian',
  'keto', 'paleo', 'mediterranean'
);

create type unit_system as enum ('metric', 'imperial');

create type meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

create type entry_source as enum ('text', 'voice', 'photo', 'manual', 'recipe');

create type target_source as enum ('derived', 'adapted', 'manual');

create type insight_tone as enum ('positive', 'neutral', 'warning');

-- -- Shared trigger ------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -- profiles ------------------------------------------------------------------
-- One row per user, holding the inputs to the targets engine.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  age smallint not null check (age between 13 and 120),
  sex sex not null,
  height_cm numeric(5, 1) not null check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 400),
  activity_level activity_level not null default 'moderate',
  dietary_pattern dietary_pattern not null default 'omnivore',
  allergies text[] not null default '{}',
  unit_system unit_system not null default 'metric',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- -- goals ---------------------------------------------------------------------
-- Goals are historical. Exactly one may be active per user at a time.

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type goal_type not null,
  pace goal_pace not null default 'steady',
  target_weight_kg numeric(5, 1) check (target_weight_kg between 25 and 400),
  -- Only meaningful when type = 'custom': the user's own numbers.
  custom_targets jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Enforces "at most one active goal per user" at the database level rather
-- than trusting application code to deactivate the previous one first.
create unique index goals_one_active_per_user
  on goals (user_id) where is_active;

create index goals_user_created on goals (user_id, created_at desc);

-- -- targets -------------------------------------------------------------------
-- Append-only. Each row is what the user was aiming for from a given date.

create table targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references goals (id) on delete set null,
  effective_from date not null default current_date,
  calories integer not null check (calories > 0),
  protein integer not null check (protein >= 0),
  carbs integer not null check (carbs >= 0),
  fat integer not null check (fat >= 0),
  fiber integer not null check (fiber >= 0),
  water integer not null default 2000 check (water >= 0),
  source target_source not null default 'derived',
  -- Why the copilot changed the numbers, shown to the user.
  rationale text,
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create index targets_user_effective on targets (user_id, effective_from desc);

-- -- log_entries ---------------------------------------------------------------
-- One row per logged meal. Totals are maintained by trigger from entry_items.

create table log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  -- Denormalised for day-bucketing without a timezone-sensitive expression
  -- index. Written by the client in the user's own local date.
  logged_on date not null default current_date,
  slot meal_slot not null,
  -- The user's own words, kept verbatim. Useful for re-parsing later and for
  -- letting the user see what they actually said.
  raw_input text,
  source entry_source not null default 'text',
  photo_url text,
  total_calories integer not null default 0,
  total_protein integer not null default 0,
  total_carbs integer not null default 0,
  total_fat integer not null default 0,
  total_fiber integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index log_entries_user_day on log_entries (user_id, logged_on desc);

create trigger log_entries_updated_at
  before update on log_entries
  for each row execute function set_updated_at();

-- -- entry_items ---------------------------------------------------------------
-- The individual foods within an entry, each with its own confidence.

create table entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references log_entries (id) on delete cascade,
  position smallint not null default 0,
  name text not null,
  portion text not null,
  quantity numeric(8, 2) not null default 1,
  unit text not null default 'serving',
  calories integer not null default 0 check (calories >= 0),
  protein integer not null default 0 check (protein >= 0),
  carbs integer not null default 0 check (carbs >= 0),
  fat integer not null default 0 check (fat >= 0),
  fiber integer not null default 0 check (fiber >= 0),
  confidence numeric(3, 2) not null default 0.7
    check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create index entry_items_entry on entry_items (entry_id, position);

-- Keeps log_entries totals exactly equal to the sum of their items. Runs on
-- every change including delete, and re-sums rather than applying a delta so
-- it is self-correcting if a row is ever written out of band.
create or replace function sync_entry_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_entry uuid := coalesce(new.entry_id, old.entry_id);
begin
  update log_entries e
  set total_calories = coalesce(agg.calories, 0),
      total_protein  = coalesce(agg.protein, 0),
      total_carbs    = coalesce(agg.carbs, 0),
      total_fat      = coalesce(agg.fat, 0),
      total_fiber    = coalesce(agg.fiber, 0)
  from (
    select sum(calories) as calories,
           sum(protein)  as protein,
           sum(carbs)    as carbs,
           sum(fat)      as fat,
           sum(fiber)    as fiber
    from entry_items
    where entry_id = target_entry
  ) agg
  where e.id = target_entry;

  return null;
end;
$$;

create trigger entry_items_sync_totals
  after insert or update or delete on entry_items
  for each row execute function sync_entry_totals();

-- -- weight_logs ---------------------------------------------------------------
-- Feeds the adaptive targets loop.

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 400),
  created_at timestamptz not null default now(),
  -- One weigh-in per day; a re-weigh replaces rather than duplicates.
  unique (user_id, measured_on)
);

create index weight_logs_user_date on weight_logs (user_id, measured_on desc);

-- -- insights ------------------------------------------------------------------
-- Cached copilot output, so the same day isn't re-inferred on every load.

create table insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  for_date date not null default current_date,
  headline text not null,
  body text not null,
  suggestions text[] not null default '{}',
  tone insight_tone not null default 'neutral',
  created_at timestamptz not null default now()
);

create index insights_user_date on insights (user_id, for_date desc);

-- -- daily_totals view ---------------------------------------------------------
-- A view rather than a table: a rollup that is derived on read can never drift
-- from the entries it summarises.

create view daily_totals
with (security_invoker = true)
as
select
  user_id,
  logged_on,
  sum(total_calories)::integer as calories,
  sum(total_protein)::integer  as protein,
  sum(total_carbs)::integer    as carbs,
  sum(total_fat)::integer      as fat,
  sum(total_fiber)::integer    as fiber,
  count(*)::integer            as entry_count
from log_entries
group by user_id, logged_on;

-- ============================================================================
-- Row level security
-- ----------------------------------------------------------------------------
-- Enabled on every table. Without a matching policy the default is deny, so a
-- table added later without policies fails closed rather than leaking.
-- ============================================================================

alter table profiles     enable row level security;
alter table goals        enable row level security;
alter table targets      enable row level security;
alter table log_entries  enable row level security;
alter table entry_items  enable row level security;
alter table weight_logs  enable row level security;
alter table insights     enable row level security;

create policy "own profile" on profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own goals" on goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own targets" on targets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own entries" on log_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- entry_items has no user_id of its own; ownership is inherited through the
-- parent entry. The subquery is what stops a user attaching items to someone
-- else's entry.
create policy "own entry items" on entry_items
  for all to authenticated
  using (
    exists (
      select 1 from log_entries e
      where e.id = entry_items.entry_id
        and e.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from log_entries e
      where e.id = entry_items.entry_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "own weight logs" on weight_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own insights" on insights
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
