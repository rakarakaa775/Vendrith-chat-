-- Vendrith Chat Phase 6: group conversations and membership authorization.
-- Apply ONLY to the isolated Vendrith Chat Non-Production project.
-- Direct-message history and IDs are preserved; group membership is enforced server-side.

alter table public.chat_conversations
  drop constraint if exists chat_conversations_kind_check,
  alter column direct_key drop not null,
  add column if not exists title text;

alter table public.chat_conversations
  add constraint chat_conversations_kind_check
    check (kind in ('direct', 'group')),
  add constraint chat_conversations_title_length_check
    check (title is null or char_length(btrim(title)) between 1 and 64);

alter table public.chat_conversations
  drop constraint if exists chat_conversations_direct_key_key;

create unique index if not exists chat_conversations_direct_key_unique_idx
  on public.chat_conversations (direct_key)
  where direct_key is not null;

create index if not exists chat_conversations_group_created_idx
  on public.chat_conversations (created_at desc)
  where kind = 'group';

alter table public.chat_members
  add column if not exists role text not null default 'member',
  add column if not exists added_by uuid references auth.users(id) on delete set null;

alter table public.chat_members
  add constraint chat_members_role_check
  check (role in ('owner', 'admin', 'moderator', 'member'));

grant select (role, added_by) on public.chat_members to authenticated;
grant select (title) on public.chat_conversations to authenticated;

-- Keep the direct-message API compatible with the new partial unique index.
create or replace function chat_private.create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_direct_key text;
  v_conversation_id uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_direct_message_recipient';
  end if;

  v_direct_key := least(v_user_id::text, p_other_user_id::text) || ':' ||
                  greatest(v_user_id::text, p_other_user_id::text);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_direct_key, 0)
  );

  if not exists (
    select 1 from auth.users target_user
    where target_user.id = p_other_user_id
      and coalesce(target_user.is_anonymous, false) = false
  ) then
    raise exception using errcode = '22023', message = 'direct_message_recipient_not_found';
  end if;

  if exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_user_id and block_row.blocked_id = p_other_user_id)
       or (block_row.blocker_id = p_other_user_id and block_row.blocked_id = v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'direct_conversation_blocked';
  end if;

  select conversation.id into v_conversation_id
  from public.chat_conversations conversation
  where conversation.direct_key = v_direct_key;

  if v_conversation_id is null then
    perform chat_private.enforce_rate_limit('create_direct_conversation', 10, 3600);
    insert into public.chat_conversations (kind, direct_key, created_by)
    values ('direct', v_direct_key, v_user_id)
    on conflict (direct_key) where direct_key is not null do nothing;

    select conversation.id into v_conversation_id
    from public.chat_conversations conversation
    where conversation.direct_key = v_direct_key;
  end if;

  insert into public.chat_members (conversation_id, user_id, role, added_by)
  values (v_conversation_id, v_user_id, 'member', v_user_id),
         (v_conversation_id, p_other_user_id, 'member', v_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function chat_private.create_group_conversation(
  p_title text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_member_ids uuid[];
  v_conversation_id uuid;
  v_count integer;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;

  select coalesce(array_agg(member_id order by member_id), '{}'::uuid[])
    into v_member_ids
  from (
    select distinct member_id
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
    where member_id is not null
  ) selected;

  v_count := cardinality(v_member_ids);
  if char_length(v_title) not between 1 and 64
     or v_count < 2 or v_count > 99
     or cardinality(coalesce(p_member_ids, '{}'::uuid[])) <> v_count then
    raise exception using errcode = '22023', message = 'invalid_group_conversation_payload';
  end if;

  if exists (
    select 1 from unnest(v_member_ids) target_id
    where target_id = v_user_id
       or not exists (
         select 1 from auth.users target_user
         where target_user.id = target_id
           and coalesce(target_user.is_anonymous, false) = false
       )
       or not exists (
         select 1 from public.chat_friendships friendship
         where (friendship.user_low = least(v_user_id, target_id)
            and friendship.user_high = greatest(v_user_id, target_id))
       )
       or exists (
         select 1 from public.chat_blocks block_row
         where (block_row.blocker_id = v_user_id and block_row.blocked_id = target_id)
            or (block_row.blocker_id = target_id and block_row.blocked_id = v_user_id)
       )
  ) then
    raise exception using errcode = '42501', message = 'group_members_must_be_unblocked_friends';
  end if;

  if exists (
    select 1
    from unnest(v_member_ids) first_member
    join unnest(v_member_ids) second_member on first_member < second_member
    join public.chat_blocks block_row
      on (block_row.blocker_id = first_member and block_row.blocked_id = second_member)
      or (block_row.blocker_id = second_member and block_row.blocked_id = first_member)
  ) then
    raise exception using errcode = '42501', message = 'group_members_have_blocked_relationship';
  end if;

  perform chat_private.enforce_rate_limit('create_direct_conversation', 5, 3600);

  insert into public.chat_conversations (kind, direct_key, title, created_by)
  values ('group', null, v_title, v_user_id)
  returning id into v_conversation_id;

  insert into public.chat_members (conversation_id, user_id, role, added_by)
  values (v_conversation_id, v_user_id, 'owner', v_user_id);

  insert into public.chat_members (conversation_id, user_id, role, added_by)
  select v_conversation_id, member_id, 'member', v_user_id
  from unnest(v_member_ids) member_id;

  return v_conversation_id;
end;
$$;

create or replace function chat_private.add_group_member(
  p_conversation_id uuid,
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_actor_role text;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_member_id is null or p_member_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_group_member';
  end if;

  select member_row.role into v_actor_role
  from public.chat_members member_row
  join public.chat_conversations conversation
    on conversation.id = member_row.conversation_id
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = v_user_id
    and conversation.kind = 'group';

  if v_actor_role is null or v_actor_role not in ('owner', 'admin', 'moderator') then
    raise exception using errcode = '42501', message = 'group_member_management_forbidden';
  end if;

  if not exists (
    select 1 from auth.users target_user
    where target_user.id = p_member_id
      and coalesce(target_user.is_anonymous, false) = false
  ) or not exists (
    select 1 from public.chat_friendships friendship
    where friendship.user_low = least(v_user_id, p_member_id)
      and friendship.user_high = greatest(v_user_id, p_member_id)
  ) or exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_user_id and block_row.blocked_id = p_member_id)
       or (block_row.blocker_id = p_member_id and block_row.blocked_id = v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'group_member_must_be_unblocked_friend';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('group-members:' || p_conversation_id::text, 0)
  );

  if (select count(*) from public.chat_members where conversation_id = p_conversation_id) >= 100 then
    raise exception using errcode = '54000', message = 'group_member_limit_reached';
  end if;

  if exists (
    select 1
    from public.chat_members existing_member
    join public.chat_blocks block_row
      on (block_row.blocker_id = existing_member.user_id and block_row.blocked_id = p_member_id)
      or (block_row.blocker_id = p_member_id and block_row.blocked_id = existing_member.user_id)
    where existing_member.conversation_id = p_conversation_id
  ) then
    raise exception using errcode = '42501', message = 'group_member_conflicts_with_block';
  end if;

  insert into public.chat_members (conversation_id, user_id, role, added_by)
  values (p_conversation_id, p_member_id, 'member', v_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return found;
end;
$$;

create or replace function chat_private.remove_group_member(
  p_conversation_id uuid,
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_actor_role text;
  v_target_role text;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_member_id is null or p_member_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_group_member';
  end if;

  select member_row.role into v_actor_role
  from public.chat_members member_row
  join public.chat_conversations conversation on conversation.id = member_row.conversation_id
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = v_user_id
    and conversation.kind = 'group';

  select member_row.role into v_target_role
  from public.chat_members member_row
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = p_member_id;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin', 'moderator')
     or v_target_role is null then
    raise exception using errcode = '42501', message = 'group_member_management_forbidden';
  end if;

  if v_actor_role = 'moderator' and v_target_role <> 'member' then
    raise exception using errcode = '42501', message = 'moderators_can_remove_members_only';
  end if;
  if v_actor_role = 'admin' and v_target_role in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'admin_cannot_remove_owner_or_admin';
  end if;
  if v_target_role = 'owner' then
    raise exception using errcode = '42501', message = 'group_owner_cannot_be_removed';
  end if;

  delete from public.chat_members
  where conversation_id = p_conversation_id and user_id = p_member_id;
  return found;
end;
$$;

create or replace function chat_private.leave_group(p_conversation_id uuid)
returns boolean
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
  join public.chat_conversations conversation on conversation.id = member_row.conversation_id
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = v_user_id
    and conversation.kind = 'group';

  if v_role is null then
    raise exception using errcode = '42501', message = 'group_membership_required';
  end if;
  if v_role = 'owner' then
    raise exception using errcode = '42501', message = 'transfer_group_ownership_before_leaving';
  end if;

  delete from public.chat_members
  where conversation_id = p_conversation_id and user_id = v_user_id;
  return found;
end;
$$;

create or replace function chat_private.set_group_member_role(
  p_conversation_id uuid,
  p_member_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_actor_role text;
  v_target_role text;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_member_id is null or p_member_id = v_user_id
     or p_role not in ('owner', 'admin', 'moderator', 'member') then
    raise exception using errcode = '22023', message = 'invalid_group_role_change';
  end if;

  select member_row.role into v_actor_role
  from public.chat_members member_row
  join public.chat_conversations conversation on conversation.id = member_row.conversation_id
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = v_user_id
    and conversation.kind = 'group';

  select member_row.role into v_target_role
  from public.chat_members member_row
  where member_row.conversation_id = p_conversation_id
    and member_row.user_id = p_member_id;

  if coalesce(v_actor_role, '') <> 'owner' or v_target_role is null then
    raise exception using errcode = '42501', message = 'only_group_owner_can_change_roles';
  end if;

  if v_target_role = 'owner' then
    raise exception using errcode = '42501', message = 'group_owner_role_transfer_required';
  end if;

  if p_role = 'owner' then
    update public.chat_members
    set role = 'admin'
    where conversation_id = p_conversation_id and user_id = v_user_id;
  end if;

  update public.chat_members
  set role = p_role
  where conversation_id = p_conversation_id and user_id = p_member_id;
  return found;
end;
$$;

create or replace function public.chat_create_group_conversation(
  p_title text,
  p_member_ids uuid[]
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select chat_private.create_group_conversation(p_title, p_member_ids); $$;

create or replace function public.chat_add_group_member(
  p_conversation_id uuid,
  p_member_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.add_group_member(p_conversation_id, p_member_id); $$;

create or replace function public.chat_remove_group_member(
  p_conversation_id uuid,
  p_member_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.remove_group_member(p_conversation_id, p_member_id); $$;

create or replace function public.chat_leave_group(p_conversation_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.leave_group(p_conversation_id); $$;

create or replace function public.chat_set_group_member_role(
  p_conversation_id uuid,
  p_member_id uuid,
  p_role text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select chat_private.set_group_member_role(p_conversation_id, p_member_id, p_role); $$;

revoke all on function chat_private.create_group_conversation(text, uuid[]) from public, anon;
revoke all on function chat_private.add_group_member(uuid, uuid) from public, anon;
revoke all on function chat_private.remove_group_member(uuid, uuid) from public, anon;
revoke all on function chat_private.leave_group(uuid) from public, anon;
revoke all on function chat_private.set_group_member_role(uuid, uuid, text) from public, anon;

grant execute on function chat_private.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function chat_private.add_group_member(uuid, uuid) to authenticated;
grant execute on function chat_private.remove_group_member(uuid, uuid) to authenticated;
grant execute on function chat_private.leave_group(uuid) to authenticated;
grant execute on function chat_private.set_group_member_role(uuid, uuid, text) to authenticated;

revoke all on function public.chat_create_group_conversation(text, uuid[]) from public, anon;
revoke all on function public.chat_add_group_member(uuid, uuid) from public, anon;
revoke all on function public.chat_remove_group_member(uuid, uuid) from public, anon;
revoke all on function public.chat_leave_group(uuid) from public, anon;
revoke all on function public.chat_set_group_member_role(uuid, uuid, text) from public, anon;

grant execute on function public.chat_create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.chat_add_group_member(uuid, uuid) to authenticated;
grant execute on function public.chat_remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.chat_leave_group(uuid) to authenticated;
grant execute on function public.chat_set_group_member_role(uuid, uuid, text) to authenticated;

comment on table public.chat_conversations is
  'Vendrith Chat direct and group conversations; access is restricted by active membership.';
comment on function public.chat_create_group_conversation(text, uuid[]) is
  'Creates a group with the caller as owner and selected accepted, unblocked friends as members.';
comment on function public.chat_set_group_member_role(uuid, uuid, text) is
  'Only the current group owner can change member roles or transfer ownership.';
