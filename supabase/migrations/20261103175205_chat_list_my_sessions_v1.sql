-- Expose only non-secret session metadata for the currently authenticated user.
-- auth.sessions is intentionally not exposed through the Data API.
create or replace function public.chat_list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamp without time zone,
  user_agent text,
  tag text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session_row.id,
    session_row.created_at,
    session_row.updated_at,
    session_row.refreshed_at,
    session_row.user_agent,
    session_row.tag,
    session_row.id = nullif(auth.jwt() ->> 'session_id', '')::uuid as is_current
  from auth.sessions as session_row
  where session_row.user_id = (select auth.uid())
    and (session_row.not_after is null or session_row.not_after > now())
  order by session_row.updated_at desc;
$$;

revoke all on function public.chat_list_my_sessions() from public, anon;
grant execute on function public.chat_list_my_sessions() to authenticated;

comment on function public.chat_list_my_sessions() is
  'Returns non-secret metadata for sessions owned by auth.uid(); never returns tokens, IP addresses, or another user sessions.';