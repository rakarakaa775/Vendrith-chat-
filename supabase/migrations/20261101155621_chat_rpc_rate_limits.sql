-- Vendrith Chat RPC rate limiting.
-- Synced from the already-applied Non-Production migration
-- 20261101155621_chat_rpc_rate_limits. This file is for reproducible
-- future environments; do not re-apply it to the existing Non-Production DB.

create table chat_private.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (
    action in (
      'create_direct_conversation',
      'send_message_minute',
      'send_message_hour'
    )
  ),
  occurred_at timestamptz not null default clock_timestamp()
);

create index chat_rate_limit_events_lookup_idx
  on chat_private.rate_limit_events (user_id, action, occurred_at desc);

alter table chat_private.rate_limit_events enable row level security;

-- This table is private implementation state. No API role receives table access.
revoke all on table chat_private.rate_limit_events from public, anon, authenticated;

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

  if p_action not in ('create_direct_conversation', 'send_message_minute', 'send_message_hour')
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

revoke all on function chat_private.enforce_rate_limit(text, integer, integer)
  from public, anon, authenticated;

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

  if not exists (
    select 1 from auth.users as target_user
    where target_user.id = p_other_user_id
      and coalesce(target_user.is_anonymous, false) = false
  ) then
    raise exception using errcode = '22023', message = 'direct_message_recipient_not_found';
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

comment on table chat_private.rate_limit_events is
  'Private per-player Vendrith Chat RPC rate-limit event ledger.';
