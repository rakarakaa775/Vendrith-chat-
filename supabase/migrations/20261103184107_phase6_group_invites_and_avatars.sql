-- Phase 6: group invitations, private profile/group avatars, and explicit deletion rules.
-- Apply only to the isolated Vendrith Chat Non-Production project.

create table public.chat_group_invitations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint chat_group_invitations_distinct_users check (inviter_id <> invitee_id)
);
create unique index chat_group_invitations_pending_unique
  on public.chat_group_invitations(conversation_id, invitee_id) where status = 'pending';
create index chat_group_invitations_inbox_idx
  on public.chat_group_invitations(invitee_id, created_at desc) where status = 'pending';
create index chat_group_invitations_outbox_idx
  on public.chat_group_invitations(inviter_id, created_at desc) where status = 'pending';
alter table public.chat_group_invitations enable row level security;
revoke all on public.chat_group_invitations from public, anon, authenticated;

alter table public.chat_profiles add column if not exists avatar_path text;
alter table public.chat_conversations add column if not exists avatar_path text;
grant select (avatar_path) on public.chat_profiles to authenticated;
grant select (avatar_path) on public.chat_conversations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendrith-chat-avatars',
  'vendrith-chat-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vendrith_chat_avatar_read on storage.objects;
create policy vendrith_chat_avatar_read on storage.objects
for select to authenticated
using (
  bucket_id = 'vendrith-chat-avatars'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and (
        (storage.foldername(name))[2] = (select auth.uid())::text
        or exists (
          select 1 from public.chat_friendships f
          where (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and f.user_low = least((select auth.uid()), case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[2])::uuid else null end)
            and f.user_high = greatest((select auth.uid()), case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[2])::uuid else null end)
        )
      )
    )
    or (
      (storage.foldername(name))[1] = 'groups'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1 from public.chat_members m
        where m.conversation_id = case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[2])::uuid else null end
          and m.user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists vendrith_chat_avatar_upload on storage.objects;
create policy vendrith_chat_avatar_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'vendrith-chat-avatars'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'groups'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[3] = (select auth.uid())::text
      and exists (
        select 1 from public.chat_members m
        join public.chat_conversations c on c.id = m.conversation_id
        where m.conversation_id = case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[2])::uuid else null end
          and m.user_id = (select auth.uid())
          and m.role in ('owner', 'admin')
          and c.kind = 'group' and c.closed_at is null
      )
    )
  )
);

drop policy if exists vendrith_chat_avatar_delete on storage.objects;
create policy vendrith_chat_avatar_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'vendrith-chat-avatars'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'groups'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1 from public.chat_members m
        join public.chat_conversations c on c.id = m.conversation_id
        where m.conversation_id = case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[2])::uuid else null end
          and m.user_id = (select auth.uid())
          and m.role in ('owner', 'admin')
          and c.kind = 'group'
      )
    )
  )
);

create or replace function chat_private.set_profile_avatar(p_avatar_path text)
returns text
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
  if exists (select 1 from public.chat_profiles p where p.user_id = v_user_id and p.deleted_at is not null) then
    raise exception using errcode = '42501', message = 'deleted_account_cannot_restore_profile';
  end if;
  if p_avatar_path is not null and (
    p_avatar_path !~ ('^profiles/' || v_user_id::text || '/[A-Za-z0-9._-]+$')
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'vendrith-chat-avatars' and o.name = p_avatar_path
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_profile_avatar';
  end if;
  update public.chat_profiles
  set avatar_path = p_avatar_path, updated_at = now()
  where user_id = v_user_id and deleted_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'chat_profile_not_found';
  end if;
  return p_avatar_path;
end;
$$;

create or replace function public.chat_set_profile_avatar(p_avatar_path text)
returns text
language sql
security invoker
set search_path = ''
as $$ select chat_private.set_profile_avatar(p_avatar_path); $$;

revoke all on function chat_private.set_profile_avatar(text) from public, anon;
grant execute on function chat_private.set_profile_avatar(text) to authenticated;
revoke all on function public.chat_set_profile_avatar(text) from public, anon, authenticated;
grant execute on function public.chat_set_profile_avatar(text) to authenticated;

create or replace function chat_private.update_group_metadata(
  p_conversation_id uuid, p_title text, p_description text, p_avatar_url text default null
)
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
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 64
     or char_length(coalesce(p_description, '')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_group_metadata';
  end if;
  select m.role into v_role
  from public.chat_members m
  join public.chat_conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id and m.user_id = v_user_id
    and c.kind = 'group' and c.closed_at is null;
  if coalesce(v_role, '') not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'group_metadata_management_forbidden';
  end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://[^[:space:]]+$'
     and (
       p_avatar_url !~ ('^groups/' || p_conversation_id::text || '/' || v_user_id::text || '/[A-Za-z0-9._-]+$')
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'vendrith-chat-avatars' and o.name = p_avatar_url
       )
     ) then
    raise exception using errcode = '22023', message = 'invalid_group_avatar';
  end if;
  update public.chat_conversations
  set title = btrim(p_title),
      description = btrim(coalesce(p_description, '')),
      avatar_path = case when p_avatar_url like 'groups/%' then p_avatar_url else null end,
      avatar_url = case when p_avatar_url ~ '^https://[^[:space:]]+$' then p_avatar_url else null end
  where id = p_conversation_id and kind = 'group';
  return found;
end;
$$;
revoke all on function chat_private.update_group_metadata(uuid, text, text, text) from public, anon;
grant execute on function chat_private.update_group_metadata(uuid, text, text, text) to authenticated;

create or replace function chat_private.create_group_invitation(
  p_conversation_id uuid, p_invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_invitation_id uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_invitee_id is null or p_invitee_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_group_invitee';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('group-members:' || p_conversation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('group-invite:' || p_conversation_id::text || ':' || p_invitee_id::text, 0)
  );
  select m.role into v_role
  from public.chat_members m
  join public.chat_conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id and m.user_id = v_user_id
    and c.kind = 'group' and c.closed_at is null;
  if v_role is null or v_role not in ('owner', 'admin', 'moderator') then
    raise exception using errcode = '42501', message = 'group_invitation_forbidden';
  end if;
  if not exists (
    select 1 from auth.users u where u.id = p_invitee_id and coalesce(u.is_anonymous, false) = false
  ) or not exists (
    select 1 from public.chat_friendships f
    where f.user_low = least(v_user_id, p_invitee_id) and f.user_high = greatest(v_user_id, p_invitee_id)
  ) then
    raise exception using errcode = '42501', message = 'group_invitee_must_be_friend';
  end if;
  if exists (
    select 1 from public.chat_members m
    where m.conversation_id = p_conversation_id and m.user_id = p_invitee_id
  ) then
    raise exception using errcode = '23505', message = 'group_invitee_already_member';
  end if;
  if exists (
    select 1 from public.chat_blocks b
    join public.chat_members m
      on (b.blocker_id = m.user_id and b.blocked_id = p_invitee_id)
      or (b.blocker_id = p_invitee_id and b.blocked_id = m.user_id)
    where m.conversation_id = p_conversation_id
  ) then
    raise exception using errcode = '42501', message = 'group_invitee_conflicts_with_block';
  end if;
  if (select count(*) from public.chat_members where conversation_id = p_conversation_id)
     + (select count(*) from public.chat_group_invitations where conversation_id = p_conversation_id and status = 'pending') >= 100 then
    raise exception using errcode = '54000', message = 'group_member_limit_reached';
  end if;
  perform chat_private.enforce_rate_limit('group_invitation', 20, 3600);
  insert into public.chat_group_invitations(conversation_id, inviter_id, invitee_id)
  values (p_conversation_id, v_user_id, p_invitee_id)
  on conflict (conversation_id, invitee_id) where status = 'pending' do nothing
  returning id into v_invitation_id;
  if v_invitation_id is null then
    select id into v_invitation_id from public.chat_group_invitations
    where conversation_id = p_conversation_id and invitee_id = p_invitee_id and status = 'pending';
  else
    perform chat_private.create_notification(
      p_invitee_id, 'groups', 'group_invitation', 'Group invitation',
      'You have been invited to join a group conversation.', p_conversation_id, v_user_id, v_invitation_id
    );
  end if;
  return v_invitation_id;
end;
$$;

create or replace function chat_private.list_group_invitations()
returns table(
  invitation_id uuid, conversation_id uuid, group_title text, group_description text,
  inviter_id uuid, inviter_username text, inviter_display_name text,
  invitee_id uuid, invitee_username text, invitee_display_name text,
  direction text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  return query
  select i.id, i.conversation_id, coalesce(c.title, 'Untitled group'), coalesce(c.description, ''),
    i.inviter_id, coalesce(ip.username, 'player'), coalesce(ip.display_name, 'Vendrith player'),
    i.invitee_id, coalesce(ep.username, 'player'), coalesce(ep.display_name, 'Vendrith player'),
    case when i.invitee_id = v_user_id then 'incoming' else 'outgoing' end, i.created_at
  from public.chat_group_invitations i
  join public.chat_conversations c on c.id = i.conversation_id and c.kind = 'group'
  left join public.chat_profiles ip on ip.user_id = i.inviter_id
  left join public.chat_profiles ep on ep.user_id = i.invitee_id
  where i.status = 'pending'
    and (i.invitee_id = v_user_id or (i.inviter_id = v_user_id and exists (
      select 1 from public.chat_members m where m.conversation_id = i.conversation_id and m.user_id = v_user_id
    )))
  order by i.created_at desc;
end;
$$;

create or replace function chat_private.respond_group_invitation(p_invitation_id uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.chat_group_invitations;
  v_inviter_role text;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  select * into v_invitation from public.chat_group_invitations
  where id = p_invitation_id and invitee_id = v_user_id and status = 'pending'
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'group_invitation_not_available';
  end if;
  if p_accept then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('group-members:' || v_invitation.conversation_id::text, 0)
    );
    select m.role into v_inviter_role from public.chat_members m
    join public.chat_conversations c on c.id = m.conversation_id
    where m.conversation_id = v_invitation.conversation_id
      and m.user_id = v_invitation.inviter_id and c.closed_at is null;
    if v_inviter_role is null then
      raise exception using errcode = '55000', message = 'group_invitation_no_longer_valid';
    end if;
    if not exists (
      select 1 from public.chat_friendships f
      where f.user_low = least(v_user_id, v_invitation.inviter_id)
        and f.user_high = greatest(v_user_id, v_invitation.inviter_id)
    ) or exists (
      select 1 from public.chat_blocks b
      join public.chat_members m
        on (b.blocker_id = m.user_id and b.blocked_id = v_user_id)
        or (b.blocker_id = v_user_id and b.blocked_id = m.user_id)
      where m.conversation_id = v_invitation.conversation_id
    ) then
      raise exception using errcode = '42501', message = 'group_invitation_relationship_changed';
    end if;
    if (select count(*) from public.chat_members where conversation_id = v_invitation.conversation_id) >= 100 then
      raise exception using errcode = '54000', message = 'group_member_limit_reached';
    end if;
    insert into public.chat_members(conversation_id, user_id, role, added_by)
    values (v_invitation.conversation_id, v_user_id, 'member', v_invitation.inviter_id)
    on conflict (conversation_id, user_id) do nothing;
    if not found then
      raise exception using errcode = '23505', message = 'group_invitee_already_member';
    end if;
  end if;
  update public.chat_group_invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = clock_timestamp()
  where id = p_invitation_id;
  perform chat_private.create_notification(
    v_invitation.inviter_id, 'groups',
    case when p_accept then 'group_invitation_accepted' else 'group_invitation_declined' end,
    case when p_accept then 'Invitation accepted' else 'Invitation declined' end,
    case when p_accept then 'Your group invitation was accepted.' else 'Your group invitation was declined.' end,
    v_invitation.conversation_id, v_user_id, p_invitation_id
  );
  return true;
end;
$$;

create or replace function chat_private.cancel_group_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.chat_group_invitations;
  v_role text;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  select * into v_invitation from public.chat_group_invitations
  where id = p_invitation_id and status = 'pending' for update;
  if not found then return false; end if;
  select m.role into v_role from public.chat_members m
  where m.conversation_id = v_invitation.conversation_id and m.user_id = v_user_id;
  if v_invitation.inviter_id <> v_user_id and coalesce(v_role, '') not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'group_invitation_cancel_forbidden';
  end if;
  update public.chat_group_invitations set status = 'cancelled', responded_at = clock_timestamp()
  where id = p_invitation_id;
  return true;
end;
$$;

create or replace function chat_private.cancel_group_invitations_on_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.closed_at is null and new.closed_at is not null then
    update public.chat_group_invitations
    set status = 'cancelled', responded_at = clock_timestamp()
    where conversation_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
create trigger chat_group_invitation_cancel_on_close
after update of closed_at on public.chat_conversations
for each row execute function chat_private.cancel_group_invitations_on_close();

create or replace function public.chat_create_group_invitation(p_conversation_id uuid, p_invitee_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select chat_private.create_group_invitation(p_conversation_id, p_invitee_id); $$;
create or replace function public.chat_list_group_invitations()
returns table(
  invitation_id uuid, conversation_id uuid, group_title text, group_description text,
  inviter_id uuid, inviter_username text, inviter_display_name text,
  invitee_id uuid, invitee_username text, invitee_display_name text,
  direction text, created_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from chat_private.list_group_invitations(); $$;
create or replace function public.chat_respond_group_invitation(p_invitation_id uuid, p_accept boolean)
returns boolean language sql security invoker set search_path = ''
as $$ select chat_private.respond_group_invitation(p_invitation_id, p_accept); $$;
create or replace function public.chat_cancel_group_invitation(p_invitation_id uuid)
returns boolean language sql security invoker set search_path = ''
as $$ select chat_private.cancel_group_invitation(p_invitation_id); $$;

revoke all on function chat_private.create_group_invitation(uuid, uuid) from public, anon;
revoke all on function chat_private.list_group_invitations() from public, anon;
revoke all on function chat_private.respond_group_invitation(uuid, boolean) from public, anon;
revoke all on function chat_private.cancel_group_invitation(uuid) from public, anon;
revoke all on function chat_private.cancel_group_invitations_on_close() from public, anon, authenticated;
grant execute on function chat_private.create_group_invitation(uuid, uuid) to authenticated;
grant execute on function chat_private.list_group_invitations() to authenticated;
grant execute on function chat_private.respond_group_invitation(uuid, boolean) to authenticated;
grant execute on function chat_private.cancel_group_invitation(uuid) to authenticated;

revoke all on function public.chat_create_group_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.chat_list_group_invitations() from public, anon, authenticated;
revoke all on function public.chat_respond_group_invitation(uuid, boolean) from public, anon, authenticated;
revoke all on function public.chat_cancel_group_invitation(uuid) from public, anon, authenticated;
grant execute on function public.chat_create_group_invitation(uuid, uuid) to authenticated;
grant execute on function public.chat_list_group_invitations() to authenticated;
grant execute on function public.chat_respond_group_invitation(uuid, boolean) to authenticated;
grant execute on function public.chat_cancel_group_invitation(uuid) to authenticated;

comment on table public.chat_group_invitations is
  'Private pending/accepted/declined/cancelled invitations. Access is only through participant-scoped RPCs.';
comment on column public.chat_profiles.avatar_path is
  'Object path in the private vendrith-chat-avatars bucket; only the owner and accepted friends can read it.';
comment on column public.chat_conversations.avatar_path is
  'Object path in the private vendrith-chat-avatars bucket; only current group members can read it.';
comment on table public.chat_conversations is
  'Group deletion policy: groups are closed, not hard-deleted, so members retain shared history and moderation evidence. Avatar objects may be explicitly removed by an authorized owner/admin.';

-- Serialize group closure against pending invitation acceptance and member additions.
create or replace function chat_private.close_group(p_conversation_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_closed_at timestamptz;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('group-members:' || p_conversation_id::text, 0)
  );
  if not exists (
    select 1 from public.chat_members
    where conversation_id = p_conversation_id and user_id = v_user_id and role = 'owner'
  ) or not exists (
    select 1 from public.chat_conversations
    where id = p_conversation_id and kind = 'group'
  ) then
    raise exception using errcode = '42501', message = 'only_group_owner_can_close_group';
  end if;
  update public.chat_conversations
  set closed_at = coalesce(closed_at, clock_timestamp()), closed_by = v_user_id
  where id = p_conversation_id
  returning closed_at into v_closed_at;
  return v_closed_at;
end;
$$;

-- All new members must accept a pending invitation; disable the legacy direct-add RPC.
revoke all on function chat_private.add_group_member(uuid, uuid) from authenticated;
revoke all on function public.chat_add_group_member(uuid, uuid) from public, anon, authenticated;

create or replace function chat_private.list_friend_avatar_paths()
returns table(friend_user_id uuid, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  return query
  select case when f.user_low = v_user_id then f.user_high else f.user_low end, p.avatar_path
  from public.chat_friendships f
  join public.chat_profiles p
    on p.user_id = case when f.user_low = v_user_id then f.user_high else f.user_low end
  where (f.user_low = v_user_id or f.user_high = v_user_id)
    and p.avatar_path is not null and p.deleted_at is null;
end;
$$;
create or replace function public.chat_list_friend_avatar_paths()
returns table(friend_user_id uuid, avatar_path text)
language sql stable security invoker set search_path = ''
as $$ select * from chat_private.list_friend_avatar_paths(); $$;
revoke all on function chat_private.list_friend_avatar_paths() from public, anon;
grant execute on function chat_private.list_friend_avatar_paths() to authenticated;
revoke all on function public.chat_list_friend_avatar_paths() from public, anon, authenticated;
grant execute on function public.chat_list_friend_avatar_paths() to authenticated;

create or replace function chat_private.cancel_group_invitations_on_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_invite record;
begin
  if old.closed_at is null and new.closed_at is not null then
    for v_invite in
      update public.chat_group_invitations
      set status = 'cancelled', responded_at = clock_timestamp()
      where conversation_id = new.id and status = 'pending'
      returning invitee_id, id
    loop
      perform chat_private.create_notification(
        v_invite.invitee_id, 'groups', 'group_invitation_cancelled',
        'Group invitation cancelled', 'The group was closed before you joined.',
        new.id, new.closed_by, v_invite.id
      );
    end loop;
  end if;
  return new;
end;
$$;

create or replace function chat_private.cancel_group_invitations_on_member_exit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_invite record;
begin
  for v_invite in
    update public.chat_group_invitations
    set status = 'cancelled', responded_at = clock_timestamp()
    where conversation_id = old.conversation_id
      and inviter_id = old.user_id and status = 'pending'
    returning invitee_id, id
  loop
    perform chat_private.create_notification(
      v_invite.invitee_id, 'groups', 'group_invitation_cancelled',
      'Group invitation cancelled', 'The inviter is no longer a member of the group.',
      old.conversation_id, old.user_id, v_invite.id
    );
  end loop;
  return old;
end;
$$;
create trigger chat_group_invitation_cancel_on_inviter_exit
 after delete on public.chat_members
 for each row execute function chat_private.cancel_group_invitations_on_member_exit();

create or replace function chat_private.cancel_group_invitations_on_friendship_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_invite record;
begin
  for v_invite in
    update public.chat_group_invitations
    set status = 'cancelled', responded_at = clock_timestamp()
    where status = 'pending'
      and ((inviter_id = old.user_low and invitee_id = old.user_high)
        or (inviter_id = old.user_high and invitee_id = old.user_low))
    returning conversation_id, invitee_id, id
  loop
    perform chat_private.create_notification(
      v_invite.invitee_id, 'groups', 'group_invitation_cancelled',
      'Group invitation cancelled', 'The friendship ended before you joined.',
      v_invite.conversation_id, (select auth.uid()), v_invite.id
    );
  end loop;
  return old;
end;
$$;
create trigger chat_group_invitation_cancel_on_friendship_end
 after delete on public.chat_friendships
 for each row execute function chat_private.cancel_group_invitations_on_friendship_end();
revoke all on function chat_private.cancel_group_invitations_on_member_exit() from public, anon, authenticated;
revoke all on function chat_private.cancel_group_invitations_on_friendship_end() from public, anon, authenticated;

create or replace function chat_private.list_friend_avatar_paths()
returns table(friend_user_id uuid, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  return query
  select case when f.user_low = v_user_id then f.user_high else f.user_low end, p.avatar_path
  from public.chat_friendships f
  join public.chat_profiles p
    on p.user_id = case when f.user_low = v_user_id then f.user_high else f.user_low end
  where (f.user_low = v_user_id or f.user_high = v_user_id)
    and p.avatar_path is not null and p.deleted_at is null;
end;
$$;
create or replace function public.chat_list_friend_avatar_paths()
returns table(friend_user_id uuid, avatar_path text)
language sql stable security invoker set search_path = ''
as $$ select * from chat_private.list_friend_avatar_paths(); $$;
revoke all on function chat_private.list_friend_avatar_paths() from public, anon;
grant execute on function chat_private.list_friend_avatar_paths() to authenticated;
revoke all on function public.chat_list_friend_avatar_paths() from public, anon, authenticated;
grant execute on function public.chat_list_friend_avatar_paths() to authenticated;

-- Per-player control over incoming friend requests; enabled by default for compatibility.
alter table public.chat_profiles
  add column if not exists allow_friend_requests boolean not null default true;

drop function if exists public.chat_search_users(text, integer);
drop function if exists chat_private.search_users(text, integer);

create function chat_private.search_users(p_query text, p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, accepts_friend_requests boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if char_length(v_query) < 3 or char_length(v_query) > 32 or v_query !~ '^[[:alnum:]_ ]+$' then
    raise exception using errcode = '22023', message = 'invalid_user_search_query';
  end if;
  perform chat_private.enforce_rate_limit('profile_search', 30, 60);
  return query
  select profile.user_id, profile.username, profile.display_name,
    coalesce(profile.allow_friend_requests, true)
  from public.chat_profiles profile
  where profile.user_id <> v_user_id
    and profile.discoverable
    and (
      profile.username like v_query || '%'
      or pg_catalog.strpos(lower(profile.display_name), v_query) > 0
    )
    and not exists (
      select 1 from public.chat_blocks block_row
      where (block_row.blocker_id = v_user_id and block_row.blocked_id = profile.user_id)
         or (block_row.blocker_id = profile.user_id and block_row.blocked_id = v_user_id)
    )
  order by profile.username
  limit v_limit;
end;
$$;

create function public.chat_search_users(p_query text, p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, accepts_friend_requests boolean)
language sql
security invoker
set search_path = ''
as $$ select * from chat_private.search_users(p_query, p_limit); $$;

create or replace function chat_private.send_friend_request(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request_id uuid;
  v_pair_low uuid;
  v_pair_high uuid;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend_request_recipient';
  end if;
  if not exists (
    select 1 from public.chat_profiles profile
    join auth.users target_user on target_user.id = profile.user_id
    where profile.user_id = p_recipient_id
      and profile.discoverable
      and coalesce(profile.allow_friend_requests, true)
      and coalesce(target_user.is_anonymous, false) = false
  ) then
    raise exception using errcode = '22023', message = 'friend_request_recipient_not_found';
  end if;
  v_pair_low := least(v_user_id, p_recipient_id);
  v_pair_high := greatest(v_user_id, p_recipient_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_pair_low::text || ':' || v_pair_high::text, 0));
  if exists (
    select 1 from public.chat_blocks block_row
    where (block_row.blocker_id = v_user_id and block_row.blocked_id = p_recipient_id)
       or (block_row.blocker_id = p_recipient_id and block_row.blocked_id = v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'friend_request_blocked';
  end if;
  if exists (select 1 from public.chat_friendships f where f.user_low = v_pair_low and f.user_high = v_pair_high) then
    raise exception using errcode = '23505', message = 'already_friends';
  end if;
  select r.id into v_request_id from public.chat_friend_requests r
  where r.sender_id = v_user_id and r.recipient_id = p_recipient_id and r.status = 'pending';
  if v_request_id is not null then return v_request_id; end if;
  if exists (
    select 1 from public.chat_friend_requests r
    where r.sender_id = p_recipient_id and r.recipient_id = v_user_id and r.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'incoming_friend_request_exists';
  end if;
  perform chat_private.enforce_rate_limit('send_friend_request', 20, 86400);
  insert into public.chat_friend_requests(sender_id, recipient_id)
  values(v_user_id, p_recipient_id) returning id into v_request_id;
  return v_request_id;
end;
$$;

create function chat_private.set_friend_request_privacy(p_allow boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  update public.chat_profiles
  set allow_friend_requests = coalesce(p_allow, false), updated_at = now()
  where user_id = v_user_id and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'chat_profile_not_found'; end if;
  return coalesce(p_allow, false);
end;
$$;
create function public.chat_set_friend_request_privacy(p_allow boolean)
returns boolean language sql security invoker set search_path = ''
as $$ select chat_private.set_friend_request_privacy(p_allow); $$;

revoke all on function chat_private.search_users(text, integer) from public, anon;
grant execute on function chat_private.search_users(text, integer) to authenticated;
revoke all on function public.chat_search_users(text, integer) from public, anon, authenticated;
grant execute on function public.chat_search_users(text, integer) to authenticated;
revoke all on function chat_private.set_friend_request_privacy(boolean) from public, anon;
grant execute on function chat_private.set_friend_request_privacy(boolean) to authenticated;
revoke all on function public.chat_set_friend_request_privacy(boolean) from public, anon, authenticated;
grant execute on function public.chat_set_friend_request_privacy(boolean) to authenticated;