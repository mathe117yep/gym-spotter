-- Body measurements become private: only the owner can see their own.
-- Run once in Supabase > SQL Editor.
drop policy if exists "measurements: signed-in users can view" on public.measurements;

create policy "measurements: owner can view" on public.measurements
  for select to authenticated using (user_id = auth.uid());
