-- Male/female (only used to pick how body measurements are rated) and a hips measurement.
-- Run once in Supabase > SQL Editor.
alter table public.profiles
  add column if not exists sex text check (sex in ('male', 'female'));

alter table public.measurements
  add column if not exists hips numeric;
