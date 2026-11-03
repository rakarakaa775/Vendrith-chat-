create function chat_private.list_group_moderation_events(p_conversation_id uuid)
returns table(id uuid,actor_id uuid,report_id uuid,target_user_id uuid,action text,note text,created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if not exists(select 1 from public.chat_members where conversation_id=p_conversation_id and user_id=(select auth.uid()) and role in ('owner','admin','moderator')) then raise exception using errcode='42501',message='group_moderation_access_required'; end if;
 return query select e.id,e.actor_id,e.report_id,e.target_user_id,e.action,e.note,e.created_at from public.chat_group_moderation_events e
 where e.conversation_id=p_conversation_id order by e.created_at desc,e.id desc limit 100;
end;
$$;
create function public.chat_list_group_moderation_events(p_conversation_id uuid)
returns table(id uuid,actor_id uuid,report_id uuid,target_user_id uuid,action text,note text,created_at timestamptz)
language sql security invoker set search_path = ''
as $$ select * from chat_private.list_group_moderation_events(p_conversation_id); $$;
revoke all on function chat_private.list_group_moderation_events(uuid) from public,anon;
revoke all on function public.chat_list_group_moderation_events(uuid) from public,anon,authenticated;
grant execute on function chat_private.list_group_moderation_events(uuid) to authenticated;
grant execute on function public.chat_list_group_moderation_events(uuid) to authenticated;
