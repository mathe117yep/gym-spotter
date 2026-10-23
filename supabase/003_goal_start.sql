-- Remembers when each person started their current goal, for "up 10 lb total" on Buddies.
-- Run once in Supabase > SQL Editor.
alter table public.profiles
  add column if not exists goal_started_on date;

-- Anyone who already picked a goal counts as starting today (they can change the date on the Plan tab).
update public.profiles
set goal_started_on = current_date
where goal is not null and goal_started_on is null;
