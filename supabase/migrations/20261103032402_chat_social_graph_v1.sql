-- Vendrith Chat Phase 6 social graph foundation.
-- Scope: chat-owned profile discovery, friend requests, friendships and blocks.
-- No World of Vendrith production/game tables are read or modified.

create table public.chat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  discoverable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_profiles_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9_]{3,20}$'
  ),
  constraint chat_profiles_display_name_length check (
    char_length(btrim(display_name)) between 1 and 32
  )
);

create table public.chat_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint chat_friend_requests_no_self check (sender_id <> recipient_id)
);

create unique index chat_friend_requests_one_pending_pair_idx
  on public.chat_friend_requests (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  )
  where status = 'pending';

create index chat_friend_requests_recipient_pending_idx
  on public.chat_friend_requests (recipient_id, created_at desc)
  where status = 'pending';

create index chat_friend_requests_sender_pending_idx
  on public.chat_friend_requests (sender_id, created_at desc)
  where status = 'pending';

create table public.chat_friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint chat_friendships_sorted_pair check (user_low < user_high)
);

create index chat_friendships_user_high_idx
  on public.chat_friendships (user_high, user_low);

create table public.chat_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint chat_blocks_no_self check (blocker_id <> blocked_id)
);

create index chat_blocks_blocked_id_idx on public.chat_blocks (blocked_id, blocker_id);

alter table public.chat_profiles enable row level security;
alter table public.chat_friend_requests enable row level security;
alter table public.chat_friendships enable row level security;
alter table public.chat_blocks enable row level security;

create policy chat_profiles_select_self
  on public.chat_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy chat_friend_requests_select_participant
  on public.chat_friend_requests for select to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

create policy chat_friendships_select_participant
  on public.chat_friendships for select to authenticated
  using (
    user_low = (select auth.uid())
    or user_high = (select auth.uid())
  );

create policy chat_blocks_select_owner
  on public.chat_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on table
  public.chat_profiles,
  public.chat_friend_requests,
  public.chat_friendships,
  public.chat_blocks
from public, anon, authenticated;

grant select (user_id, username, display_name, discoverable, created_at, updated_at)
  on public.chat_profiles to authenticated;
grant select (id, sender_id, recipient_id, status, created_at, responded_at)
  on public.chat_friend_requests to authenticated;
grant select (user_low, user_high, created_at)
  on public.chat_friendships to authenticated;
grant select (blocker_id, blocked_id, created_at)
  on public.chat_blocks to authenticated;

-- Extend the existing private per-user rate limiter without changing existing limits.
alter table chat_private.rate_limit_events
  drop constraint rate_limit_events_action_check;

alter table chat_private.rate_limit_events
  add constraint rate_limit_events_action_check
  check (action in (
    'create_direct_conversation',
    'send_message_minute',
    'send_message_hour',
    'profile_search',
    'profile_update',
    'send_friend_request'
  ));

create or replace function chat_private.enforce_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if v_user_id is null
    or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if p_action not in (
      'create_direct_conversation',
      'send_message_minute',
      'send_message_hour',
      'profile_search',
      'profile_update',
      'send_friend_request'
    )
    or p_max_requests < 1
    or p_window_seconds < 1 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_configuration';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_action, 0)
  );

  delete from chat_private.rate_limit_events
  where user_id = v_user_id
    and action = p_action
    and occurred_at < v_now - interval '24 hours';

  select count(*)::integer into v_count
  from chat_private.rate_limit_events
  where user_id = v_user_id
    and action = p_action
    and occurred_at > v_now - make_interval(secs => p_window_seconds);

  if v_count >= p_max_requests then
    raise exception using
      errcode = '53300',
      message = 'chat_rate_limit_exceeded',
      detail = p_action || ':' || p_window_seconds || 's';
  end if;

  insert into chat_private.rate_limit_events (user_id, action, occurred_at)
  values (v_user_id, p_action, v_now);
end;
$$;

create or replace function chat_private.upsert_profile(
  p_username text,
  p_display_name text,
  p_discoverable boolean default false
)
returns public.chat_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_profile public.chat_profiles;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if v_username !~ '^[a-z0-9_]{3,20}$'
    or char_length(v_display_name) not between 1 and 32 then
    raise exception using errcode = '22023', message = 'invalid_chat_profile';
  end if;

  perform chat_private.enforce_rate_limit('profile_update', 5, 3600);

  insert into public.chat_profiles (user_id, username, display_name, discoverable)
  values (v_user_id, v_username, v_display_name, coalesce(p_discoverable, false))
  on conflict (user_id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        discoverable = excluded.discoverable,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.chat_upsert_profile(
  p_username text,
  p_display_name text,
  p_discoverable boolean default false
)
returns public.chat_profiles
language sql
security invoker
set search_path = ''
as $$
  select chat_private.upsert_profile(p_username, p_display_name, p_discoverable);
$$;

create or replace function chat_private.search_users(
  p_query text,
  p_limit integer default 20
)
returns table(user_id uuid, username text, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if char_length(v_query) < 3 or char_length(v_query) > 32
    or v_query !~ '^[[:alnum:]_ ]+$' then
    raise exception using errcode = '22023', message = 'invalid_user_search_query';
  end if;

  perform chat_private.enforce_rate_limit('profile_search', 30, 60);

  return query
  select profile.user_id, profile.username, profile.display_name
  from public.chat_profiles as profile
  where profile.user_id <> v_user_id
    and profile.discoverable
    and (
      profile.username like v_query || '%'
      or pg_catalog.strpos(lower(profile.display_name), v_query) > 0
    )
    and not exists (
      select 1
      from public.chat_blocks as block_row
      where (block_row.blocker_id = v_user_id and block_row.blocked_id = profile.user_id)
         or (block_row.blocker_id = profile.user_id and block_row.blocked_id = v_user_id)
    )
  order by profile.username
  limit v_limit;
end;
$$;

create or replace function public.chat_search_users(
  p_query text,
  p_limit integer default 20
)
returns table(user_id uuid, username text, display_name text)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.search_users(p_query, p_limit);
$$;

create or replace function chat_private.send_friend_request(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request_id uuid;
  v_pair_low uuid;
  v_pair_high uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend_request_recipient';
  end if;

  if not exists (
    select 1 from public.chat_profiles profile
    join auth.users target_user on target_user.id = profile.user_id
    where profile.user_id = p_recipient_id
      and profile.discoverable
      and coalesce(target_user.is_anonymous, false) = false
  ) then
    raise exception using errcode = '22023', message = 'friend_request_recipient_not_found';
  end if;

  v_pair_low := least(v_user_id, p_recipient_id);
  v_pair_high := greatest(v_user_id, p_recipient_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_pair_low::text || ':' || v_pair_high::text, 0)
  );

  if exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_user_id and block_row.blocked_id = p_recipient_id)
       or (block_row.blocker_id = p_recipient_id and block_row.blocked_id = v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'friend_request_blocked';
  end if;

  if exists (
    select 1 from public.chat_friendships friendship
    where friendship.user_low = v_pair_low and friendship.user_high = v_pair_high
  ) then
    raise exception using errcode = '23505', message = 'already_friends';
  end if;

  select request.id into v_request_id
  from public.chat_friend_requests request
  where request.sender_id = v_user_id
    and request.recipient_id = p_recipient_id
    and request.status = 'pending';

  if v_request_id is not null then
    return v_request_id;
  end if;

  if exists (
    select 1 from public.chat_friend_requests request
    where request.sender_id = p_recipient_id
      and request.recipient_id = v_user_id
      and request.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'incoming_friend_request_exists';
  end if;

  perform chat_private.enforce_rate_limit('send_friend_request', 20, 86400);

  insert into public.chat_friend_requests (sender_id, recipient_id)
  values (v_user_id, p_recipient_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.chat_send_friend_request(p_recipient_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select chat_private.send_friend_request(p_recipient_id);
$$;

create or replace function chat_private.respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.chat_friend_requests;
  v_pair_low uuid;
  v_pair_high uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  select * into v_request
  from public.chat_friend_requests
  where id = p_request_id;

  if not found or v_request.recipient_id <> v_user_id then
    raise exception using errcode = '42501', message = 'friend_request_not_available';
  end if;

  v_pair_low := least(v_request.sender_id, v_request.recipient_id);
  v_pair_high := greatest(v_request.sender_id, v_request.recipient_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_pair_low::text || ':' || v_pair_high::text, 0)
  );

  select * into v_request
  from public.chat_friend_requests
  where id = p_request_id
  for update;

  if not found or v_request.recipient_id <> v_user_id then
    raise exception using errcode = '42501', message = 'friend_request_not_available';
  end if;

  if v_request.status <> 'pending' then
    raise exception using errcode = '22023', message = 'friend_request_not_pending';
  end if;

  if exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_request.sender_id and block_row.blocked_id = v_request.recipient_id)
       or (block_row.blocker_id = v_request.recipient_id and block_row.blocked_id = v_request.sender_id)
  ) then
    raise exception using errcode = '42501', message = 'friend_request_blocked';
  end if;

  if coalesce(p_accept, false) then
    insert into public.chat_friendships (user_low, user_high)
    values (v_pair_low, v_pair_high)
    on conflict do nothing;

    update public.chat_friend_requests
    set status = 'accepted', responded_at = now()
    where id = p_request_id;
  else
    update public.chat_friend_requests
    set status = 'declined', responded_at = now()
    where id = p_request_id;
  end if;

  return true;
end;
$$;

create or replace function public.chat_respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select chat_private.respond_friend_request(p_request_id, p_accept);
$$;

create or replace function chat_private.cancel_friend_request(p_request_id uuid)
returns boolean
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

  update public.chat_friend_requests
  set status = 'cancelled', responded_at = now()
  where id = p_request_id
    and sender_id = v_user_id
    and status = 'pending';

  if not found then
    raise exception using errcode = '42501', message = 'friend_request_not_available';
  end if;

  return true;
end;
$$;

create or replace function public.chat_cancel_friend_request(p_request_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select chat_private.cancel_friend_request(p_request_id);
$$;

create or replace function chat_private.remove_friend(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_pair_low uuid;
  v_pair_high uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;

  v_pair_low := least(v_user_id, p_other_user_id);
  v_pair_high := greatest(v_user_id, p_other_user_id);

  delete from public.chat_friendships
  where user_low = v_pair_low and user_high = v_pair_high;

  return found;
end;
$$;

create or replace function public.chat_remove_friend(p_other_user_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select chat_private.remove_friend(p_other_user_id);
$$;

create or replace function chat_private.block_user(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_pair_low uuid;
  v_pair_high uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_block_target';
  end if;

  v_pair_low := least(v_user_id, p_other_user_id);
  v_pair_high := greatest(v_user_id, p_other_user_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_pair_low::text || ':' || v_pair_high::text, 0)
  );

  insert into public.chat_blocks (blocker_id, blocked_id)
  values (v_user_id, p_other_user_id)
  on conflict do nothing;

  delete from public.chat_friendships
  where user_low = v_pair_low and user_high = v_pair_high;

  update public.chat_friend_requests
  set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and (
      (sender_id = v_user_id and recipient_id = p_other_user_id)
      or (sender_id = p_other_user_id and recipient_id = v_user_id)
    );

  return true;
end;
$$;

create or replace function public.chat_block_user(p_other_user_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select chat_private.block_user(p_other_user_id);
$$;

create or replace function chat_private.unblock_user(p_other_user_id uuid)
returns boolean
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

  delete from public.chat_blocks
  where blocker_id = v_user_id and blocked_id = p_other_user_id;

  return found;
end;
$$;

create or replace function public.chat_unblock_user(p_other_user_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select chat_private.unblock_user(p_other_user_id);
$$;

-- Existing direct conversations remain readable, but a block prevents new direct messages
-- and prevents reopening/creating a direct conversation.
create or replace function chat_private.create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_direct_key text;
  v_conversation_id uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_direct_message_recipient';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(v_user_id::text, p_other_user_id::text) || ':' || greatest(v_user_id::text, p_other_user_id::text),
      0
    )
  );

  if not exists (
    select 1 from auth.users as target_user
    where target_user.id = p_other_user_id
      and coalesce(target_user.is_anonymous, false) = false
  ) then
    raise exception using errcode = '22023', message = 'direct_message_recipient_not_found';
  end if;

  if exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_user_id and block_row.blocked_id = p_other_user_id)
       or (block_row.blocker_id = p_other_user_id and block_row.blocked_id = v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'direct_conversation_blocked';
  end if;

  v_direct_key := least(v_user_id::text, p_other_user_id::text) || ':' || greatest(v_user_id::text, p_other_user_id::text);

  select conversation.id into v_conversation_id
  from public.chat_conversations as conversation
  where conversation.direct_key = v_direct_key;

  if v_conversation_id is null then
    perform chat_private.enforce_rate_limit('create_direct_conversation', 10, 3600);

    insert into public.chat_conversations (kind, direct_key, created_by)
    values ('direct', v_direct_key, v_user_id)
    on conflict (direct_key) do nothing;

    select conversation.id into v_conversation_id
    from public.chat_conversations as conversation
    where conversation.direct_key = v_direct_key;
  end if;

  insert into public.chat_members (conversation_id, user_id)
  values (v_conversation_id, v_user_id), (v_conversation_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function chat_private.send_message(
  p_conversation_id uuid,
  p_client_message_id uuid,
  p_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_message public.chat_messages;
  v_other_user_id uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  if p_client_message_id is null or char_length(v_body) = 0 or char_length(v_body) > 4000 then
    raise exception using errcode = '22023', message = 'invalid_message_payload';
  end if;

  if not chat_private.is_member(p_conversation_id) then
    raise exception using errcode = '42501', message = 'conversation_membership_required';
  end if;

  select message.* into v_message
  from public.chat_messages as message
  where message.conversation_id = p_conversation_id
    and message.sender_id = v_user_id
    and message.client_message_id = p_client_message_id;

  if found then
    if v_message.body is distinct from v_body then
      raise exception using errcode = '23505', message = 'idempotency_key_reused_with_different_payload';
    end if;
    return v_message;
  end if;

  -- Acquire pair locks in stable order so block and send operations serialize safely.
  for v_other_user_id in
    select member_row.user_id
    from public.chat_members member_row
    where member_row.conversation_id = p_conversation_id
      and member_row.user_id <> v_user_id
    order by member_row.user_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        least(v_user_id::text, v_other_user_id::text) || ':' || greatest(v_user_id::text, v_other_user_id::text),
        0
      )
    );
  end loop;

  if exists (
    select 1
    from public.chat_members other_member
    join public.chat_blocks block_row
      on (block_row.blocker_id = v_user_id and block_row.blocked_id = other_member.user_id)
      or (block_row.blocker_id = other_member.user_id and block_row.blocked_id = v_user_id)
    where other_member.conversation_id = p_conversation_id
      and other_member.user_id <> v_user_id
  ) then
    raise exception using errcode = '42501', message = 'direct_message_blocked';
  end if;

  perform chat_private.enforce_rate_limit('send_message_minute', 30, 60);
  perform chat_private.enforce_rate_limit('send_message_hour', 500, 3600);

  insert into public.chat_messages (conversation_id, sender_id, client_message_id, body)
  values (p_conversation_id, v_user_id, p_client_message_id, v_body)
  on conflict (conversation_id, sender_id, client_message_id) do nothing;

  select message.* into v_message
  from public.chat_messages as message
  where message.conversation_id = p_conversation_id
    and message.sender_id = v_user_id
    and message.client_message_id = p_client_message_id;

  if v_message.body is distinct from v_body then
    raise exception using errcode = '23505', message = 'idempotency_key_reused_with_different_payload';
  end if;

  return v_message;
end;
$$;

-- Expose only authenticated RPC wrappers; implementation functions remain in chat_private.
revoke all on function chat_private.upsert_profile(text, text, boolean) from public, anon;
revoke all on function chat_private.search_users(text, integer) from public, anon;
revoke all on function chat_private.send_friend_request(uuid) from public, anon;
revoke all on function chat_private.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function chat_private.cancel_friend_request(uuid) from public, anon;
revoke all on function chat_private.remove_friend(uuid) from public, anon;
revoke all on function chat_private.block_user(uuid) from public, anon;
revoke all on function chat_private.unblock_user(uuid) from public, anon;

grant execute on function chat_private.upsert_profile(text, text, boolean) to authenticated;
grant execute on function chat_private.search_users(text, integer) to authenticated;
grant execute on function chat_private.send_friend_request(uuid) to authenticated;
grant execute on function chat_private.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function chat_private.cancel_friend_request(uuid) to authenticated;
grant execute on function chat_private.remove_friend(uuid) to authenticated;
grant execute on function chat_private.block_user(uuid) to authenticated;
grant execute on function chat_private.unblock_user(uuid) to authenticated;

revoke all on function public.chat_upsert_profile(text, text, boolean) from public, anon;
revoke all on function public.chat_search_users(text, integer) from public, anon;
revoke all on function public.chat_send_friend_request(uuid) from public, anon;
revoke all on function public.chat_respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.chat_cancel_friend_request(uuid) from public, anon;
revoke all on function public.chat_remove_friend(uuid) from public, anon;
revoke all on function public.chat_block_user(uuid) from public, anon;
revoke all on function public.chat_unblock_user(uuid) from public, anon;

grant execute on function public.chat_upsert_profile(text, text, boolean) to authenticated;
grant execute on function public.chat_search_users(text, integer) to authenticated;
grant execute on function public.chat_send_friend_request(uuid) to authenticated;
grant execute on function public.chat_respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.chat_cancel_friend_request(uuid) to authenticated;
grant execute on function public.chat_remove_friend(uuid) to authenticated;
grant execute on function public.chat_block_user(uuid) to authenticated;
grant execute on function public.chat_unblock_user(uuid) to authenticated;

comment on table public.chat_profiles is 'Opt-in, user-managed discovery profile for Vendrith Chat; no email or Auth metadata is exposed.';
comment on table public.chat_friend_requests is 'Private-to-participants friend request state for Vendrith Chat.';
comment on table public.chat_friendships is 'Accepted symmetric friendships stored as one canonical UUID pair.';
comment on table public.chat_blocks is 'Directional user blocks; a block prevents discovery, friend requests, and new direct messages.';
