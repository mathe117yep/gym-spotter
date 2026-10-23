-- Gym Spotter database setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run once on a fresh project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique,
  display_name text not null,
  onboarded    boolean not null default false,
  goal         text check (goal in ('bulk', 'cut', 'recomp')),
  goal_started_on date,
  muscle_targets jsonb,
  created_at   timestamptz not null default now()
);

create table public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_date date not null,
  created_at   timestamptz not null default now()
);
create index workouts_user_date on public.workouts (user_id, workout_date);

create table public.sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  exercise    text not null,
  position    int  not null,          -- order of the exercise in the workout
  set_number  int  not null,          -- order of the set within the exercise
  weight      numeric not null,       -- lbs; 0 = bodyweight, extra = added weight
  reps        int  not null,
  note        text
);
create index sets_user on public.sets (user_id);
create index sets_workout on public.sets (workout_id);

create table public.bodyweights (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  logged_on date not null,
  weight    numeric not null,
  unique (user_id, logged_on)
);

create table public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  storage_path text not null,
  taken_on     date not null,
  weight       numeric,
  created_at   timestamptz not null default now()
);

create table public.plan_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal       text not null check (goal in ('bulk', 'cut', 'recomp')),
  started_on date not null,
  ended_on   date not null,
  created_at timestamptz not null default now()
);
create index plan_history_user on public.plan_history (user_id, ended_on);

create table public.exercise_map (
  name              text primary key,
  display_name      text not null,
  primary_muscles   text[] not null,
  secondary_muscles text[] not null default '{}',
  updated_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- New login -> profile row automatically.
-- The username is the part of the email before "@" (mathe117@gymspotter.app -> mathe117).
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Security: everyone signed in can VIEW workouts, sets, weights and profiles.
-- Only the owner can add, edit or delete their own. Photos are owner-only.
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.workouts        enable row level security;
alter table public.sets            enable row level security;
alter table public.bodyweights     enable row level security;
alter table public.progress_photos enable row level security;

create policy "profiles: signed-in users can view" on public.profiles
  for select to authenticated using (true);
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "workouts: signed-in users can view" on public.workouts
  for select to authenticated using (true);
create policy "workouts: owner can insert" on public.workouts
  for insert to authenticated with check (user_id = auth.uid());
create policy "workouts: owner can update" on public.workouts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workouts: owner can delete" on public.workouts
  for delete to authenticated using (user_id = auth.uid());

create policy "sets: signed-in users can view" on public.sets
  for select to authenticated using (true);
create policy "sets: owner can insert" on public.sets
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );
create policy "sets: owner can update" on public.sets
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );
create policy "sets: owner can delete" on public.sets
  for delete to authenticated using (user_id = auth.uid());

create policy "bodyweights: signed-in users can view" on public.bodyweights
  for select to authenticated using (true);
create policy "bodyweights: owner can insert" on public.bodyweights
  for insert to authenticated with check (user_id = auth.uid());
create policy "bodyweights: owner can update" on public.bodyweights
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bodyweights: owner can delete" on public.bodyweights
  for delete to authenticated using (user_id = auth.uid());

alter table public.plan_history enable row level security;
create policy "plan_history: signed-in users can view" on public.plan_history
  for select to authenticated using (true);
create policy "plan_history: owner can insert" on public.plan_history
  for insert to authenticated with check (user_id = auth.uid());
create policy "plan_history: owner can delete" on public.plan_history
  for delete to authenticated using (user_id = auth.uid());

alter table public.exercise_map enable row level security;
create policy "exercise_map: signed-in users can view" on public.exercise_map
  for select to authenticated using (true);
create policy "exercise_map: signed-in users can add" on public.exercise_map
  for insert to authenticated with check (true);
create policy "exercise_map: signed-in users can edit" on public.exercise_map
  for update to authenticated using (true) with check (true);

create policy "photos: owner only" on public.progress_photos
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private photo storage. Each user's files live in a folder named by their id.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false);

create policy "photo files: owner can view" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photo files: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photo files: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
