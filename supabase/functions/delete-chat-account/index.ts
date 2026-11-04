import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const CONFIRMATION = 'DELETE MY VENDRITH ACCOUNT'
const MAX_AUTH_AGE_SECONDS = 10 * 60

type Json = Record<string, unknown>
function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
function authTimeFromJwt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')))
    return typeof decoded.auth_time === 'number' ? decoded.auth_time : null
  } catch { return null }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'authentication_required' })
  let body: { confirmation?: string }
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object') return json(400, { error: 'invalid_request_body' })
    body = parsed as { confirmation?: string }
  } catch { return json(400, { error: 'invalid_request_body' }) }
  if (body.confirmation !== CONFIRMATION) return json(400, { error: 'explicit_confirmation_required' })
  const authTime = authTimeFromJwt(token)
  const now = Math.floor(Date.now() / 1000)
  if (!authTime || authTime > now + 60 || now - authTime > MAX_AUTH_AGE_SECONDS) {
    return json(401, { error: 'recent_sign_in_required' })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json(503, { error: 'deletion_service_not_configured' })
  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  const user = authData.user
  if (authError || !user || user.is_anonymous) return json(401, { error: 'valid_account_session_required' })
  const userId = user.id

  const { data: protectedAreas, error: guardError } = await admin.rpc(
    'chat_deletion_world_reference_tables', { p_user_id: userId },
  )
  if (guardError) return json(503, { error: 'cross_product_safety_check_unavailable' })
  if (Array.isArray(protectedAreas) && protectedAreas.length) {
    await admin.from('chat_account_deletion_jobs').upsert({
      user_id: userId, status: 'blocked', last_error: 'shared_auth_identity_has_world_data',
      updated_at: new Date().toISOString(), locked_at: null, locked_by: null,
    }, { onConflict: 'user_id' })
    return json(409, { error: 'shared_auth_identity_has_world_data', protected_areas: protectedAreas.length })
  }

  const { data: ownedGroups, error: groupError } = await admin.from('chat_members')
    .select('conversation_id,chat_conversations!inner(kind)')
    .eq('user_id', userId).eq('role', 'owner').eq('chat_conversations.kind', 'group')
  if (groupError) return json(503, { error: 'group_ownership_check_unavailable' })
  if ((ownedGroups ?? []).length) {
    await admin.from('chat_account_deletion_jobs').upsert({
      user_id: userId, status: 'blocked', last_error: 'group_ownership_transfer_required',
      updated_at: new Date().toISOString(), locked_at: null, locked_by: null,
    }, { onConflict: 'user_id' })
    return json(409, { error: 'transfer_group_ownership_before_deletion', blocked_groups: ownedGroups.length })
  }

  const { data: existing, error: existingError } = await admin.from('chat_account_deletion_jobs')
    .select('status').eq('user_id', userId).maybeSingle()
  if (existingError) return json(503, { error: 'deletion_queue_unavailable' })
  if (existing?.status === 'completed') return json(200, { status: 'completed' })

  const timestamp = new Date().toISOString()
  const { error: queueError } = await admin.from('chat_account_deletion_jobs').upsert({
    user_id: userId, status: 'queued', attempts: 0, requested_at: timestamp,
    updated_at: timestamp, next_attempt_at: timestamp, completed_at: null,
    last_error: null, locked_at: null, locked_by: null,
  }, { onConflict: 'user_id' })
  if (queueError) return json(503, { error: 'deletion_queue_unavailable' })

  // Tombstone the public identity and remove memberships immediately. The worker
  // performs Storage and Auth cleanup; membership removal prevents further chat reads/writes.
  const tombstoneUsername = `deleted_${userId.replaceAll('-', '').slice(0, 12)}`
  const { error: tombstoneError } = await admin.from('chat_profiles').upsert({
    user_id: userId, username: tombstoneUsername, display_name: 'Deleted account',
    discoverable: false, show_online_status: false, show_last_seen: false,
    deleted_at: timestamp, updated_at: timestamp,
  }, { onConflict: 'user_id' })
  if (tombstoneError) {
    await admin.from('chat_account_deletion_jobs').update({
      status: 'failed', last_error: 'profile_tombstone_failed', next_attempt_at: timestamp,
      locked_at: null, locked_by: null, updated_at: timestamp,
    }).eq('user_id', userId)
    return json(202, { status: 'queued', message: 'Deletion is queued for retry.' })
  }
  const { error: membershipError } = await admin.from('chat_members').delete().eq('user_id', userId)
  if (membershipError) {
    await admin.from('chat_account_deletion_jobs').update({
      status: 'failed', last_error: 'membership_revocation_failed', next_attempt_at: timestamp,
      locked_at: null, locked_by: null, updated_at: timestamp,
    }).eq('user_id', userId)
    return json(202, { status: 'queued', message: 'Deletion is queued for retry.' })
  }
  await admin.from('chat_presence').delete().eq('user_id', userId)
  // Revoke refresh-token sessions; already-issued access JWTs may remain valid
  // until expiry, but the deleted_at membership guard denies Chat access now.
  await fetch(`${url}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  }).catch(() => undefined)
  return json(202, {
    status: 'queued',
    message: 'Your Chat identity is now hidden and conversation access is revoked. Trusted cleanup will complete account deletion.',
  })
})