alter table public.chat_conversations add column if not exists closed_at timestamptz, add column if not exists closed_by uuid references auth.users(id) on delete set null;
create or replace function chat_private.send_message(p_conversation_id uuid,p_client_message_id uuid,p_body text)
returns public.chat_messages language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_body text:=btrim(coalesce(p_body,'')); v_message public.chat_messages;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if p_client_message_id is null or char_length(v_body)=0 or char_length(v_body)>4000 then raise exception using errcode='22023',message='invalid_message_payload'; end if;
 if not chat_private.is_member(p_conversation_id) then raise exception using errcode='42501',message='conversation_membership_required'; end if;
 if exists(select 1 from public.chat_conversations where id=p_conversation_id and closed_at is not null) then raise exception using errcode='55000',message='conversation_closed'; end if;
 insert into public.chat_messages(conversation_id,sender_id,client_message_id,body) values(p_conversation_id,v_user_id,p_client_message_id,v_body)
 on conflict(conversation_id,sender_id,client_message_id) do nothing;
 select message.* into v_message from public.chat_messages message where message.conversation_id=p_conversation_id and message.sender_id=v_user_id and message.client_message_id=p_client_message_id;
 if v_message.body is distinct from v_body then raise exception using errcode='23505',message='idempotency_key_reused_with_different_payload'; end if;
 return v_message;
end;
$$;
create function chat_private.close_group(p_conversation_id uuid)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=(select auth.uid()); v_closed_at timestamptz;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if not exists(select 1 from public.chat_members where conversation_id=p_conversation_id and user_id=v_user_id and role='owner')
 or not exists(select 1 from public.chat_conversations where id=p_conversation_id and kind='group') then raise exception using errcode='42501',message='only_group_owner_can_close_group'; end if;
 update public.chat_conversations set closed_at=coalesce(closed_at,clock_timestamp()),closed_by=v_user_id where id=p_conversation_id returning closed_at into v_closed_at;
 return v_closed_at;
end;
$$;
create function public.chat_close_group(p_conversation_id uuid)
returns timestamptz language sql security invoker set search_path = ''
as $$ select chat_private.close_group(p_conversation_id); $$;
revoke all on function chat_private.close_group(uuid) from public,anon;
revoke all on function public.chat_close_group(uuid) from public,anon,authenticated;
grant execute on function chat_private.close_group(uuid) to authenticated;
grant execute on function public.chat_close_group(uuid) to authenticated;
grant select (closed_at,closed_by) on table public.chat_conversations to authenticated;
