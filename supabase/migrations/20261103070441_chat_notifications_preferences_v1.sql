create table public.chat_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('messages','friends','groups','moderation')),
  event_type text not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 240),
  conversation_id uuid references public.chat_conversations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  related_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index chat_notifications_inbox_idx on public.chat_notifications (user_id, created_at desc, id desc);
create index chat_notifications_unread_idx on public.chat_notifications (user_id, created_at desc) where read_at is null;
alter table public.chat_notifications enable row level security;
revoke all on table public.chat_notifications from public, anon, authenticated;
grant select (id, category, event_type, title, body, conversation_id, actor_id, related_id, created_at, read_at) on public.chat_notifications to authenticated;
create policy chat_notifications_select_own on public.chat_notifications for select to authenticated using (user_id = (select auth.uid()));

create table public.chat_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages_enabled boolean not null default true,
  friends_enabled boolean not null default true,
  groups_enabled boolean not null default true,
  moderation_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.chat_notification_preferences enable row level security;
revoke all on table public.chat_notification_preferences from public, anon, authenticated;

create function chat_private.create_notification(p_user_id uuid,p_category text,p_event_type text,p_title text,p_body text,p_conversation_id uuid default null,p_actor_id uuid default null,p_related_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_enabled boolean := true;
begin
  if p_user_id is null or p_category not in ('messages','friends','groups','moderation') then return; end if;
  select case p_category when 'messages' then coalesce(pref.messages_enabled,true)
    when 'friends' then coalesce(pref.friends_enabled,true)
    when 'groups' then coalesce(pref.groups_enabled,true)
    when 'moderation' then coalesce(pref.moderation_enabled,true) else false end
  into v_enabled from (select 1) seed
  left join public.chat_notification_preferences pref on pref.user_id=p_user_id;
  if not coalesce(v_enabled,true) then return; end if;
  insert into public.chat_notifications(user_id,category,event_type,title,body,conversation_id,actor_id,related_id)
  values(p_user_id,p_category,p_event_type,left(p_title,120),left(coalesce(p_body,''),240),p_conversation_id,p_actor_id,p_related_id);
end;
$$;

create function chat_private.notify_chat_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare member_row record;
begin
  for member_row in select user_id from public.chat_members
    where conversation_id=new.conversation_id and user_id<>new.sender_id and archived_at is null
  loop
    perform chat_private.create_notification(member_row.user_id,'messages','new_message','New message',new.body,new.conversation_id,new.sender_id,new.id);
  end loop;
  return new;
end;
$$;
create trigger chat_message_notification_after_insert after insert on public.chat_messages for each row execute function chat_private.notify_chat_message();

create function chat_private.notify_friend_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform chat_private.create_notification(new.recipient_id,'friends','friend_request','New friend request','Someone sent you a friend request.',null,new.sender_id,new.id);
  return new;
end;
$$;
create trigger chat_friend_request_notification_after_insert after insert on public.chat_friend_requests for each row execute function chat_private.notify_friend_request();

create function chat_private.list_notifications(p_limit integer default 30)
returns table(id uuid,category text,event_type text,title text,body text,conversation_id uuid,actor_id uuid,related_id uuid,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select n.id,n.category,n.event_type,n.title,n.body,n.conversation_id,n.actor_id,n.related_id,n.created_at,n.read_at
  from public.chat_notifications n where n.user_id=(select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')<>'true'
  order by n.created_at desc,n.id desc limit greatest(1,least(coalesce(p_limit,30),100));
$$;
create function public.chat_list_notifications(p_limit integer default 30)
returns table(id uuid,category text,event_type text,title text,body text,conversation_id uuid,actor_id uuid,related_id uuid,created_at timestamptz,read_at timestamptz)
language sql security invoker set search_path = ''
as $$ select * from chat_private.list_notifications(p_limit); $$;

create function chat_private.mark_notification_read(p_notification_id uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then
    raise exception using errcode='28000',message='authenticated_player_required';
  end if;
  update public.chat_notifications set read_at=coalesce(read_at,clock_timestamp())
  where user_id=(select auth.uid()) and read_at is null
    and (p_notification_id is null or id=p_notification_id);
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
create function public.chat_mark_notification_read(p_notification_id uuid default null)
returns integer language sql security invoker set search_path = ''
as $$ select chat_private.mark_notification_read(p_notification_id); $$;

create function chat_private.set_notification_preferences(p_messages boolean,p_friends boolean,p_groups boolean,p_moderation boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true' then
    raise exception using errcode='28000',message='authenticated_player_required';
  end if;
  insert into public.chat_notification_preferences(user_id,messages_enabled,friends_enabled,groups_enabled,moderation_enabled,updated_at)
  values((select auth.uid()),p_messages,p_friends,p_groups,p_moderation,now())
  on conflict(user_id) do update set messages_enabled=excluded.messages_enabled,friends_enabled=excluded.friends_enabled,
    groups_enabled=excluded.groups_enabled,moderation_enabled=excluded.moderation_enabled,updated_at=now();
end;
$$;
create function chat_private.get_notification_preferences()
returns table(messages_enabled boolean,friends_enabled boolean,groups_enabled boolean,moderation_enabled boolean)
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.messages_enabled,true),coalesce(p.friends_enabled,true),coalesce(p.groups_enabled,true),coalesce(p.moderation_enabled,true)
  from (select (select auth.uid()) as user_id) u left join public.chat_notification_preferences p on p.user_id=u.user_id
  where u.user_id is not null;
$$;
create function public.chat_set_notification_preferences(p_messages boolean,p_friends boolean,p_groups boolean,p_moderation boolean)
returns void language sql security invoker set search_path = ''
as $$ select chat_private.set_notification_preferences(p_messages,p_friends,p_groups,p_moderation); $$;
create function public.chat_get_notification_preferences()
returns table(messages_enabled boolean,friends_enabled boolean,groups_enabled boolean,moderation_enabled boolean)
language sql security invoker set search_path = ''
as $$ select * from chat_private.get_notification_preferences(); $$;

revoke all on function chat_private.create_notification(uuid,text,text,text,text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function chat_private.notify_chat_message() from public,anon,authenticated;
revoke all on function chat_private.notify_friend_request() from public,anon,authenticated;
revoke all on function chat_private.list_notifications(integer) from public,anon;
revoke all on function chat_private.mark_notification_read(uuid) from public,anon;
revoke all on function chat_private.set_notification_preferences(boolean,boolean,boolean,boolean) from public,anon;
revoke all on function chat_private.get_notification_preferences() from public,anon;
revoke all on function public.chat_list_notifications(integer) from public,anon,authenticated;
revoke all on function public.chat_mark_notification_read(uuid) from public,anon,authenticated;
revoke all on function public.chat_set_notification_preferences(boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.chat_get_notification_preferences() from public,anon,authenticated;
grant execute on function chat_private.list_notifications(integer) to authenticated;
grant execute on function chat_private.mark_notification_read(uuid) to authenticated;
grant execute on function chat_private.set_notification_preferences(boolean,boolean,boolean,boolean) to authenticated;
grant execute on function chat_private.get_notification_preferences() to authenticated;
grant execute on function public.chat_list_notifications(integer) to authenticated;
grant execute on function public.chat_mark_notification_read(uuid) to authenticated;
grant execute on function public.chat_set_notification_preferences(boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.chat_get_notification_preferences() to authenticated;
