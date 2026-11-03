create table public.chat_message_reactions (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
 created_at timestamptz not null default now(),
 unique(message_id,user_id,emoji)
);
create index chat_message_reactions_conversation_idx on public.chat_message_reactions(conversation_id,message_id);
alter table public.chat_message_reactions enable row level security;
revoke all on table public.chat_message_reactions from public,anon,authenticated;
grant select (id,message_id,conversation_id,user_id,emoji,created_at) on public.chat_message_reactions to authenticated;
create policy chat_message_reactions_select_member on public.chat_message_reactions for select to authenticated using (chat_private.is_member(conversation_id));
create function chat_private.toggle_message_reaction(p_message_id uuid,p_emoji text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_conversation_id uuid;
begin
 if v_user_id is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then raise exception using errcode='28000',message='authenticated_player_required'; end if;
 if p_emoji not in ('👍','❤️','😂','😮','😢','🙏') then raise exception using errcode='22023',message='unsupported_reaction'; end if;
 select conversation_id into v_conversation_id from public.chat_messages where id=p_message_id;
 if v_conversation_id is null or not chat_private.is_member(v_conversation_id) then raise exception using errcode='42501',message='conversation_membership_required'; end if;
 delete from public.chat_message_reactions where message_id=p_message_id and user_id=v_user_id and emoji=p_emoji;
 if found then return false; end if;
 insert into public.chat_message_reactions(message_id,conversation_id,user_id,emoji) values(p_message_id,v_conversation_id,v_user_id,p_emoji);
 return true;
end;
$$;
create function public.chat_toggle_message_reaction(p_message_id uuid,p_emoji text)
returns boolean language sql security invoker set search_path = ''
as $$ select chat_private.toggle_message_reaction(p_message_id,p_emoji); $$;
revoke all on function chat_private.toggle_message_reaction(uuid,text) from public,anon;
revoke all on function public.chat_toggle_message_reaction(uuid,text) from public,anon,authenticated;
grant execute on function chat_private.toggle_message_reaction(uuid,text) to authenticated;
grant execute on function public.chat_toggle_message_reaction(uuid,text) to authenticated;
