-- pgTAP tests for the Milestone 1 schema. Run with: npx supabase test db
-- (needs the local stack: Docker + `npx supabase start`).
begin;
select plan(28);

-- Two users. The trigger on auth.users should create their profiles.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com');

select is((select count(*) from public.profiles), 2::bigint, 'profiles are created for new auth users');

-- Fixtures as the table owner (bypasses RLS).
insert into public.places (id, provider, external_place_id, name, city)
values ('11111111-1111-1111-1111-111111111111', 'google', 'g-1', 'Ćevapi Place', 'Belgrade');
insert into public.places (id, provider, name, city, created_by)
values ('22222222-2222-2222-2222-222222222222', 'manual', 'A''s Secret Spot', 'Belgrade', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.dishes (id, user_id, place_id, name, rating)
values ('d1d1d1d1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111', 'Ćevapi 10', 9);
insert into public.lists (id, user_id, title)
values ('51515151-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A private list');
insert into public.list_items (list_id, dish_id, position)
values ('51515151-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-000000000001', 0);

-- ------------------------------------------------------------------ anon
set local role anon;
select throws_ok($$select * from public.dishes$$, '42501', null, 'anon cannot read dishes');
select throws_ok($$select * from public.lists$$, '42501', null, 'anon cannot read lists');
select throws_ok($$select * from public.places$$, '42501', null, 'anon cannot read places');
select throws_ok(
  $$select public.upsert_place('google', 'g-x', 'Nope')$$, '42501', null,
  'anon cannot call upsert_place'
);
select is(public.get_public_list('does-not-exist'), null, 'unknown slug returns null for anon');
reset role;

-- ----------------------------------------------------------------- user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is((select count(*) from public.dishes), 1::bigint, 'A sees their own dish');
select is((select count(*) from public.places), 2::bigint, 'A sees the google place and their manual place');

select lives_ok(
  $$insert into public.dishes (place_id, name, rating, photo_path)
    values ('11111111-1111-1111-1111-111111111111', 'Pljeskavica', 7,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/pic.jpg')$$,
  'A can log a dish with a photo in their own folder'
);
select throws_ok(
  $$insert into public.dishes (place_id, name, rating)
    values ('11111111-1111-1111-1111-111111111111', 'No rating but tried', null)$$,
  '23514', null, 'a tried dish requires a rating'
);
select throws_ok(
  $$insert into public.dishes (name, rating) values ('No place but tried', 5)$$,
  '23514', null, 'a tried dish requires a place'
);
select lives_ok(
  $$insert into public.dishes (name, status, source_url)
    values ('Pistachio croissant', 'want_to_try', 'https://example.com/post')$$,
  'a want-to-try dish needs neither rating nor place'
);
select throws_ok(
  $$insert into public.dishes (place_id, name, rating, photo_path)
    values ('11111111-1111-1111-1111-111111111111', 'Sneaky', 5,
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/pic.jpg')$$,
  '23514', null, 'photo_path must be in the owner''s own folder'
);
select throws_ok(
  $$insert into public.dishes (user_id, place_id, name, rating)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'As B', 5)$$,
  '42501', null, 'A cannot insert a dish owned by B'
);
select throws_ok(
  $$insert into public.places (provider, name) values ('manual', 'Direct insert')$$,
  '42501', null, 'places cannot be inserted directly'
);

-- upsert_place: idempotent for google, new row for manual
select is(
  (public.upsert_place('google', 'g-1', 'Renamed By Client')).id,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'upsert_place returns the existing google place'
);
select is(
  (select name from public.places where id = '11111111-1111-1111-1111-111111111111'),
  'Ćevapi Place',
  'upsert_place does not overwrite an existing google place'
);

-- Lists: slug is server-controlled
update public.lists set is_public = true, share_slug = 'chosen-by-client'
where id = '51515151-0000-0000-0000-000000000001';
select isnt(
  (select share_slug from public.lists where id = '51515151-0000-0000-0000-000000000001'),
  'chosen-by-client',
  'clients cannot choose their own share_slug'
);
select is(
  (select char_length(share_slug) from public.lists where id = '51515151-0000-0000-0000-000000000001'),
  12,
  'publishing generates a 12-char slug'
);

-- Save the slug for the anon check below, then go back to the owner role.
reset role;
create temp table t_slug as
  select share_slug from public.lists where id = '51515151-0000-0000-0000-000000000001';
grant select on t_slug to anon, authenticated;

-- ----------------------------------------------------------------- user B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.dishes), 0::bigint, 'B cannot see A''s dishes');
select is((select count(*) from public.lists), 0::bigint, 'B cannot see A''s lists');
select is((select count(*) from public.places), 1::bigint, 'B sees the google place but not A''s manual place');
select is((select count(*) from public.list_items), 0::bigint, 'B cannot see A''s list items');

with u as (
  update public.dishes set name = 'hacked' where id = 'd1d1d1d1-0000-0000-0000-000000000001' returning 1
)
select is((select count(*) from u), 0::bigint, 'B cannot update A''s dish');

with d as (
  delete from public.dishes where id = 'd1d1d1d1-0000-0000-0000-000000000001' returning 1
)
select is((select count(*) from d), 0::bigint, 'B cannot delete A''s dish');

-- B's own list cannot contain A's dish.
insert into public.lists (id, title) values ('52525252-0000-0000-0000-000000000002', 'B list');
select throws_ok(
  $$insert into public.list_items (list_id, dish_id)
    values ('52525252-0000-0000-0000-000000000002', 'd1d1d1d1-0000-0000-0000-000000000001')$$,
  '42501', null, 'B cannot put A''s dish into B''s list'
);
reset role;

-- ------------------------------------------------------------ public list
set local role anon;
select is(
  (public.get_public_list((select share_slug from t_slug))) ->> 'title',
  'A private list',
  'anon can read a public list through the RPC'
);
select ok(
  (public.get_public_list((select share_slug from t_slug)))::text !~ 'user_id|aaaaaaaa-aaaa',
  'the public payload does not leak user ids'
);
reset role;

select * from finish();
rollback;
