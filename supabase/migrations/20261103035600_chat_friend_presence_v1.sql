-- Friend-only, expiring presence for Vendrith Chat.
-- Presence is ephemeral: clients heartbeat while visible; missing heartbeats expire.
-- No direct table access is granted to anon/authenticated clients.

alter table public.chat_profiles
  add column if not exists show_online_status boolean not null default false,
  add column if not exists show_last_seen boolean not null default false;

create table if not exists public.chat_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.chat_presence enable row level security;
revoke all on table public.chat_presence from public, anon, authenticated;

create or replace function chat_private.heartbeat_presence()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_show_online boolean;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  select profile.show_online_status into v_show_online
  from public.chat_profiles profile
  where profile.user_id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'community_profile_required';
  end if;

  if not v_show_online then
    delete from public.chat_presence presence where presence.user_id = v_user_id;
    return false;
  end if;

  insert into public.chat_presence (user_id, last_seen_at)
  values (v_user_id, now())
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at
    where public.chat_presence.last_seen_at < now() - interval '15 seconds';

  return true;
end;
$$;

create or replace function chat_private.set_presence_privacy(
  p_show_online_status boolean,
  p_show_last_seen boolean
)
returns void
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

  update public.chat_profiles
  set show_online_status = coalesce(p_show_online_status, false),
      show_last_seen = coalesce(p_show_last_seen, false),
      updated_at = now()
  where user_id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'community_profile_required';
  end if;

  if not coalesce(p_show_online_status, false) then
    delete from public.chat_presence presence where presence.user_id = v_user_id;
  end if;
end;
$$;

create or replace function chat_private.list_friend_presence()
returns table (
  friend_user_id uuid,
  is_online boolean,
  last_seen_at timestamptz
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
    friend.user_id,
    coalesce(profile.show_online_status and presence.last_seen_at >= now() - interval '90 seconds', false),
    case
      when coalesce(profile.show_online_status, false)
       and coalesce(profile.show_last_seen, false)
       and (presence.last_seen_at is null or presence.last_seen_at < now() - interval '90 seconds')
      then presence.last_seen_at
      else null
    end
  from (
    select case when friendship.user_low = v_user_id then friendship.user_high else friendship.user_low end as user_id
    from public.chat_friendships friendship
    where friendship.user_low = v_user_id or friendship.user_high = v_user_id
  ) friend
  join public.chat_profiles profile on profile.user_id = friend.user_id
  left join public.chat_presence presence on presence.user_id = friend.user_id
  where not exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_user_id and block_row.blocked_id = friend.user_id)
       or (block_row.blocker_id = friend.user_id and block_row.blocked_id = v_user_id)
  )
  order by friend.user_id;
end;
$$;

create or replace function public.chat_presence_heartbeat()
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.heartbeat_presence(); $$;

create or replace function public.chat_set_presence_privacy(
  p_show_online_status boolean,
  p_show_last_seen boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$ select chat_private.set_presence_privacy(p_show_online_status, p_show_last_seen); $$;

create or replace function public.chat_list_friend_presence()
returns table (
  friend_user_id uuid,
  is_online boolean,
  last_seen_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from chat_private.list_friend_presence(); $$;

revoke all on function chat_private.heartbeat_presence() from public, anon;
revoke all on function chat_private.set_presence_privacy(boolean, boolean) from public, anon;
revoke all on function chat_private.list_friend_presence() from public, anon;
grant execute on function chat_private.heartbeat_presence() to authenticated;
grant execute on function chat_private.set_presence_privacy(boolean, boolean) to authenticated;
grant execute on function chat_private.list_friend_presence() to authenticated;

revoke all on function public.chat_presence_heartbeat() from public, anon;
revoke all on function public.chat_set_presence_privacy(boolean, boolean) from public, anon;
revoke all on function public.chat_list_friend_presence() from public, anon;
grant execute on function public.chat_presence_heartbeat() to authenticated;
grant execute on function public.chat_set_presence_privacy(boolean, boolean) to authenticated;
grant execute on function public.chat_list_friend_presence() to authenticated;

comment on table public.chat_presence is 'Ephemeral Vendrith Chat presence heartbeat; friend-only status is exposed through an authorization-checked RPC.';
