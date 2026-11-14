-- M1 / 3: private bucket for dish photos. Path convention: {user_id}/{uuid}.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy dish_photos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'dish-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy dish_photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dish-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy dish_photos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'dish-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'dish-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy dish_photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'dish-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
