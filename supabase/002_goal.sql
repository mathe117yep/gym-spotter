-- Adds the body composition goal (Plan tab). Run once in Supabase > SQL Editor.
alter table public.profiles
  add column if not exists goal text check (goal in ('bulk', 'cut', 'recomp'));
