alter table public.chat_messages add column if not exists reply_to_message_id uuid references public.chat_messages(id) on delete set null;
grant select (reply_to_message_id) on table public.chat_messages to authenticated;
create function chat_private.send_message_with_reply(p_conversation_id uuid,p_client_message_id uuid,p_body text,p_reply_to_message_id uuid)
returns public.chat_messages language plpgsql security definer set search_path = ''
as $$
declare v_message public.chat_messages;
begin
 if p_reply_to_message_id is not null and not exists(select 1 from public.chat_messages parent where parent.id=p_reply_to_message_id and parent.conversation_id=p_conversation_id) then
  raise exception using errcode='22023',message='reply_target_must_be_in_same_conversation';
 end if;
 v_message:=chat_private.send_message(p_conversation_id,p_client_message_id,p_body);
 if v_message.reply_to_message_id is not null and v_message.reply_to_message_id is distinct from p_reply_to_message_id then
  raise exception using errcode='23505',message='idempotency_key_reused_with_different_reply_target';
 end if;
 update public.chat_messages set reply_to_message_id=p_reply_to_message_id where id=v_message.id and reply_to_message_id is null;
 select * into v_message from public.chat_messages where id=v_message.id;
 return v_message;
end;
$$;
create function public.chat_send_message_with_reply(p_conversation_id uuid,p_client_message_id uuid,p_body text,p_reply_to_message_id uuid)
returns public.chat_messages language sql security invoker set search_path = ''
as $$ select chat_private.send_message_with_reply(p_conversation_id,p_client_message_id,p_body,p_reply_to_message_id); $$;
revoke all on function chat_private.send_message_with_reply(uuid,uuid,text,uuid) from public,anon;
revoke all on function public.chat_send_message_with_reply(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function chat_private.send_message_with_reply(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.chat_send_message_with_reply(uuid,uuid,text,uuid) to authenticated;
