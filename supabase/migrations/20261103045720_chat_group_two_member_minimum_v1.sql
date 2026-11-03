-- Allow a group with the creator and one accepted friend so two-account browser QA can exercise group messaging.
-- Group role and membership authorization remains unchanged.

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
     or v_count < 1 or v_count > 99
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
