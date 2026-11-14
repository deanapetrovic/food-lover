-- M1 / 2: row level security, place writes, public list RPC.

alter table public.profiles   enable row level security;
alter table public.places     enable row level security;
alter table public.dishes     enable row level security;
alter table public.lists      enable row level security;
alter table public.list_items enable row level security;

-- Defense in depth: signed-out visitors get no direct table access at all.
-- Public lists are served only through get_public_list().
revoke all on public.profiles, public.places, public.dishes,
              public.lists, public.list_items from anon;

-- ------------------------------------------------------------ profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Rows are created by the on_auth_user_created trigger; no insert/delete policy.

-- -------------------------------------------------------------- places
-- Readable by any signed-in user, except other people's manual places.
-- No write policies: all writes go through upsert_place().
create policy places_select on public.places
  for select to authenticated
  using (provider <> 'manual' or created_by = (select auth.uid()));

-- -------------------------------------------------------------- dishes
create policy dishes_owner_all on public.dishes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --------------------------------------------------------------- lists
create policy lists_owner_all on public.lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------- list_items
-- Access is decided by the parent list; the dish must also be the owner's.
create policy list_items_owner_all on public.list_items
  for all to authenticated
  using (
    exists (select 1 from public.lists l
            where l.id = list_items.list_id and l.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.lists l
            where l.id = list_items.list_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.dishes d
                where d.id = list_items.dish_id and d.user_id = (select auth.uid()))
  );

-- ------------------------------------------------------- upsert_place()
-- The only way to create places. Provider places are de-duplicated on
-- (provider, external_place_id); an existing row is never renamed and only
-- gets its empty fields filled, so one user can't rewrite a shared place.
create function public.upsert_place(
  p_provider          text,
  p_external_place_id text,
  p_name              text,
  p_address           text default null,
  p_city              text default null,
  p_country           text default null,
  p_lat               double precision default null,
  p_lng               double precision default null,
  p_cuisine           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_provider = 'manual' then
    insert into public.places (provider, external_place_id, name, address, city,
                               country, lat, lng, cuisine, created_by)
    values ('manual', null, p_name, p_address, p_city, p_country, p_lat, p_lng,
            p_cuisine, v_uid)
    returning id into v_id;
  else
    insert into public.places as pl (provider, external_place_id, name, address,
                                     city, country, lat, lng, cuisine)
    values (p_provider, p_external_place_id, p_name, p_address, p_city,
            p_country, p_lat, p_lng, p_cuisine)
    on conflict (provider, external_place_id) do update set
      address = coalesce(pl.address, excluded.address),
      city    = coalesce(pl.city,    excluded.city),
      country = coalesce(pl.country, excluded.country),
      lat     = coalesce(pl.lat,     excluded.lat),
      lng     = coalesce(pl.lng,     excluded.lng),
      cuisine = coalesce(pl.cuisine, excluded.cuisine)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.upsert_place(text, text, text, text, text, text,
  double precision, double precision, text) from public, anon;
grant execute on function public.upsert_place(text, text, text, text, text, text,
  double precision, double precision, text) to authenticated;

-- ---------------------------------------------------- get_public_list()
-- Read-only, anonymous-safe view of one public list. Returns null when the
-- slug is unknown or the list is private. Exposes no user ids or emails.
create function public.get_public_list(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',          l.id,
    'title',       l.title,
    'description', l.description,
    'updated_at',  l.updated_at,
    'owner',       jsonb_build_object('display_name', pr.display_name),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'dish_id',    d.id,
          'position',   li.position,
          'name',       d.name,
          'rating',     d.rating,
          'note',       d.note,
          'tags',       d.tags,
          'photo_path', d.photo_path,
          'eaten_at',   d.eaten_at,
          'place', case when p.id is null then null else jsonb_build_object(
            'id', p.id, 'name', p.name, 'address', p.address, 'city', p.city,
            'lat', p.lat, 'lng', p.lng, 'cuisine', p.cuisine) end
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
  join public.profiles pr on pr.id = l.user_id
  where l.is_public and l.share_slug = p_slug;
$$;

revoke all on function public.get_public_list(text) from public;
grant execute on function public.get_public_list(text) to anon, authenticated;
