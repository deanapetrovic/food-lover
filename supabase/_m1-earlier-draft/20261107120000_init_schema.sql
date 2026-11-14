-- Milestone 1: data model, RLS, storage policies, public-list RPC.
-- Everything is private by default. anon gets no table access at all;
-- public lists are readable only through get_public_list(slug).

-- ---------------------------------------------------------------- extensions
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() is not IMMUTABLE, so wrap it to make it usable in indexes.
-- Folds diacritics so "cevapi" matches "ćevapi".
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- --------------------------------------------------------------------- enums
create type public.dish_status as enum ('tried', 'want_to_try');
-- 'friends' and 'public' are unused in the MVP; they exist so a social feed can be added later.
create type public.visibility as enum ('private', 'friends', 'public');

-- ------------------------------------------------------------ shared trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  handle text unique check (handle is null or handle ~ '^[a-z0-9_]{3,30}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------- places
-- Global cache of places. Google places are shared by everyone; manual places
-- are visible only to their creator (see RLS below).
create table public.places (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'manual')),
  external_place_id text,
  name text not null check (char_length(name) between 1 and 200),
  address text,
  city text,
  country text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  cuisine text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_place_id),
  check (provider = 'manual' or external_place_id is not null)
);
create index places_city_idx on public.places (city);
create index places_name_trgm_idx on public.places
  using gin (lower(public.immutable_unaccent(name)) extensions.gin_trgm_ops);
create trigger places_updated_at before update on public.places
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- dishes
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id uuid references public.places (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 200),
  rating smallint check (rating between 1 and 10),
  note text check (note is null or char_length(note) <= 500),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  photo_path text,
  eaten_at timestamptz default now(),
  status public.dish_status not null default 'tried',
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A logged (tried) dish needs a rating and a place; a want-to-try item may lack both.
  constraint dishes_tried_needs_rating check (status = 'want_to_try' or rating is not null),
  constraint dishes_tried_needs_place check (status = 'want_to_try' or place_id is not null),
  -- Photos live under the owner's folder in the storage bucket.
  constraint dishes_photo_in_own_folder check (photo_path is null or photo_path like user_id::text || '/%')
);
create index dishes_user_status_rating_idx on public.dishes (user_id, status, rating desc);
create index dishes_user_place_idx on public.dishes (user_id, place_id);
create index dishes_user_eaten_idx on public.dishes (user_id, eaten_at desc);
create index dishes_tags_idx on public.dishes using gin (tags);
create index dishes_name_trgm_idx on public.dishes
  using gin (lower(public.immutable_unaccent(name)) extensions.gin_trgm_ops);
create trigger dishes_updated_at before update on public.dishes
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------- lists
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_public_needs_slug check (not is_public or share_slug is not null)
);
create index lists_user_idx on public.lists (user_id);
create trigger lists_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

-- The slug is server-controlled: clients cannot choose or change it.
-- It is generated the first time a list is made public and kept afterwards,
-- so unpublishing and republishing yields the same link.
create or replace function public.lists_manage_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.share_slug := null;
  else
    new.share_slug := old.share_slug;
  end if;
  if new.is_public and new.share_slug is null then
    new.share_slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  end if;
  return new;
end;
$$;
create trigger lists_manage_slug before insert or update on public.lists
  for each row execute function public.lists_manage_slug();

-- --------------------------------------------------------------- list_items
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, dish_id)
);
create index list_items_list_position_idx on public.list_items (list_id, position);
create index list_items_dish_idx on public.list_items (dish_id);

-- ---------------------------------------------------------------- privileges
-- anon never touches tables directly; authenticated is limited further by RLS.
revoke all on public.profiles, public.places, public.dishes, public.lists, public.list_items from anon;
revoke all on public.profiles, public.places, public.dishes, public.lists, public.list_items from public;
grant select, update on public.profiles to authenticated;
grant select on public.places to authenticated;
grant select, insert, update, delete on public.dishes, public.lists, public.list_items to authenticated;

-- ----------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.dishes enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Google places are public data; manual places belong to their creator.
-- No insert/update/delete policies: writes go through upsert_place() only.
create policy places_select on public.places
  for select to authenticated
  using (provider <> 'manual' or created_by = (select auth.uid()));

create policy dishes_owner_all on public.dishes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy lists_owner_all on public.lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- An item is accessible when its list is yours; adding one also requires the dish to be yours.
create policy list_items_owner_all on public.list_items
  for all to authenticated
  using (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id and l.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id and l.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.dishes d
      where d.id = list_items.dish_id and d.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------- upsert_place
-- The only write path into places for signed-in users.
-- Google places are inserted once and never overwritten by clients (first write wins),
-- so one user cannot alter what others see. Manual places are always new rows.
create or replace function public.upsert_place(
  p_provider text,
  p_external_place_id text,
  p_name text,
  p_address text default null,
  p_city text default null,
  p_country text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_cuisine text default null
)
returns public.places
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.places;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_provider = 'manual' then
    insert into public.places (provider, name, address, city, country, lat, lng, cuisine, created_by)
    values ('manual', p_name, p_address, p_city, p_country, p_lat, p_lng, p_cuisine, uid)
    returning * into result;
    return result;
  end if;

  if p_provider <> 'google' or p_external_place_id is null then
    raise exception 'invalid provider or missing external_place_id' using errcode = '22023';
  end if;

  insert into public.places (provider, external_place_id, name, address, city, country, lat, lng, cuisine, created_by)
  values ('google', p_external_place_id, p_name, p_address, p_city, p_country, p_lat, p_lng, p_cuisine, uid)
  on conflict (provider, external_place_id) do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.places
    where provider = 'google' and external_place_id = p_external_place_id;
  end if;
  return result;
end;
$$;
revoke all on function public.upsert_place(text, text, text, text, text, text, double precision, double precision, text) from public, anon;
grant execute on function public.upsert_place(text, text, text, text, text, text, double precision, double precision, text) to authenticated;

-- ------------------------------------------------------------ get_public_list
-- Read-only view of one public list for the share page. Returns only fields
-- that are safe to expose: no user ids, no source URLs. photo_path is included so
-- the server-side share page can sign photo URLs; the bucket itself stays private.
create or replace function public.get_public_list(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', l.title,
    'updated_at', l.updated_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', li.position,
          'dish', jsonb_build_object(
            'name', d.name,
            'rating', d.rating,
            'note', d.note,
            'tags', d.tags,
            'photo_path', d.photo_path
          ),
          'place', case when p.id is null then null else jsonb_build_object(
            'name', p.name,
            'address', p.address,
            'city', p.city,
            'cuisine', p.cuisine,
            'lat', p.lat,
            'lng', p.lng
          ) end
        )
        order by li.position, li.created_at
      )
      from public.list_items li
      join public.dishes d on d.id = li.dish_id
      left join public.places p on p.id = d.place_id
      where li.list_id = l.id
    ), '[]'::jsonb)
  )
  from public.lists l
  where l.share_slug = p_slug and l.is_public;
$$;
revoke all on function public.get_public_list(text) from public;
grant execute on function public.get_public_list(text) to anon, authenticated;

-- ------------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Objects live at {user_id}/{file}; users can only touch their own folder.
create policy dish_photos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy dish_photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy dish_photos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy dish_photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
