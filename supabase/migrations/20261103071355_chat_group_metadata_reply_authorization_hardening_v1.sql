create or replace function chat_private.update_group_metadata(p_conversation_id uuid,p_title text,p_description text,p_avatar_url text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=(select auth.uid()); v_role text;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if char_length(btrim(coalesce(p_title,''))) not between 1 and 64 or char_length(coalesce(p_description,''))>500 then raise exception using errcode='22023',message='invalid_group_metadata'; end if;
 select m.role into v_role from public.chat_members m join public.chat_conversations c on c.id=m.conversation_id where m.conversation_id=p_conversation_id and m.user_id=v_user_id and c.kind='group';
 if coalesce(v_role,'') not in ('owner','admin') then raise exception using errcode='42501',message='group_metadata_management_forbidden'; end if;
 if p_avatar_url is not null and p_avatar_url !~ '^https://[^[:space:]]+$' then raise exception using errcode='22023',message='invalid_group_avatar_url'; end if;
 update public.chat_conversations set title=btrim(p_title),description=btrim(coalesce(p_description,'')),avatar_url=p_avatar_url where id=p_conversation_id and kind='group';
 return found;
end;
$$;
create or replace function chat_private.send_message_with_reply(p_conversation_id uuid,p_client_message_id uuid,p_body text,p_reply_to_message_id uuid)
returns public.chat_messages language plpgsql security definer set search_path = ''
as $$
declare v_message public.chat_messages;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if not chat_private.is_member(p_conversation_id) then raise exception using errcode='42501',message='conversation_membership_required'; end if;
 if p_reply_to_message_id is not null and not exists(select 1 from public.chat_messages parent where parent.id=p_reply_to_message_id and parent.conversation_id=p_conversation_id) then raise exception using errcode='22023',message='reply_target_must_be_in_same_conversation'; end if;
 v_message:=chat_private.send_message(p_conversation_id,p_client_message_id,p_body);
 if v_message.reply_to_message_id is not null and v_message.reply_to_message_id is distinct from p_reply_to_message_id then raise exception using errcode='23505',message='idempotency_key_reused_with_different_reply_target'; end if;
 update public.chat_messages set reply_to_message_id=p_reply_to_message_id where id=v_message.id and reply_to_message_id is null;
 select * into v_message from public.chat_messages where id=v_message.id;
 return v_message;
end;
$$;
