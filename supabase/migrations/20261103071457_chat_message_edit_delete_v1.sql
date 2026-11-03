alter table public.chat_messages add column if not exists edited_at timestamptz, add column if not exists is_deleted boolean not null default false;
create function chat_private.edit_message(p_message_id uuid,p_body text)
returns public.chat_messages language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=(select auth.uid()); v_message public.chat_messages; v_body text:=btrim(coalesce(p_body,''));
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if char_length(v_body) not between 1 and 4000 then raise exception using errcode='22023',message='invalid_message_body'; end if;
 select * into v_message from public.chat_messages where id=p_message_id and sender_id=v_user_id for update;
 if not found or v_message.is_deleted or v_message.created_at<now()-interval '15 minutes' then raise exception using errcode='42501',message='message_edit_window_expired_or_forbidden'; end if;
 if not chat_private.is_member(v_message.conversation_id) then raise exception using errcode='42501',message='conversation_membership_required'; end if;
 if exists(select 1 from public.chat_conversations where id=v_message.conversation_id and closed_at is not null) then raise exception using errcode='55000',message='conversation_closed'; end if;
 update public.chat_messages set body=v_body,edited_at=clock_timestamp() where id=p_message_id returning * into v_message; return v_message;
end;
$$;
create function public.chat_edit_message(p_message_id uuid,p_body text) returns public.chat_messages language sql security invoker set search_path = '' as $$ select chat_private.edit_message(p_message_id,p_body); $$;
create function chat_private.delete_message(p_message_id uuid)
returns public.chat_messages language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=(select auth.uid()); v_message public.chat_messages;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 select * into v_message from public.chat_messages where id=p_message_id and sender_id=v_user_id for update;
 if not found or v_message.is_deleted or v_message.created_at<now()-interval '15 minutes' then raise exception using errcode='42501',message='message_delete_window_expired_or_forbidden'; end if;
 if not chat_private.is_member(v_message.conversation_id) then raise exception using errcode='42501',message='conversation_membership_required'; end if;
 update public.chat_messages set body='[Message deleted]',is_deleted=true,edited_at=clock_timestamp() where id=p_message_id returning * into v_message; return v_message;
end;
$$;
create function public.chat_delete_message(p_message_id uuid) returns public.chat_messages language sql security invoker set search_path = '' as $$ select chat_private.delete_message(p_message_id); $$;
revoke all on function chat_private.edit_message(uuid,text) from public,anon;
revoke all on function chat_private.delete_message(uuid) from public,anon;
revoke all on function public.chat_edit_message(uuid,text) from public,anon,authenticated;
revoke all on function public.chat_delete_message(uuid) from public,anon,authenticated;
grant execute on function chat_private.edit_message(uuid,text) to authenticated;
grant execute on function chat_private.delete_message(uuid) to authenticated;
grant execute on function public.chat_edit_message(uuid,text) to authenticated;
grant execute on function public.chat_delete_message(uuid) to authenticated;
grant select (edited_at,is_deleted) on table public.chat_messages to authenticated;
