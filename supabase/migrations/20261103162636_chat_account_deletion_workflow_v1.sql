-- Durable, service-role-only account deletion state.
create table if not exists public.chat_account_deletion_jobs (
  user_id uuid primary key,
  status text not null default 'processing'
    check (status in ('processing', 'blocked', 'failed', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);

alter table public.chat_account_deletion_jobs enable row level security;
revoke all on table public.chat_account_deletion_jobs from public, anon, authenticated;
grant all on table public.chat_account_deletion_jobs to service_role;
comment on table public.chat_account_deletion_jobs is
  'Minimal operational receipt/state for retryable account deletion. Never readable by client roles.';

-- A tombstone must continue to resolve senders from historical messages even after
-- their chat_members rows are removed to revoke their access to conversation data.
create or replace function chat_private.get_conversation_profiles(p_conversation_ids uuid[])
returns table(
  conversation_id uuid,
  user_id uuid,
  username text,
  display_name text
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
  if coalesce(cardinality(p_conversation_ids), 0) > 100 then
    raise exception using errcode = '22023', message = 'too_many_conversations';
  end if;

  return query
  with participants as (
    select m.conversation_id, m.user_id
    from public.chat_members m
    where m.conversation_id = any(coalesce(p_conversation_ids, '{}'::uuid[]))
    union
    select msg.conversation_id, msg.sender_id
    from public.chat_messages msg
    where msg.conversation_id = any(coalesce(p_conversation_ids, '{}'::uuid[]))
  )
  select p.conversation_id,
         p.user_id,
         case when profile.deleted_at is not null then null else profile.username end,
         case when profile.deleted_at is not null then 'Deleted account'
              else coalesce(profile.display_name, 'Vendrith Player') end
  from participants p
  left join public.chat_profiles profile on profile.user_id = p.user_id
  where exists (
    select 1 from public.chat_members caller_membership
    where caller_membership.conversation_id = p.conversation_id
      and caller_membership.user_id = v_user_id
  );
end;
$$;

create or replace function public.chat_get_conversation_profiles(p_conversation_ids uuid[])
returns table(
  conversation_id uuid,
  user_id uuid,
  username text,
  display_name text
)
language sql
security invoker
set search_path = ''
as $$
  select * from chat_private.get_conversation_profiles(p_conversation_ids);
$$;

revoke all on function chat_private.get_conversation_profiles(uuid[]) from public, anon;
grant execute on function chat_private.get_conversation_profiles(uuid[]) to authenticated;
revoke all on function public.chat_get_conversation_profiles(uuid[]) from public, anon;
grant execute on function public.chat_get_conversation_profiles(uuid[]) to authenticated;

-- Prevent a still-valid, short-lived JWT from restoring a tombstoned public profile.
create or replace function chat_private.upsert_profile(
  p_username text,
  p_display_name text,
  p_discoverable boolean default false
)
returns public.chat_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_profile public.chat_profiles;
begin
  if v_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '28000', message = 'authenticated_player_required';
  end if;
  if exists (select 1 from public.chat_profiles p where p.user_id = v_user_id and p.deleted_at is not null) then
    raise exception using errcode = '42501', message = 'deleted_account_cannot_restore_profile';
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' or char_length(v_display_name) not between 1 and 32 then
    raise exception using errcode = '22023', message = 'invalid_chat_profile';
  end if;
  perform chat_private.enforce_rate_limit('profile_update', 5, 3600);
  insert into public.chat_profiles (user_id, username, display_name, discoverable)
  values (v_user_id, v_username, v_display_name, coalesce(p_discoverable, false))
  on conflict (user_id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        discoverable = excluded.discoverable,
        updated_at = now()
  returning * into v_profile;
  return v_profile;
end;
$$;

revoke all on function chat_private.upsert_profile(text, text, boolean) from public, anon;
grant execute on function chat_private.upsert_profile(text, text, boolean) to authenticated;