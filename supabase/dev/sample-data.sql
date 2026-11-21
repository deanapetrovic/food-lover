-- DEV ONLY: sample restaurants + dishes so the map, search and place pages have something to show.
-- All names are made up; coordinates are real neighbourhoods. Everything is tagged 'sample' (dishes)
-- or provider 'sample' (places) so remove-sample-data.sql can delete exactly this and nothing else.
--
-- Run it in the Supabase SQL editor (or via the CLI) AFTER signing up. Replace the email below with
-- the email you sign in with. Safe to re-run: it replaces the previous sample dishes.

delete from public.dishes where 'sample' = any (tags);

insert into public.places (provider, external_place_id, name, address, city, country, lat, lng, cuisine)
values
  ('sample', 's01', 'Ćevabdžinica Kod Mikija', 'Skadarska 14',            'Belgrade', 'RS', 44.8185, 20.4670, 'Balkan grill'),
  ('sample', 's02', 'Pekara Zlatno Zrno',      'Knez Mihailova 31',       'Belgrade', 'RS', 44.8176, 20.4569, 'Bakery'),
  ('sample', 's03', 'Kafana Stara Čaršija',    'Cara Dušana 40',          'Belgrade', 'RS', 44.8240, 20.4640, 'Serbian'),
  ('sample', 's04', 'Burger Bunker',           'Karađorđeva 55',          'Belgrade', 'RS', 44.8120, 20.4510, 'Burgers'),
  ('sample', 's05', 'Sushi Sava',              'Bulevar Mihaila Pupina 10','Belgrade', 'RS', 44.8140, 20.4210, 'Japanese'),
  ('sample', 's06', 'Pizzeria Napoli Nova',    'Njegoševa 20',            'Belgrade', 'RS', 44.7983, 20.4685, 'Italian'),
  ('sample', 's07', 'Slatki Kutak',            'Beogradska 5',            'Belgrade', 'RS', 44.8020, 20.4660, 'Desserts'),
  ('sample', 's08', 'Dunavski Dvor',           'Kej Oslobođenja 12',      'Belgrade', 'RS', 44.8450, 20.4120, 'Seafood'),
  ('sample', 's09', 'Green Corner',            'Hrama 3',                 'Belgrade', 'RS', 44.7960, 20.4690, 'Vegan'),
  ('sample', 's10', 'Gyros Point',             'Bulevar Oslobođenja 2',   'Belgrade', 'RS', 44.8035, 20.4650, 'Greek'),
  ('sample', 's11', 'Ramen Lab',               'Dobračina 8',             'Belgrade', 'RS', 44.8255, 20.4655, 'Ramen'),
  ('sample', 's12', 'Roštilj Kod Brke',        'Žikice Jovanovića 7',     'Belgrade', 'RS', 44.7820, 20.4150, 'Grill'),
  ('sample', 's13', 'Brunch Atelier',          'Vojvode Stepe 100',       'Belgrade', 'RS', 44.7840, 20.4840, 'Brunch'),
  ('sample', 's14', 'Kafana Fruškogorska',     'Zmaj Jovina 15',          'Novi Sad', 'RS', 45.2551, 19.8452, 'Serbian'),
  ('sample', 's15', 'Tacos Petrovaradin',      'Beogradska 20',           'Novi Sad', 'RS', 45.2520, 19.8650, 'Mexican'),
  ('sample', 's16', 'Burek Majstor',           'Obrenovićeva 4',          'Niš',      'RS', 43.3209, 21.8958, 'Bakery'),
  ('sample', 's17', 'Kafana Bez Koordinata',   null,                      'Belgrade', 'RS', null,    null,    'Serbian'),  -- no coordinates: tests the "not on the map" note
  ('sample', 's18', 'Vinoteka Dva Brata',      'Obilićev venac 6',        'Belgrade', 'RS', 44.8150, 20.4590, 'Wine bar')   -- want-to-try only: tests the outlined pin
on conflict (provider, external_place_id) do nothing;

insert into public.dishes (user_id, place_id, name, rating, note, tags, eaten_at, status)
select u.id, pl.id, d.name, d.rating::smallint, d.note, d.tags, now() - make_interval(days => d.days), d.status::public.dish_status
from (values
  -- ext   name                         rating note                                  tags                                 days status
  ('s01', 'Ćevapi, 10 pcs',               10,  'Smoky, kajmak on the side',           array['grill','lunch','sample'],         2, 'tried'),
  ('s01', 'Pljeskavica',                   8,  null,                                  array['grill','sample'],                30, 'tried'),
  ('s02', 'Burek sa sirom',                9,  'Crispy, still warm at 7am',           array['bakery','breakfast','sample'],    5, 'tried'),
  ('s02', 'Krofna',                        6,  null,                                  array['sweet','sample'],                40, 'tried'),
  ('s02', 'Kiflice',                    null,  'Heard they sell out by 9',            array['bakery','sample'],                1, 'want_to_try'),
  ('s03', 'Sarma',                         8,  'Like grandma makes it',               array['comfort','sample'],              12, 'tried'),
  ('s03', 'Gibanica',                      7,  null,                                  array['sample'],                        12, 'tried'),
  ('s03', 'Teleća čorba',                  4,  'Too salty',                           array['soup','sample'],                 60, 'tried'),
  ('s04', 'Smash burger',                  7,  'Good crust, fries soggy',             array['burger','sample'],                8, 'tried'),
  ('s04', 'Truffle fries',                 3,  'Greasy, skip',                        array['sample'],                         8, 'tried'),
  ('s05', 'Salmon nigiri set',             9,  'Fresh and generous',                  array['sushi','dinner','sample'],       15, 'tried'),
  ('s05', 'Spicy tuna roll',               6,  null,                                  array['sushi','sample'],                15, 'tried'),
  ('s05', 'Omakase',                    null,  'Birthday idea',                       array['sushi','sample'],                 3, 'want_to_try'),
  ('s06', 'Margherita',                    8,  'Proper chewy crust',                  array['pizza','sample'],                20, 'tried'),
  ('s06', 'Tiramisu',                      7,  null,                                  array['dessert','sample'],              20, 'tried'),
  ('s07', 'Palačinke sa plazmom',          9,  'The classic',                         array['dessert','sample'],                4, 'tried'),
  ('s07', 'Waffle',                        5,  null,                                  array['dessert','sample'],              70, 'tried'),
  ('s08', 'Riblja čorba',                  9,  'Best on the quay',                    array['fish','soup','sample'],          25, 'tried'),
  ('s08', 'Grilled sea bass',              8,  null,                                  array['fish','sample'],                 25, 'tried'),
  ('s08', 'Fish platter for two',       null,  null,                                  array['fish','sample'],                  6, 'want_to_try'),
  ('s09', 'Buddha bowl',                   6,  null,                                  array['vegan','sample'],                18, 'tried'),
  ('s10', 'Gyros wrap',                    7,  'Fast and filling',                    array['greek','lunch','sample'],         6, 'tried'),
  ('s11', 'Tonkotsu ramen',               10,  'Rich broth, perfect egg',             array['ramen','sample'],                 9, 'tried'),
  ('s11', 'Shoyu ramen',                null,  null,                                  array['ramen','sample'],                 2, 'want_to_try'),
  ('s12', 'Mešano meso',                   8,  'Huge portion',                        array['grill','sample'],                45, 'tried'),
  ('s13', 'Eggs Benedict',                 5,  null,                                  array['brunch','sample'],               33, 'tried'),
  ('s14', 'Punjena paprika',               7,  null,                                  array['sample'],                        50, 'tried'),
  ('s14', 'Kačamak',                    null,  null,                                  array['sample'],                         7, 'want_to_try'),
  ('s15', 'Al pastor tacos',               4,  'Dry meat',                            array['tacos','sample'],                 55, 'tried'),
  ('s16', 'Burek sa mesom',                8,  'Worth the detour',                    array['bakery','sample'],                90, 'tried'),
  ('s17', 'Mystery stew',                  6,  null,                                  array['sample'],                       100, 'tried'),
  ('s18', 'Cheese board',               null,  'Friend recommended',                  array['wine','sample'],                  1, 'want_to_try')
) as d(ext, name, rating, note, tags, days, status)
join public.places pl on pl.provider = 'sample' and pl.external_place_id = d.ext
cross join (select id from auth.users where email = 'you@example.com') u;  -- <- your sign-in email

-- A public sample list (top-rated dishes with photos) to try the share link and the public page.
delete from public.lists where title = 'Sample: Best of Belgrade';
with l as (
  insert into public.lists (user_id, title, description, is_public)
  select id, 'Sample: Best of Belgrade', 'A made-up list to test sharing. Delete it any time.', true
  from auth.users where email = 'you@example.com'              -- <- your sign-in email
  returning id
), top as (
  select d.id, row_number() over (order by d.rating desc, d.name) - 1 as pos
  from public.dishes d
  where 'sample' = any (d.tags) and d.status = 'tried' and d.rating >= 9
)
insert into public.list_items (list_id, dish_id, position)
select l.id, top.id, top.pos from l, top;
-- Its link is  <your-site>/l/<share_slug>:  select share_slug from public.lists where title = 'Sample: Best of Belgrade';
