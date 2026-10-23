-- Profile pics: visible to everyone signed in (unlike progress pics), changeable only by the owner.
-- Run once in Supabase > SQL Editor.
alter table public.profiles
  add column if not exists avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "avatar files: signed-in users can view" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatar files: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar files: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
