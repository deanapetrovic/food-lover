-- M1 / 1: core schema (tables, enums, indexes, triggers).
-- RLS, RPCs and storage live in the next migrations.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.dish_status as enum ('tried', 'want_to_try');
-- Hook for the future social feed. The MVP only ever writes 'private'.
create type public.dish_visibility as enum ('private', 'followers', 'public');

-- ------------------------------------------------------------ helpers
-- unaccent() is only STABLE; this wrapper lets us use it in indexes.
create function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------ profiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  handle       text unique check (handle ~ '^[a-z0-9_]{3,30}$'),  -- future social
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration existed.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------- places
-- Global cache of places. Written only through public.upsert_place().
create table public.places (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,              -- 'google' | 'manual' | ...
  external_place_id text,                       -- provider's id; null for manual
  name              text not null check (char_length(name) between 1 and 200),
  address           text,
  city              text,
  country           text,
  lat               double precision check (lat between -90 and 90),
  lng               double precision check (lng between -180 and 180),
  cuisine           text,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider, external_place_id),
  check (provider = 'manual' or external_place_id is not null),
  check (provider <> 'manual' or created_by is not null)
);

create index places_city_idx on public.places (city);
create index places_name_trgm_idx on public.places
  using gin (public.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);

create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- dishes
create table public.dishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id    uuid references public.places (id) on delete restrict,
  name        text not null check (char_length(name) between 1 and 200),
  rating      smallint check (rating between 1 and 10),
  note        text check (char_length(note) <= 4000),
  tags        text[] not null default '{}',
  photo_path  text,
  eaten_at    timestamptz not null default now(),
  status      public.dish_status not null default 'tried',
  source_url  text,
  visibility  public.dish_visibility not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- A tried dish needs a place and a rating; a want-to-try can be a bare idea.
  constraint dishes_tried_needs_place_and_rating
    check (status = 'want_to_try' or (place_id is not null and rating is not null)),
  -- Photos live under the owner's folder; stops pointing at someone else's file.
  constraint dishes_photo_in_own_folder
    check (photo_path is null or photo_path like user_id::text || '/%')
);

create index dishes_user_eaten_idx   on public.dishes (user_id, eaten_at desc);
create index dishes_user_status_idx  on public.dishes (user_id, status);
create index dishes_place_idx        on public.dishes (place_id);
create index dishes_tags_idx         on public.dishes using gin (tags);
create index dishes_name_trgm_idx    on public.dishes
  using gin (public.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);

create trigger dishes_touch before update on public.dishes
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------- lists
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  is_public   boolean not null default false,
  share_slug  text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index lists_user_idx on public.lists (user_id, updated_at desc);

-- share_slug exists only while the list is public.
create function public.lists_sync_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_public then
    if new.share_slug is null then
      -- 9 random bytes -> 12 url-safe chars
      new.share_slug := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=', '-_');
    end if;
  else
    new.share_slug := null;
  end if;
  return new;
end;
$$;

create trigger lists_sync_slug before insert or update on public.lists
  for each row execute function public.lists_sync_slug();

create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------- list_items
create table public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  dish_id    uuid not null references public.dishes (id) on delete cascade,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, dish_id)
);

create index list_items_list_pos_idx on public.list_items (list_id, position);
create index list_items_dish_idx     on public.list_items (dish_id);
