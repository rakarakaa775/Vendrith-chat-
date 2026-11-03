create or replace function chat_private.send_message(p_conversation_id uuid,p_client_message_id uuid,p_body text)
returns public.chat_messages language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=(select auth.uid()); v_body text:=btrim(coalesce(p_body,'')); v_message public.chat_messages;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if p_client_message_id is null or char_length(v_body)=0 or char_length(v_body)>4000 then raise exception using errcode='22023',message='invalid_message_payload'; end if;
 if not chat_private.is_member(p_conversation_id) then raise exception using errcode='42501',message='conversation_membership_required'; end if;
 select message.* into v_message from public.chat_messages message where message.conversation_id=p_conversation_id and message.sender_id=v_user_id and message.client_message_id=p_client_message_id;
 if found then
  if v_message.body is distinct from v_body then raise exception using errcode='23505',message='idempotency_key_reused_with_different_payload'; end if;
  return v_message;
 end if;
 if exists(select 1 from public.chat_conversations where id=p_conversation_id and closed_at is not null) then raise exception using errcode='55000',message='conversation_closed'; end if;
 perform chat_private.enforce_rate_limit('send_message_minute',30,60);
 perform chat_private.enforce_rate_limit('send_message_hour',500,3600);
 insert into public.chat_messages(conversation_id,sender_id,client_message_id,body) values(p_conversation_id,v_user_id,p_client_message_id,v_body) on conflict(conversation_id,sender_id,client_message_id) do nothing;
 select message.* into v_message from public.chat_messages message where message.conversation_id=p_conversation_id and message.sender_id=v_user_id and message.client_message_id=p_client_message_id;
 if v_message.body is distinct from v_body then raise exception using errcode='23505',message='idempotency_key_reused_with_different_payload'; end if;
 return v_message;
end;
$$;
