alter table public.chat_members
  add column if not exists last_read_at timestamptz not null default now();

create index if not exists chat_messages_unread_idx
  on public.chat_messages (conversation_id, created_at, sender_id);

create function chat_private.mark_conversation_read(p_conversation_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_read_at timestamptz := clock_timestamp();
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  update public.chat_members
  set last_read_at = v_read_at
  where conversation_id = p_conversation_id
    and user_id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'conversation_membership_required';
  end if;

  return v_read_at;
end;
$$;

create function public.chat_mark_conversation_read(p_conversation_id uuid)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select chat_private.mark_conversation_read(p_conversation_id);
$$;

create function chat_private.list_unread_counts()
returns table (conversation_id uuid, unread_count bigint, last_read_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select member_row.conversation_id,
         count(message.id) filter (where message.sender_id <> (select auth.uid())) as unread_count,
         member_row.last_read_at
  from public.chat_members as member_row
  left join public.chat_messages as message
    on message.conversation_id = member_row.conversation_id
   and message.created_at > member_row.last_read_at
   and message.sender_id <> (select auth.uid())
  where member_row.user_id = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  group by member_row.conversation_id, member_row.last_read_at;
$$;

create function public.chat_list_unread_counts()
returns table (conversation_id uuid, unread_count bigint, last_read_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.list_unread_counts();
$$;

revoke all on function chat_private.mark_conversation_read(uuid) from public, anon;
revoke all on function chat_private.list_unread_counts() from public, anon;
revoke all on function public.chat_mark_conversation_read(uuid) from public, anon, authenticated;
revoke all on function public.chat_list_unread_counts() from public, anon, authenticated;
grant execute on function chat_private.mark_conversation_read(uuid) to authenticated;
grant execute on function chat_private.list_unread_counts() to authenticated;
grant execute on function public.chat_mark_conversation_read(uuid) to authenticated;
grant execute on function public.chat_list_unread_counts() to authenticated;
