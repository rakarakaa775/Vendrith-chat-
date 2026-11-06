-- Realtime social synchronization is delivered through the existing private,
-- user-scoped chat_notifications inbox. No social table is exposed to CDC.

create or replace function chat_private.notify_friend_request_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    perform chat_private.create_notification(
      new.sender_id,
      'friends',
      case new.status when 'accepted' then 'friend_request_accepted' else 'friend_request_declined' end,
      case new.status when 'accepted' then 'Friend request accepted' else 'Friend request declined' end,
      case new.status when 'accepted' then 'Your friend request was accepted.' else 'Your friend request was declined.' end,
      null,
      new.recipient_id,
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger chat_friend_request_response_notification_after_update
after update of status on public.chat_friend_requests
for each row execute function chat_private.notify_friend_request_response();

create or replace function chat_private.notify_friendship_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_other uuid;
begin
  v_other := case when v_actor = old.user_low then old.user_high else old.user_low end;
  if v_actor is not null and v_other is not null then
    perform chat_private.create_notification(
      v_other, 'friends', 'friend_removed', 'Friendship ended',
      'A player is no longer on your friends list.', null, v_actor, null
    );
  end if;
  return old;
end;
$$;

create trigger chat_friendship_removed_notification_after_delete
after delete on public.chat_friendships
for each row execute function chat_private.notify_friendship_removed();

create or replace function chat_private.notify_group_member_role_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    perform chat_private.create_notification(
      new.user_id, 'groups', 'group_role_changed', 'Group role updated',
      'Your role in a group conversation was changed to ' || new.role || '.',
      new.conversation_id, (select auth.uid()), new.conversation_id
    );
  end if;
  return new;
end;
$$;

create trigger chat_group_member_role_notification_after_update
 after update of role on public.chat_members
 for each row execute function chat_private.notify_group_member_role_changed();

create or replace function chat_private.notify_group_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_actor uuid := (select auth.uid());
begin
  select kind into v_kind from public.chat_conversations where id = old.conversation_id;
  if v_kind = 'group' and v_actor is not null and v_actor <> old.user_id then
    perform chat_private.create_notification(
      old.user_id, 'groups', 'group_member_removed', 'Removed from group',
      'You were removed from a group conversation.', old.conversation_id,
      v_actor, old.conversation_id
    );
  end if;
  return old;
end;
$$;

create trigger chat_group_member_removed_notification_after_delete
after delete on public.chat_members
for each row execute function chat_private.notify_group_member_removed();

revoke all on function chat_private.notify_friend_request_response() from public, anon, authenticated;
revoke all on function chat_private.notify_friendship_removed() from public, anon, authenticated;
revoke all on function chat_private.notify_group_member_role_changed() from public, anon, authenticated;
revoke all on function chat_private.notify_group_member_removed() from public, anon, authenticated;

comment on function chat_private.notify_friend_request_response() is
  'Creates recipient-scoped inbox events when a pending friend request is accepted or declined.';
comment on function chat_private.notify_group_member_role_changed() is
  'Creates a recipient-scoped inbox event when a group member role changes.';
