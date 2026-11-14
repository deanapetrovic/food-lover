-- M4: search + filters over the signed-in user's dishes.
--
-- SECURITY INVOKER on purpose: row level security still applies, so a user only ever
-- searches their own dishes. Matching is accent- and case-insensitive ("cevapi" finds
-- "Ćevapi") and every word you type must match somewhere in the dish name, note, tags,
-- place name, city or cuisine. LIKE wildcards in the query are escaped, so "%" matches
-- nothing special. This is a scan per user, which is fine at personal scale (thousands
-- of dishes); the trigram indexes from M1 are there if it ever needs to be faster.

create function public.search_dishes(
  p_q          text default null,
  p_min_rating integer default null,
  p_city       text default null,
  p_status     public.dish_status default null,
  p_sort       text default null          -- 'best' = highest rated first; otherwise newest first
)
returns table (
  id            uuid,
  name          text,
  rating        smallint,
  note          text,
  tags          text[],
  photo_path    text,
  eaten_at      timestamptz,
  status        public.dish_status,
  source_url    text,
  place_id      uuid,
  place_name    text,
  place_city    text,
  place_cuisine text,
  place_lat     double precision,
  place_lng     double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.name, d.rating, d.note, d.tags, d.photo_path, d.eaten_at, d.status, d.source_url,
         d.place_id, p.name, p.city, p.cuisine, p.lat, p.lng
  from public.dishes d
  left join public.places p on p.id = d.place_id
  cross join lateral (
    select public.immutable_unaccent(lower(concat_ws(' ',
             d.name, d.note, array_to_string(d.tags, ' '), p.name, p.city, p.cuisine))) as hay
  ) h
  cross join lateral (
    -- "#grill" and "grill" are the same word; escape \ % _ so they are matched literally
    select coalesce(array_agg(regexp_replace(t, '([\\%_])', '\\\1', 'g')), '{}'::text[]) as words
    from (
      select regexp_replace(w, '^#+', '') as t
      from regexp_split_to_table(public.immutable_unaccent(lower(coalesce(p_q, ''))), '\s+') as w
    ) s
    where t <> ''
  ) q
  where (p_status is null or d.status = p_status)
    and (p_min_rating is null or d.rating >= p_min_rating)
    and (coalesce(p_city, '') = ''
         or public.immutable_unaccent(lower(p.city)) = public.immutable_unaccent(lower(p_city)))
    and not exists (select 1 from unnest(q.words) w where h.hay not like '%' || w || '%')
  order by case when p_sort = 'best' then d.rating end desc nulls last,
           d.eaten_at desc,
           d.id
$$;

-- The user's cities, most-used first, for the city filter.
create function public.list_my_cities()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select p.city
  from public.dishes d
  join public.places p on p.id = d.place_id
  where coalesce(p.city, '') <> ''
  group by p.city
  order by count(*) desc, p.city
  limit 30
$$;

revoke all on function public.search_dishes(text, integer, text, public.dish_status, text) from public, anon;
revoke all on function public.list_my_cities() from public, anon;
grant execute on function public.search_dishes(text, integer, text, public.dish_status, text) to authenticated;
grant execute on function public.list_my_cities() to authenticated;
