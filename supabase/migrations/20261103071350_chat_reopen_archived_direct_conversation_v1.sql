create or replace function chat_private.create_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=(select auth.uid()); v_direct_key text; v_conversation_id uuid;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if p_other_user_id is null or p_other_user_id=v_user_id then raise exception using errcode='22023',message='invalid_direct_message_recipient'; end if;
 v_direct_key:=least(v_user_id::text,p_other_user_id::text)||':'||greatest(v_user_id::text,p_other_user_id::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_direct_key,0));
 if not exists(select 1 from auth.users u where u.id=p_other_user_id and coalesce(u.is_anonymous,false)=false) then raise exception using errcode='22023',message='direct_message_recipient_not_found'; end if;
 if exists(select 1 from public.chat_blocks b where (b.blocker_id=v_user_id and b.blocked_id=p_other_user_id) or (b.blocker_id=p_other_user_id and b.blocked_id=v_user_id)) then raise exception using errcode='42501',message='direct_conversation_blocked'; end if;
 select id into v_conversation_id from public.chat_conversations where direct_key=v_direct_key;
 if v_conversation_id is null then
  perform chat_private.enforce_rate_limit('create_direct_conversation',10,3600);
  insert into public.chat_conversations(kind,direct_key,created_by) values('direct',v_direct_key,v_user_id) on conflict(direct_key) where direct_key is not null do nothing;
  select id into v_conversation_id from public.chat_conversations where direct_key=v_direct_key;
 end if;
 insert into public.chat_members(conversation_id,user_id,role,added_by) values(v_conversation_id,v_user_id,'member',v_user_id),(v_conversation_id,p_other_user_id,'member',v_user_id) on conflict(conversation_id,user_id) do nothing;
 update public.chat_members set archived_at=null where conversation_id=v_conversation_id and user_id=v_user_id;
 return v_conversation_id;
end;
$$;
