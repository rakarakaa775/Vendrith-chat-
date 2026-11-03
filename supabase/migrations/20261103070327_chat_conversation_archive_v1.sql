alter table public.chat_members
  add column if not exists archived_at timestamptz;

create function chat_private.set_conversation_archived(p_conversation_id uuid, p_archived boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_archived_at timestamptz := case when p_archived then clock_timestamp() else null end;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  update public.chat_members set archived_at = v_archived_at
  where conversation_id = p_conversation_id and user_id = v_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'conversation_membership_required';
  end if;
  return v_archived_at;
end;
$$;

create function public.chat_set_conversation_archived(p_conversation_id uuid, p_archived boolean)
returns timestamptz language sql security invoker set search_path = ''
as $$ select chat_private.set_conversation_archived(p_conversation_id, p_archived); $$;

revoke all on function chat_private.set_conversation_archived(uuid, boolean) from public, anon;
revoke all on function public.chat_set_conversation_archived(uuid, boolean) from public, anon, authenticated;
grant execute on function chat_private.set_conversation_archived(uuid, boolean) to authenticated;
grant execute on function public.chat_set_conversation_archived(uuid, boolean) to authenticated;
