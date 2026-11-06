-- Safe, authenticated directory reads for Vendrith Chat social features.
-- All returned profile fields are explicitly limited; no email or Auth metadata is exposed.

create or replace function chat_private.list_friends()
returns table(
  friend_user_id uuid,
  username text,
  display_name text,
  friends_since timestamptz
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

  return query
  select
    case when friendship.user_low = v_user_id then friendship.user_high else friendship.user_low end,
    profile.username,
    coalesce(profile.display_name, 'Vendrith Player'),
    friendship.created_at
  from public.chat_friendships friendship
  left join public.chat_profiles profile
    on profile.user_id = case
      when friendship.user_low = v_user_id then friendship.user_high
      else friendship.user_low
    end
  where friendship.user_low = v_user_id or friendship.user_high = v_user_id
  order by lower(coalesce(profile.display_name, 'Vendrith Player'));
end;
$$;

create or replace function public.chat_list_friends()
returns table(
  friend_user_id uuid,
  username text,
  display_name text,
  friends_since timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.list_friends();
$$;

create or replace function chat_private.list_friend_requests()
returns table(
  request_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  direction text,
  created_at timestamptz
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

  return query
  select
    request.id,
    case when request.sender_id = v_user_id then request.recipient_id else request.sender_id end,
    profile.username,
    coalesce(profile.display_name, 'Vendrith Player'),
    case when request.recipient_id = v_user_id then 'incoming' else 'outgoing' end,
    request.created_at
  from public.chat_friend_requests request
  left join public.chat_profiles profile
    on profile.user_id = case
      when request.sender_id = v_user_id then request.recipient_id
      else request.sender_id
    end
  where (request.sender_id = v_user_id or request.recipient_id = v_user_id)
    and request.status = 'pending'
  order by request.created_at desc;
end;
$$;

create or replace function public.chat_list_friend_requests()
returns table(
  request_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  direction text,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.list_friend_requests();
$$;

create or replace function chat_private.list_blocked_users()
returns table(
  blocked_user_id uuid,
  username text,
  display_name text,
  blocked_at timestamptz
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

  return query
  select
    block_row.blocked_id,
    profile.username,
    coalesce(profile.display_name, 'Vendrith Player'),
    block_row.created_at
  from public.chat_blocks block_row
  left join public.chat_profiles profile on profile.user_id = block_row.blocked_id
  where block_row.blocker_id = v_user_id
  order by block_row.created_at desc;
end;
$$;

create or replace function public.chat_list_blocked_users()
returns table(
  blocked_user_id uuid,
  username text,
  display_name text,
  blocked_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.list_blocked_users();
$$;

revoke all on function chat_private.list_friends() from public, anon;
revoke all on function chat_private.list_friend_requests() from public, anon;
revoke all on function chat_private.list_blocked_users() from public, anon;
grant execute on function chat_private.list_friends() to authenticated;
grant execute on function chat_private.list_friend_requests() to authenticated;
grant execute on function chat_private.list_blocked_users() to authenticated;

revoke all on function public.chat_list_friends() from public, anon;
revoke all on function public.chat_list_friend_requests() from public, anon;
revoke all on function public.chat_list_blocked_users() from public, anon;
grant execute on function public.chat_list_friends() to authenticated;
grant execute on function public.chat_list_friend_requests() to authenticated;
grant execute on function public.chat_list_blocked_users() to authenticated;

comment on function public.chat_list_friends() is 'Returns only the signed-in player friend list and limited display fields.';
comment on function public.chat_list_friend_requests() is 'Returns pending incoming and outgoing friend requests for the signed-in player.';
comment on function public.chat_list_blocked_users() is 'Returns only users blocked by the signed-in player.';
