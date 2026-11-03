-- Enable authenticated, RLS-filtered Postgres Changes for Vendrith Chat messages.
-- Only message INSERT events are required; writes remain RPC-only.

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'supabase_realtime publication is missing';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

comment on table public.chat_messages is
  'Persisted Vendrith Chat messages; sender identity and timestamp are server-authoritative. Realtime INSERT delivery is filtered by existing member SELECT RLS.';
