-- Body measurements (visible to the crew) and deload weeks.
-- Run once in Supabase > SQL Editor.

alter table public.profiles
  add column if not exists height_in numeric;   -- asked once, for waist-to-height ratio

create table if not exists public.measurements (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  taken_on  date not null,
  neck      numeric,
  chest     numeric,
  waist     numeric,
  biceps    numeric,
  thigh     numeric,
  calves    numeric,
  created_at timestamptz not null default now()
);
create index if not exists measurements_user on public.measurements (user_id, taken_on);

create table if not exists public.deloads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists deloads_user on public.deloads (user_id, started_on);

alter table public.measurements enable row level security;
alter table public.deloads      enable row level security;

create policy "measurements: signed-in users can view" on public.measurements
  for select to authenticated using (true);
create policy "measurements: owner can insert" on public.measurements
  for insert to authenticated with check (user_id = auth.uid());
create policy "measurements: owner can delete" on public.measurements
  for delete to authenticated using (user_id = auth.uid());

create policy "deloads: signed-in users can view" on public.deloads
  for select to authenticated using (true);
create policy "deloads: owner can insert" on public.deloads
  for insert to authenticated with check (user_id = auth.uid());
create policy "deloads: owner can delete" on public.deloads
  for delete to authenticated using (user_id = auth.uid());
