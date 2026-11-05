-- Reject NULL resolution decisions rather than treating them as a dismissal.
create or replace function chat_private.resolve_group_report(
  p_report_id uuid,
  p_decision text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_report public.chat_group_reports%rowtype;
  v_role text;
  v_removed boolean;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_decision is null or p_decision not in ('dismiss', 'remove_member')
     or char_length(coalesce(p_note, '')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_group_report_resolution';
  end if;

  select * into v_report
  from public.chat_group_reports report_row
  where report_row.id = p_report_id
  for update;

  if not found or v_report.status <> 'open' then
    raise exception using errcode = '22023', message = 'open_group_report_not_found';
  end if;

  select member_row.role into v_role
  from public.chat_members member_row
  join public.chat_conversations conversation
    on conversation.id = member_row.conversation_id
  where member_row.conversation_id = v_report.conversation_id
    and member_row.user_id = v_user_id
    and conversation.kind = 'group';

  if v_role is null or v_role not in ('owner', 'admin', 'moderator') then
    raise exception using errcode = '42501', message = 'group_moderation_access_forbidden';
  end if;

  if p_decision = 'remove_member' then
    if v_report.reported_user_id is null then
      raise exception using errcode = '22023', message = 'report_has_no_member_target';
    end if;
    v_removed := chat_private.remove_group_member(v_report.conversation_id, v_report.reported_user_id);
    if not coalesce(v_removed, false) then
      raise exception using errcode = '42501', message = 'reported_member_could_not_be_removed';
    end if;
    update public.chat_group_reports
    set status = 'resolved',
        reviewed_by = v_user_id,
        reviewed_at = pg_catalog.now(),
        resolution_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
    where id = p_report_id;
    insert into public.chat_group_moderation_events (
      conversation_id, actor_id, report_id, target_user_id, action, note
    ) values (
      v_report.conversation_id, v_user_id, p_report_id, v_report.reported_user_id,
      'member_removed', coalesce(p_note, '')
    );
  else
    update public.chat_group_reports
    set status = 'dismissed',
        reviewed_by = v_user_id,
        reviewed_at = pg_catalog.now(),
        resolution_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
    where id = p_report_id;
    insert into public.chat_group_moderation_events (
      conversation_id, actor_id, report_id, target_user_id, action, note
    ) values (
      v_report.conversation_id, v_user_id, p_report_id, v_report.reported_user_id,
      'report_dismissed', coalesce(p_note, '')
    );
  end if;

  return true;
end;
$$;

revoke all on function chat_private.resolve_group_report(uuid, text, text) from public, anon;
grant execute on function chat_private.resolve_group_report(uuid, text, text) to authenticated;
