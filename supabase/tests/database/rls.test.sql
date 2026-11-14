-- RLS + constraint tests. Run with `supabase test db`.
-- Everything happens inside a transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Two fake users. The on_auth_user_created trigger creates their profiles.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local');

select is(
  (select count(*) from public.profiles
    where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'))::int,
  2, 'a profile is created automatically for each new user');

-- =============================================================== user A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok(
  $$ select public.upsert_place('google', 'g-1', 'Ćevap Test', 'Addr 1', 'Belgrade', 'RS', 44.8, 20.4, 'balkan') $$,
  'signed-in user can create a provider place via upsert_place');

select lives_ok(
  $$ select public.upsert_place('manual', null, 'A secret spot') $$,
  'signed-in user can create a manual place');

select lives_ok(
  $$ insert into public.dishes (name, place_id, rating, tags)
     values ('Ćevapi', (select id from public.places where external_place_id = 'g-1'), 9, '{grill}') $$,
  'user can log a tried dish (user_id defaults to auth.uid())');

select lives_ok(
  $$ insert into public.dishes (name, status) values ('Pljeskavica', 'want_to_try') $$,
  'user can save a want-to-try dish with no place or rating');

select throws_ok(
  $$ insert into public.dishes (name, place_id, status)
     values ('No rating', (select id from public.places where external_place_id = 'g-1'), 'tried') $$,
  '23514', null, 'a tried dish without a rating is rejected');

select throws_ok(
  $$ insert into public.dishes (name, place_id, rating)
     values ('Too good', (select id from public.places where external_place_id = 'g-1'), 11) $$,
  '23514', null, 'rating above 10 is rejected');

select throws_ok(
  $$ insert into public.dishes (name, place_id, rating, photo_path)
     values ('Stolen photo', (select id from public.places where external_place_id = 'g-1'), 5,
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg') $$,
  '23514', null, 'a dish cannot point at a photo in another user''s folder');

select throws_ok(
  $$ insert into public.dishes (user_id, name, status)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Impersonation', 'want_to_try') $$,
  '42501', null, 'user cannot create a dish owned by someone else');

select is((select count(*) from public.dishes)::int, 2, 'user A sees their 2 dishes');
select is((select count(*) from public.places)::int, 2, 'user A sees the google place and their manual place');

-- Shared links must be http(s): the app renders them as clickable hrefs.
select lives_ok(
  $$ update public.dishes set source_url = 'https://www.instagram.com/p/abc' where name = 'Pljeskavica' $$,
  'a want-to-try can carry an https source link');
select throws_ok(
  $$ update public.dishes set source_url = 'javascript:alert(1)' where name = 'Pljeskavica' $$,
  '23514', null, 'a javascript: source link is rejected');
select throws_ok(
  $$ update public.dishes set source_url = 'data:text/html,hi' where name = 'Pljeskavica' $$,
  '23514', null, 'a data: source link is rejected');

-- Marking as tried converts the same row and then enforces place + rating.
select throws_ok(
  $$ update public.dishes set status = 'tried' where name = 'Pljeskavica' $$,
  '23514', null, 'a want-to-try cannot become tried without a place and rating');
select lives_ok(
  $$ update public.dishes
        set status = 'tried', rating = 8,
            place_id = (select id from public.places where external_place_id = 'g-1')
      where name = 'Pljeskavica' $$,
  'a want-to-try becomes tried once it has a place and rating');
select is((select count(*) from public.dishes where name = 'Pljeskavica')::int, 1,
  'marking as tried keeps a single row');

select lives_ok(
  $$ insert into public.lists (title) values ('Best grill') $$,
  'user can create a list');
select is((select share_slug from public.lists where title = 'Best grill'), null,
  'a private list has no share slug');

select lives_ok(
  $$ update public.lists set is_public = true where title = 'Best grill' $$,
  'user can make a list public');
select is(length((select share_slug from public.lists where title = 'Best grill')), 12,
  'a public list gets a 12-char slug');

select lives_ok(
  $$ insert into public.list_items (list_id, dish_id, position)
     select l.id, d.id, 1 from public.lists l, public.dishes d
      where l.title = 'Best grill' and d.name = 'Ćevapi' $$,
  'user can add their own dish to their own list');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('dish-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a.jpg') $$,
  'user can upload a photo into their own folder');

-- Stash ids for the other users' attempts.
select set_config('t.slug',    (select share_slug from public.lists where title = 'Best grill'), true);
select set_config('t.list_id', (select id::text   from public.lists  where title = 'Best grill'), true);
select set_config('t.dish_id', (select id::text   from public.dishes where name  = 'Ćevapi'), true);

-- =============================================================== user B
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.dishes)::int,     0, 'user B cannot see A''s dishes');
select is((select count(*) from public.lists)::int,      0, 'user B cannot see A''s lists');
select is((select count(*) from public.list_items)::int, 0, 'user B cannot see A''s list items');
select is((select count(*) from public.places)::int,     1, 'user B sees the shared google place but not A''s manual place');

select throws_ok(
  $$ insert into public.list_items (list_id, dish_id)
     values (current_setting('t.list_id')::uuid, current_setting('t.dish_id')::uuid) $$,
  '42501', null, 'user B cannot add items to A''s list');

select lives_ok(
  $$ update public.dishes set name = 'hacked' where id = current_setting('t.dish_id')::uuid $$,
  'B''s update of A''s dish is silently a no-op');
select lives_ok(
  $$ delete from public.dishes where id = current_setting('t.dish_id')::uuid $$,
  'B''s delete of A''s dish is silently a no-op');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('dish-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/evil.jpg') $$,
  '42501', null, 'user B cannot upload into A''s photo folder');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('dish-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/b.jpg') $$,
  'user B can upload into their own folder');
select is((select count(*) from storage.objects where bucket_id = 'dish-photos')::int, 1,
  'user B only sees their own photo');

-- ============================================================ user A again
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select name from public.dishes where id = current_setting('t.dish_id')::uuid), 'Ćevapi',
  'A''s dish was not changed by B');
select is((select count(*) from public.dishes)::int, 2, 'A''s dishes were not deleted by B');

-- ================================================================= signed out
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from public.dishes $$,     '42501', null, 'anon cannot read dishes');
select throws_ok($$ select * from public.lists $$,      '42501', null, 'anon cannot read lists');
select throws_ok($$ select * from public.places $$,     '42501', null, 'anon cannot read places');
select throws_ok($$ select * from public.list_items $$, '42501', null, 'anon cannot read list items');
select throws_ok(
  $$ select public.upsert_place('google', 'g-2', 'Anon place') $$,
  '42501', null, 'anon cannot call upsert_place');
select is((select count(*) from storage.objects where bucket_id = 'dish-photos')::int, 0,
  'anon cannot see dish photos');

select is(public.get_public_list(current_setting('t.slug'))->>'title', 'Best grill',
  'anon can read a public list through get_public_list');
select is(jsonb_array_length(public.get_public_list(current_setting('t.slug'))->'items'), 1,
  'the public list contains its item');
select is(public.get_public_list(current_setting('t.slug'))->'items'->0->>'name', 'Ćevapi',
  'the public list item has the dish name');
select is(public.get_public_list(current_setting('t.slug'))::text like '%user_id%', false,
  'the public list payload does not expose user ids');
select is(public.get_public_list('does-not-exist'), null::jsonb,
  'an unknown slug returns null');

-- ====================================================== A makes list private
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$ update public.lists set is_public = false where title = 'Best grill' $$,
  'user can make a list private again');
select is((select share_slug from public.lists where title = 'Best grill'), null,
  'the slug is cleared when the list goes private');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.get_public_list(current_setting('t.slug')), null::jsonb,
  'the old link stops working once the list is private');

reset role;
select * from finish();
rollback;
