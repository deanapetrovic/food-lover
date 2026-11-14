-- Local development seed. Runs on `supabase db reset`.
-- Only shared Google-style places are seeded; dishes belong to users, who sign up after the reset.
insert into public.places (provider, external_place_id, name, address, city, country, lat, lng, cuisine)
values
  ('google', 'seed-cevapi-1', 'Ćevabdžinica Zlatni Ćevap', 'Knez Mihailova 10', 'Belgrade', 'RS', 44.8176, 20.4569, 'Balkan'),
  ('google', 'seed-burger-1', 'Burger Joint Dorćol', 'Cara Dušana 20', 'Belgrade', 'RS', 44.8225, 20.4650, 'Burgers'),
  ('google', 'seed-bakery-1', 'Pekara Pistacchio', 'Skadarska 5', 'Belgrade', 'RS', 44.8167, 20.4620, 'Bakery')
on conflict (provider, external_place_id) do nothing;
