-- CATALOG-RECONSTRUCTED on 2026-11-05 from the Vendrith Chat Non-Production catalog.
-- This is not claimed to be the original historical SQL body.
-- Validate only on a disposable clean database; never replay on the existing project.

-- Move the privileged auth.sessions read behind the non-exposed Chat schema.
-- The public RPC is an invoker wrapper; the private function remains actor-scoped.
CREATE OR REPLACE FUNCTION chat_private.chat_list_my_sessions()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamp without time zone,
  user_agent text,
  tag text,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    session_row.id,
    session_row.created_at,
    session_row.updated_at,
    session_row.refreshed_at,
    session_row.user_agent,
    session_row.tag,
    session_row.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid AS is_current
  FROM auth.sessions AS session_row
  WHERE session_row.user_id = (SELECT auth.uid())
    AND (session_row.not_after IS NULL OR session_row.not_after > now())
  ORDER BY session_row.updated_at DESC;
$function$;

REVOKE ALL ON FUNCTION chat_private.chat_list_my_sessions() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA chat_private TO authenticated;
GRANT EXECUTE ON FUNCTION chat_private.chat_list_my_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_list_my_sessions()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamp without time zone,
  user_agent text,
  tag text,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT * FROM chat_private.chat_list_my_sessions();
$function$;

REVOKE ALL ON FUNCTION public.chat_list_my_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_list_my_sessions() TO authenticated;