-- Training balance: a shared exercise -> muscle list, and per-person set targets.
-- Run once in Supabase > SQL Editor.

-- Exercises the crew has mapped to muscles (the app has ~80 common ones built in;
-- this table holds additions and corrections, shared by everyone).
create table if not exists public.exercise_map (
  name              text primary key,          -- normalized exercise name
  display_name      text not null,             -- as first typed
  primary_muscles   text[] not null,           -- 1 set credit each
  secondary_muscles text[] not null default '{}', -- 0.5 set credit each
  updated_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

alter table public.exercise_map enable row level security;

create policy "exercise_map: signed-in users can view" on public.exercise_map
  for select to authenticated using (true);
create policy "exercise_map: signed-in users can add" on public.exercise_map
  for insert to authenticated with check (true);
create policy "exercise_map: signed-in users can edit" on public.exercise_map
  for update to authenticated using (true) with check (true);

-- Per-person target overrides, e.g. {"chest": [12, 20]}. Empty = use the defaults.
alter table public.profiles
  add column if not exists muscle_targets jsonb;
