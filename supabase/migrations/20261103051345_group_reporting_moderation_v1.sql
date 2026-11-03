-- Phase 6: private group reporting and moderator review workflow.
-- Reports are visible to the reporter and group staff only; reporter identity is hidden from staff.
create table public.chat_group_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  category text not null check (category in ('spam', 'harassment', 'hate', 'threats', 'sexual_content', 'scam', 'impersonation', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  constraint chat_group_reports_target_check check (reported_user_id is not null or message_id is not null)
);

create index chat_group_reports_queue_idx
  on public.chat_group_reports (conversation_id, created_at desc)
  where status = 'open';
create index chat_group_reports_reporter_idx
  on public.chat_group_reports (reporter_id, created_at desc);

alter table public.chat_group_reports enable row level security;
revoke all on table public.chat_group_reports from public, anon, authenticated;

create table public.chat_group_moderation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  report_id uuid references public.chat_group_reports(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('report_resolved', 'report_dismissed', 'member_removed')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index chat_group_moderation_events_conversation_idx
  on public.chat_group_moderation_events (conversation_id, created_at desc);

alter table public.chat_group_moderation_events enable row level security;
revoke all on table public.chat_group_moderation_events from public, anon, authenticated;

create or replace function chat_private.submit_group_report(
  p_conversation_id uuid,
  p_reported_user_id uuid,
  p_message_id uuid,
  p_category text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_kind text;
  v_message_sender uuid;
  v_target_user_id uuid := p_reported_user_id;
  v_report_id uuid;
  v_recent_count integer;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_category not in ('spam', 'harassment', 'hate', 'threats', 'sexual_content', 'scam', 'impersonation', 'other')
     or char_length(coalesce(p_details, '')) > 1000
     or (p_reported_user_id is null and p_message_id is null) then
    raise exception using errcode = '22023', message = 'invalid_group_report_payload';
  end if;

  select conversation.kind into v_kind
  from public.chat_conversations conversation
  join public.chat_members member_row
    on member_row.conversation_id = conversation.id
   and member_row.user_id = v_user_id
  where conversation.id = p_conversation_id;

  if v_kind is distinct from 'group' then
    raise exception using errcode = '42501', message = 'active_group_membership_required';
  end if;

  if v_target_user_id = v_user_id then
    raise exception using errcode = '22023', message = 'cannot_report_yourself';
  end if;

  if p_message_id is not null then
    select message.sender_id into v_message_sender
    from public.chat_messages message
    where message.id = p_message_id
      and message.conversation_id = p_conversation_id;
    if v_message_sender is null or v_message_sender = v_user_id then
      raise exception using errcode = '22023', message = 'invalid_report_message';
    end if;
    if v_target_user_id is not null and v_target_user_id <> v_message_sender then
      raise exception using errcode = '22023', message = 'report_target_does_not_match_message';
    end if;
    v_target_user_id := v_message_sender;
  end if;

  if v_target_user_id is not null and not exists (
    select 1 from public.chat_members member_row
    where member_row.conversation_id = p_conversation_id
      and member_row.user_id = v_target_user_id
  ) then
    raise exception using errcode = '22023', message = 'reported_user_not_in_group';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('group-report:' || v_user_id::text, 0)
  );
  select count(*) into v_recent_count
  from public.chat_group_reports report_row
  where report_row.reporter_id = v_user_id
    and report_row.created_at > pg_catalog.now() - interval '1 hour';
  if v_recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'group_report_rate_limit_exceeded';
  end if;

  if exists (
    select 1 from public.chat_group_reports report_row
    where report_row.conversation_id = p_conversation_id
      and report_row.reporter_id = v_user_id
      and report_row.status = 'open'
      and report_row.reported_user_id is not distinct from v_target_user_id
      and report_row.message_id is not distinct from p_message_id
  ) then
    raise exception using errcode = '23505', message = 'duplicate_active_group_report';
  end if;

  insert into public.chat_group_reports (
    conversation_id, reporter_id, reported_user_id, message_id, category, details
  ) values (
    p_conversation_id, v_user_id, v_target_user_id, p_message_id,
    p_category, coalesce(p_details, '')
  ) returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function chat_private.list_group_reports(p_conversation_id uuid)
returns table (
  report_id uuid,
  target_user_id uuid,
  message_id uuid,
  category text,
  details text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  select member_row.role into v_role
  from public.chat_members member_row
  join public.chat_conversations conversation
    on conversation.id = member_row.conversation_id
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = v_user_id
    and conversation.kind = 'group';

  if v_role is null or v_role not in ('owner', 'admin', 'moderator') then
    raise exception using errcode = '42501', message = 'group_moderation_access_forbidden';
  end if;

  return query
  select report_row.id, report_row.reported_user_id, report_row.message_id,
         report_row.category, report_row.details, report_row.created_at
  from public.chat_group_reports report_row
  where report_row.conversation_id = p_conversation_id
    and report_row.status = 'open'
  order by report_row.created_at asc
  limit 50;
end;
$$;

create or replace function chat_private.get_my_group_reports(p_conversation_id uuid)
returns table (
  report_id uuid,
  category text,
  status text,
  created_at timestamptz,
  resolution_note text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  return query
  select report_row.id, report_row.category, report_row.status,
         report_row.created_at, report_row.resolution_note
  from public.chat_group_reports report_row
  where report_row.conversation_id = p_conversation_id
    and report_row.reporter_id = v_user_id
  order by report_row.created_at desc
  limit 20;
end;
$$;

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
  if p_decision not in ('dismiss', 'remove_member')
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

create or replace function public.chat_submit_group_report(
  p_conversation_id uuid,
  p_reported_user_id uuid,
  p_message_id uuid,
  p_category text,
  p_details text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select chat_private.submit_group_report(p_conversation_id, p_reported_user_id, p_message_id, p_category, p_details); $$;

create or replace function public.chat_list_group_reports(p_conversation_id uuid)
returns table (
  report_id uuid, target_user_id uuid, message_id uuid, category text, details text, created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from chat_private.list_group_reports(p_conversation_id); $$;

create or replace function public.chat_get_my_group_reports(p_conversation_id uuid)
returns table (
  report_id uuid, category text, status text, created_at timestamptz, resolution_note text
)
language sql
security invoker
set search_path = ''
as $$ select * from chat_private.get_my_group_reports(p_conversation_id); $$;

create or replace function public.chat_resolve_group_report(
  p_report_id uuid,
  p_decision text,
  p_note text default null
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.resolve_group_report(p_report_id, p_decision, p_note); $$;

revoke all on function chat_private.submit_group_report(uuid, uuid, uuid, text, text) from public, anon;
revoke all on function chat_private.list_group_reports(uuid) from public, anon;
revoke all on function chat_private.get_my_group_reports(uuid) from public, anon;
revoke all on function chat_private.resolve_group_report(uuid, text, text) from public, anon;
grant execute on function chat_private.submit_group_report(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function chat_private.list_group_reports(uuid) to authenticated;
grant execute on function chat_private.get_my_group_reports(uuid) to authenticated;
grant execute on function chat_private.resolve_group_report(uuid, text, text) to authenticated;

revoke all on function public.chat_submit_group_report(uuid, uuid, uuid, text, text) from public, anon;
revoke all on function public.chat_list_group_reports(uuid) from public, anon;
revoke all on function public.chat_get_my_group_reports(uuid) from public, anon;
revoke all on function public.chat_resolve_group_report(uuid, text, text) from public, anon;
grant execute on function public.chat_submit_group_report(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.chat_list_group_reports(uuid) to authenticated;
grant execute on function public.chat_get_my_group_reports(uuid) to authenticated;
grant execute on function public.chat_resolve_group_report(uuid, text, text) to authenticated;

comment on table public.chat_group_reports is
  'Private group abuse reports; reporter identity is never returned to group moderators.';
comment on table public.chat_group_moderation_events is
  'Append-only audit trail for group report and moderation decisions.';
