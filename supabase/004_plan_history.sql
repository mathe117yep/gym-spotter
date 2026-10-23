-- Completed plans (a bulk/cut/recomp from its start date to the day it ended or was switched).
-- Run once in Supabase > SQL Editor.
create table if not exists public.plan_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal       text not null check (goal in ('bulk', 'cut', 'recomp')),
  started_on date not null,
  ended_on   date not null,
  created_at timestamptz not null default now()
);
create index if not exists plan_history_user on public.plan_history (user_id, ended_on);

alter table public.plan_history enable row level security;

create policy "plan_history: signed-in users can view" on public.plan_history
  for select to authenticated using (true);
create policy "plan_history: owner can insert" on public.plan_history
  for insert to authenticated with check (user_id = auth.uid());
create policy "plan_history: owner can delete" on public.plan_history
  for delete to authenticated using (user_id = auth.uid());
