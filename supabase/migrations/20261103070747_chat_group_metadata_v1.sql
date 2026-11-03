alter table public.chat_conversations add column if not exists description text not null default '', add column if not exists avatar_url text;
create function chat_private.update_group_metadata(p_conversation_id uuid,p_title text,p_description text,p_avatar_url text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_role text;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if char_length(btrim(coalesce(p_title,''))) not between 1 and 64 or char_length(coalesce(p_description,''))>500 then raise exception using errcode='22023',message='invalid_group_metadata'; end if;
 select m.role into v_role from public.chat_members m join public.chat_conversations c on c.id=m.conversation_id
 where m.conversation_id=p_conversation_id and m.user_id=v_user_id and c.kind='group';
 if v_role not in ('owner','admin') then raise exception using errcode='42501',message='group_metadata_management_forbidden'; end if;
 if p_avatar_url is not null and p_avatar_url !~ '^https://[^[:space:]]+$' then raise exception using errcode='22023',message='invalid_group_avatar_url'; end if;
 update public.chat_conversations set title=btrim(p_title),description=btrim(coalesce(p_description,'')),avatar_url=p_avatar_url where id=p_conversation_id and kind='group';
 return found;
end;
$$;
create function public.chat_update_group_metadata(p_conversation_id uuid,p_title text,p_description text,p_avatar_url text default null)
returns boolean language sql security invoker set search_path = ''
as $$ select chat_private.update_group_metadata(p_conversation_id,p_title,p_description,p_avatar_url); $$;
revoke all on function chat_private.update_group_metadata(uuid,text,text,text) from public,anon;
revoke all on function public.chat_update_group_metadata(uuid,text,text,text) from public,anon,authenticated;
grant execute on function chat_private.update_group_metadata(uuid,text,text,text) to authenticated;
grant execute on function public.chat_update_group_metadata(uuid,text,text,text) to authenticated;
grant select (description,avatar_url) on table public.chat_conversations to authenticated;
