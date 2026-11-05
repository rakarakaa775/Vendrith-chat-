-- CATALOG-RECONSTRUCTED on 2026-11-05 for recorded migration version 20261104151218.
-- Draft source was version-mismatched in a local worktree; its definitions were compared
-- with current Non-Production catalog columns, constraints, indexes, RLS, grants, and RPCs.
-- This is not claimed to be the original historical SQL body.
-- Validate only on a disposable clean database; never replay on the existing project.

alter table public.chat_account_deletion_jobs
  alter column status set default 'queued',
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid;

alter table public.chat_account_deletion_jobs
  drop constraint if exists chat_account_deletion_jobs_status_check;
alter table public.chat_account_deletion_jobs
  add constraint chat_account_deletion_jobs_status_check
  check (status in ('queued', 'processing', 'blocked', 'failed', 'completed'));

create index if not exists chat_account_deletion_jobs_claim_idx
  on public.chat_account_deletion_jobs (next_attempt_at, requested_at)
  where status in ('queued', 'failed');

create table if not exists public.chat_data_export_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  row_counts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(row_counts) = 'object')
);
alter table public.chat_data_export_events enable row level security;
revoke all on table public.chat_data_export_events from public, anon, authenticated;
grant all on table public.chat_data_export_events to service_role;
create index if not exists chat_data_export_events_user_created_idx
  on public.chat_data_export_events (user_id, created_at desc);
comment on table public.chat_data_export_events is
  'Service-role-only, content-free audit receipts for personal data exports.';

-- This read-only guard protects Auth identities shared with the World app.
-- Missing World tables/columns are ignored; existing references block deletion.
create or replace function chat_private.chat_deletion_world_reference_tables(p_user_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_column text;
  v_found boolean;
  v_matches text[] := '{}'::text[];
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user_id_required';
  end if;
  for v_table, v_column in
    select * from (values
      ('ai_improvement_evaluations','owner_id'), ('ai_improvement_proposals','owner_id'),
      ('asset_license_registry','created_by'), ('asset_registry','created_by'),
      ('asset_sources','created_by'), ('audit_logs','user_id'), ('buildings','owner_id'),
      ('containers','owner_id'), ('devices','user_id'), ('editor_map_identity','created_by'),
      ('editor_map_interior','created_by'), ('editor_map_versions','created_by'),
      ('map_editor_clipboards','user_id'), ('map_editor_command_groups','user_id'),
      ('map_editor_gizmo_sessions','user_id'), ('map_editor_runtime_snapshots','created_by'),
      ('map_editor_save_slots','created_by'), ('map_editor_selections','user_id'),
      ('map_versions','created_by'), ('maps','created_by'), ('notifications','user_id'),
      ('npc_creator_runtime_contract_overrides','created_by'), ('profiles','user_id'),
      ('sessions','user_id'), ('settings','user_id'), ('user_lives','user_id'),
      ('user_roles','user_id'), ('vandrith_map_editor_clipboard','user_id'),
      ('vandrith_map_editor_command_groups','user_id'), ('vandrith_map_editor_duplicate_groups','user_id'),
      ('vandrith_map_editor_gizmo_sessions','user_id'), ('vandrith_map_editor_selection','user_id'),
      ('vandrith_map_editor_transform_groups','user_id'), ('vendrith_ai_sessions','user_id'),
      ('vendrith_ai_messages','user_id'), ('vendrith_creator_action_proposals','user_id'),
      ('vendrith_runtime_intents','user_id'), ('world_runtime_leases','user_id'),
      ('world_runtime_mutation_log','user_id'), ('world_runtime_checkpoints','user_id'),
      ('vendrith_runtime_intent_reconciliation_audit','user_id'),
      ('vendrith_development_action_proposals','user_id'),
      ('vendrith_development_action_audit','user_id'),
      ('vendrith_development_execution_audit','user_id')
    ) as refs(table_name, column_name)
  loop
    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_table
        and c.column_name = v_column
    ) then
      execute format(
        'select exists (select 1 from public.%I where %I = $1 limit 1)',
        v_table, v_column
      ) into v_found using p_user_id;
      if v_found then v_matches := array_append(v_matches, v_table); end if;
    end if;
  end loop;
  return v_matches;
end;
$$;

create or replace function chat_private.claim_chat_account_deletion_jobs(p_limit integer default 10)
returns table(user_id uuid, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select job.user_id
    from public.chat_account_deletion_jobs job
    where job.status in ('queued', 'failed')
      and job.next_attempt_at <= now()
      and job.attempts < 8
      and (job.locked_at is null or job.locked_at < now() - interval '20 minutes')
    order by job.next_attempt_at, job.requested_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  )
  update public.chat_account_deletion_jobs job
  set status = 'processing',
      attempts = job.attempts + 1,
      locked_at = now(),
      locked_by = gen_random_uuid(),
      updated_at = now(),
      last_error = null
  from candidates
  where job.user_id = candidates.user_id
  returning job.user_id, job.attempts;
end;
$$;

revoke all on function chat_private.chat_deletion_world_reference_tables(uuid) from public, anon, authenticated;
revoke all on function chat_private.claim_chat_account_deletion_jobs(integer) from public, anon, authenticated;
grant usage on schema chat_private to service_role;
grant execute on function chat_private.chat_deletion_world_reference_tables(uuid) to service_role;
grant execute on function chat_private.claim_chat_account_deletion_jobs(integer) to service_role;

comment on function chat_private.chat_deletion_world_reference_tables(uuid) is
  'Read-only cross-product safety guard. Returns names of existing World-owned tables containing this Auth UUID.';
comment on function chat_private.claim_chat_account_deletion_jobs(integer) is
  'Atomically claims queued/retryable Chat account deletion jobs for a trusted worker.';

-- PostgREST entry points: implementation stays private; only service_role can call these.
create or replace function public.chat_deletion_world_reference_tables(p_user_id uuid)
returns text[]
language sql
security invoker
set search_path = ''
as $$ select chat_private.chat_deletion_world_reference_tables(p_user_id); $$;

create or replace function public.chat_claim_account_deletion_jobs(p_limit integer default 10)
returns table(user_id uuid, attempts integer)
language sql
security invoker
set search_path = ''
as $$ select * from chat_private.claim_chat_account_deletion_jobs(p_limit); $$;

-- Serialize export requests per account so concurrent requests cannot bypass the cooldown.
create or replace function public.chat_claim_data_export_slot(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user_id_required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chat-export:' || p_user_id::text, 0)
  );
  if exists (
    select 1 from public.chat_data_export_events e
    where e.user_id = p_user_id and e.created_at > now() - interval '10 minutes'
  ) then
    raise exception using errcode = 'P0001', message = 'export_rate_limited';
  end if;
  insert into public.chat_data_export_events (user_id, row_counts)
  values (p_user_id, '{}'::jsonb)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

revoke all on function public.chat_deletion_world_reference_tables(uuid) from public, anon, authenticated;
revoke all on function public.chat_claim_account_deletion_jobs(integer) from public, anon, authenticated;
revoke all on function public.chat_claim_data_export_slot(uuid) from public, anon, authenticated;
grant execute on function public.chat_deletion_world_reference_tables(uuid) to service_role;
grant execute on function public.chat_claim_account_deletion_jobs(integer) to service_role;
grant execute on function public.chat_claim_data_export_slot(uuid) to service_role;

-- A tombstoned identity loses conversation access immediately, even while the
-- trusted cleanup worker is waiting or retrying.
create or replace function chat_private.is_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    and not exists (
      select 1 from public.chat_profiles profile
      where profile.user_id = (select auth.uid()) and profile.deleted_at is not null
    )
    and exists (
      select 1 from public.chat_members member_row
      where member_row.conversation_id = p_conversation_id
        and member_row.user_id = (select auth.uid())
    );
$$;
revoke all on function chat_private.is_member(uuid) from public, anon;
grant execute on function chat_private.is_member(uuid) to authenticated;