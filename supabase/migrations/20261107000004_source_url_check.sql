-- M3: shared links are only ever http(s), so a saved link can never be a
-- javascript:/data: URL that the app might render as a clickable href.
alter table public.dishes
  add constraint dishes_source_url_http
  check (source_url is null or (source_url ~* '^https?://' and char_length(source_url) <= 2000));
