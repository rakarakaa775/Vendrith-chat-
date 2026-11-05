create table public.chat_message_pins (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  constraint chat_message_pins_conversation_message_key unique (conversation_id, message_id)
);

create index chat_message_pins_conversation_pinned_idx
  on public.chat_message_pins (conversation_id, pinned_at desc);

alter table public.chat_message_pins enable row level security;
revoke all on table public.chat_message_pins from public, anon, authenticated;
grant select (id, conversation_id, message_id, pinned_by, pinned_at)
  on public.chat_message_pins to authenticated;

create policy chat_message_pins_select_member
  on public.chat_message_pins
  for select to authenticated
  using (chat_private.is_member(conversation_id));

create function chat_private.pin_message(p_message_id uuid)
returns public.chat_message_pins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
  v_pin public.chat_message_pins;
begin
  if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  select m.conversation_id into v_conversation_id
  from public.chat_messages as m
  where m.id = p_message_id
    and not m.is_deleted;

  if v_conversation_id is null or not chat_private.is_member(v_conversation_id) then
    raise exception using errcode = '42501', message = 'conversation_membership_required';
  end if;

  if exists (
    select 1 from public.chat_conversations as c
    where c.id = v_conversation_id and c.closed_at is not null
  ) then
    raise exception using errcode = '55000', message = 'conversation_closed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_conversation_id::text, 0)
  );

  if exists (
    select 1 from public.chat_message_pins as p
    where p.conversation_id = v_conversation_id and p.message_id = p_message_id
  ) then
    select * into v_pin from public.chat_message_pins as p
    where p.conversation_id = v_conversation_id and p.message_id = p_message_id;
    return v_pin;
  end if;

  if (select count(*) from public.chat_message_pins as p where p.conversation_id = v_conversation_id) >= 10 then
    raise exception using errcode = '54000', message = 'conversation_pin_limit_reached';
  end if;

  insert into public.chat_message_pins (conversation_id, message_id, pinned_by)
  values (v_conversation_id, p_message_id, v_user_id)
  returning * into v_pin;

  return v_pin;
end;
$$;

create function chat_private.unpin_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  select m.conversation_id into v_conversation_id
  from public.chat_messages as m
  where m.id = p_message_id;

  if v_conversation_id is null or not chat_private.is_member(v_conversation_id) then
    raise exception using errcode = '42501', message = 'conversation_membership_required';
  end if;

  delete from public.chat_message_pins as p
  where p.conversation_id = v_conversation_id and p.message_id = p_message_id;

  return found;
end;
$$;

create function public.chat_pin_message(p_message_id uuid)
returns public.chat_message_pins
language sql
security invoker
set search_path = ''
as $$ select chat_private.pin_message(p_message_id); $$;

create function public.chat_unpin_message(p_message_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.unpin_message(p_message_id); $$;

revoke all on function chat_private.pin_message(uuid) from public, anon;
revoke all on function chat_private.unpin_message(uuid) from public, anon;
revoke all on function public.chat_pin_message(uuid) from public, anon, authenticated;
revoke all on function public.chat_unpin_message(uuid) from public, anon, authenticated;
grant execute on function chat_private.pin_message(uuid) to authenticated;
grant execute on function chat_private.unpin_message(uuid) to authenticated;
grant execute on function public.chat_pin_message(uuid) to authenticated;
grant execute on function public.chat_unpin_message(uuid) to authenticated;
