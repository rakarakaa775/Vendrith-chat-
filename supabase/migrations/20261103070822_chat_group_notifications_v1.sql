create function chat_private.notify_group_member_added()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_kind text;
begin
  select kind into v_kind from public.chat_conversations where id=new.conversation_id;
  if v_kind='group' and new.added_by is not null and new.added_by<>new.user_id then
    perform chat_private.create_notification(new.user_id,'groups','group_member_added','Added to a group','You were added to a group conversation.',new.conversation_id,new.added_by,new.conversation_id);
  end if;
  return new;
end;
$$;
create trigger chat_group_member_notification_after_insert after insert on public.chat_members for each row execute function chat_private.notify_group_member_added();

create function chat_private.notify_group_report_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare member_row record;
begin
  for member_row in select user_id from public.chat_members
    where conversation_id=new.conversation_id and role in ('owner','admin','moderator') and user_id<>new.reporter_id
  loop
    perform chat_private.create_notification(member_row.user_id,'moderation','group_report_created','Group report submitted','A report is awaiting moderator review.',new.conversation_id,new.reporter_id,new.id);
  end loop;
  return new;
end;
$$;
create trigger chat_group_report_notification_after_insert after insert on public.chat_group_reports for each row execute function chat_private.notify_group_report_created();
revoke all on function chat_private.notify_group_member_added() from public,anon,authenticated;
revoke all on function chat_private.notify_group_report_created() from public,anon,authenticated;
