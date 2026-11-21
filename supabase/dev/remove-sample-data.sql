-- DEV ONLY: removes everything sample-data.sql added, and nothing else.
-- Dishes tagged 'sample' go first, then the places created for them (provider 'sample').
--
-- Sample PHOTOS live in the private dish-photos bucket as <your-user-id>/<dish-id>.jpg. Files can't be
-- deleted with SQL (that would orphan the stored bytes), so list them first, then remove them with the
-- Storage tab in the dashboard or `supabase storage rm --experimental --linked ss:///dish-photos/<path>`.
-- Run this select BEFORE the deletes below, while the dishes still exist:
select photo_path as sample_photo_to_delete_from_storage
  from public.dishes
 where 'sample' = any (tags) and photo_path is not null;

delete from public.lists where title = 'Sample: Best of Belgrade';   -- its list_items go with it
delete from public.dishes where 'sample' = any (tags);
delete from public.places p
 where p.provider = 'sample'
   and not exists (select 1 from public.dishes d where d.place_id = p.id);
