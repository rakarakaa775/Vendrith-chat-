create or replace function chat_private.notify_group_report_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare member_row record;
begin
 for member_row in select user_id from public.chat_members where conversation_id=new.conversation_id and role in ('owner','admin','moderator') and user_id<>new.reporter_id
 loop
  perform chat_private.create_notification(member_row.user_id,'moderation','group_report_created','Group report submitted','A report is awaiting moderator review.',new.conversation_id,null,new.id);
 end loop;
 return new;
end;
$$;
