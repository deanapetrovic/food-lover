-- M7: shared lists show the owner's display name ("by …") to anyone with the link, so it must never be
-- derived from the email address (the part before the @ is personal data).
--
-- 1. New profiles only get a name when the sign-in provider supplies one (e.g. Google's full name);
--    email/password sign-ups start with no name. People can set one before sharing.
-- 2. Existing profiles whose name was auto-generated from their email are cleared.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles p
   set display_name = null
  from auth.users u
 where u.id = p.id
   and p.display_name = split_part(u.email, '@', 1);
