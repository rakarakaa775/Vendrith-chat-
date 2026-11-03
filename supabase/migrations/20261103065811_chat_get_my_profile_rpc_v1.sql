create or replace function chat_private.get_my_profile()
returns public.chat_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select profile.*
  from public.chat_profiles as profile
  where profile.user_id = (select auth.uid())
    and (select auth.uid()) is not null
  limit 1;
$$;

create or replace function public.chat_get_my_profile()
returns public.chat_profiles
language sql
stable
security invoker
set search_path = ''
as $$
  select chat_private.get_my_profile();
$$;

revoke all on function chat_private.get_my_profile() from public, anon;
grant execute on function chat_private.get_my_profile() to authenticated;

revoke all on function public.chat_get_my_profile() from public, anon;
grant execute on function public.chat_get_my_profile() to authenticated;

comment on function public.chat_get_my_profile() is
  'Returns only the authenticated player own Vendrith Chat profile.';
