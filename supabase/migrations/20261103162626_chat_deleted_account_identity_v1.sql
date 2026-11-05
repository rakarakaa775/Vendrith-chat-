-- Preserve shared conversation history while removing a deleted player's public identity.
-- The profile UUID becomes an internal tombstone key, not an Auth foreign key.

alter table public.chat_profiles
  drop constraint if exists chat_profiles_user_id_fkey;

alter table public.chat_profiles
  add column if not exists deleted_at timestamptz;

comment on column public.chat_profiles.deleted_at is
  'When set, this row is an internal tombstone used only to render shared historical messages as Deleted account.';

comment on table public.chat_profiles is
  'Chat profile directory. Deleted accounts retain a non-discoverable pseudonymous tombstone so shared messages keep a stable author reference.';

create or replace function chat_private.get_conversation_profiles(p_conversation_ids uuid[])
returns table(
  conversation_id uuid,
  user_id uuid,
  username text,
  display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if coalesce(cardinality(p_conversation_ids), 0) > 100 then
    raise exception using errcode = '22023', message = 'too_many_conversations';
  end if;

  return query
  select member_row.conversation_id,
         member_row.user_id,
         case when profile.deleted_at is not null then null else profile.username end,
         case when profile.deleted_at is not null then 'Deleted account'
              else coalesce(profile.display_name, 'Vendrith Player') end
  from public.chat_members member_row
  left join public.chat_profiles profile on profile.user_id = member_row.user_id
  where member_row.conversation_id = any(coalesce(p_conversation_ids, '{}'::uuid[]))
    and exists (
      select 1 from public.chat_members caller_membership
      where caller_membership.conversation_id = member_row.conversation_id
        and caller_membership.user_id = v_user_id
    );
end;
$$;

create or replace function public.chat_get_conversation_profiles(p_conversation_ids uuid[])
returns table(
  conversation_id uuid,
  user_id uuid,
  username text,
  display_name text
)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.get_conversation_profiles(p_conversation_ids);
$$;

revoke all on function chat_private.get_conversation_profiles(uuid[]) from public, anon;
grant execute on function chat_private.get_conversation_profiles(uuid[]) to authenticated;
revoke all on function public.chat_get_conversation_profiles(uuid[]) from public, anon;
grant execute on function public.chat_get_conversation_profiles(uuid[]) to authenticated;

comment on function public.chat_get_conversation_profiles(uuid[]) is
  'Returns current member profile labels; deleted accounts are represented as Deleted account without public profile fields.';
