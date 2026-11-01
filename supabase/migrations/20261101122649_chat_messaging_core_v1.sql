-- Vendrith Chat direct-message core. This migration owns only chat_* objects.
-- Player identity is always the verified Supabase Auth UUID; no profile/game tables are changed.

create schema chat_private;
revoke all on schema chat_private from public, anon, authenticated;
grant usage on schema chat_private to authenticated;

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind = 'direct'),
  direct_key text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.chat_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  client_message_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint chat_messages_idempotency_unique unique (conversation_id, sender_id, client_message_id)
);

create index chat_messages_history_idx
  on public.chat_messages (conversation_id, created_at desc, id desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

-- This narrowly scoped SECURITY DEFINER helper avoids recursive membership RLS checks.
-- It returns only a boolean and derives the principal exclusively from auth.uid().
create function chat_private.is_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    and exists (
      select 1
      from public.chat_members as member_row
      where member_row.conversation_id = p_conversation_id
        and member_row.user_id = (select auth.uid())
    );
$$;

create policy chat_conversations_select_member
  on public.chat_conversations
  for select to authenticated
  using (chat_private.is_member(id));

create policy chat_members_select_member
  on public.chat_members
  for select to authenticated
  using (chat_private.is_member(conversation_id));

create policy chat_messages_select_member
  on public.chat_messages
  for select to authenticated
  using (chat_private.is_member(conversation_id));

-- Membership and message writes are exposed only through these validated RPC operations.
create function chat_private.create_direct_conversation(p_other_user_id uuid)
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

  insert into public.chat_conversations (kind, direct_key, created_by)
  values ('direct', v_direct_key, v_user_id)
  on conflict (direct_key) do nothing;

  select conversation.id into v_conversation_id
  from public.chat_conversations as conversation
  where conversation.direct_key = v_direct_key;

  insert into public.chat_members (conversation_id, user_id)
  values (v_conversation_id, v_user_id), (v_conversation_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

create function chat_private.send_message(
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

-- Public, SECURITY INVOKER wrappers are the only RPC entry points exposed by PostgREST.
create function public.chat_create_direct_conversation(p_other_user_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select chat_private.create_direct_conversation(p_other_user_id);
$$;

create function public.chat_send_message(
  p_conversation_id uuid,
  p_client_message_id uuid,
  p_body text
)
returns public.chat_messages
language sql
security invoker
set search_path = ''
as $$
  select chat_private.send_message(p_conversation_id, p_client_message_id, p_body);
$$;

-- Supabase's Data API no longer auto-exposes grants on newly created public tables.
-- Keep the table API read-only; all writes go through the validated RPCs above.
revoke all on table public.chat_conversations, public.chat_members, public.chat_messages from public, anon, authenticated;
grant select (id, kind, created_by, created_at) on public.chat_conversations to authenticated;
grant select (conversation_id, user_id, joined_at) on public.chat_members to authenticated;
grant select (id, conversation_id, sender_id, client_message_id, body, created_at) on public.chat_messages to authenticated;

revoke all on function chat_private.is_member(uuid) from public, anon;
revoke all on function chat_private.create_direct_conversation(uuid) from public, anon;
revoke all on function chat_private.send_message(uuid, uuid, text) from public, anon;
grant execute on function chat_private.is_member(uuid) to authenticated;
grant execute on function chat_private.create_direct_conversation(uuid) to authenticated;
grant execute on function chat_private.send_message(uuid, uuid, text) to authenticated;

revoke all on function public.chat_create_direct_conversation(uuid) from public, anon;
revoke all on function public.chat_send_message(uuid, uuid, text) from public, anon;
grant execute on function public.chat_create_direct_conversation(uuid) to authenticated;
grant execute on function public.chat_send_message(uuid, uuid, text) to authenticated;

comment on schema chat_private is 'Non-exposed implementation helpers for Vendrith Chat authorization and writes.';
comment on table public.chat_conversations is 'Vendrith Chat-owned direct-message conversations.';
comment on table public.chat_members is 'Membership boundary for Vendrith Chat conversations.';
comment on table public.chat_messages is 'Persisted Vendrith Chat messages; sender identity and timestamp are server-authoritative.';
