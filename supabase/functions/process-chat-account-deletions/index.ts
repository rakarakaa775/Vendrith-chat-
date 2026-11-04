import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-worker-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const ATTACHMENT_BUCKET = 'vendrith-chat-attachments'
const AVATAR_BUCKET = 'vendrith-chat-avatars'
type Job = { user_id: string; attempts: number }
type StoragePath = { object_path: string }
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}
async function removePaths(admin: SupabaseClient, bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(unique.slice(i, i + 100))
    if (error) throw new Error(`storage_cleanup_failed:${bucket}`)
  }
}
async function processJob(admin: SupabaseClient, job: Job) {
  const userId = job.user_id
  const { data: refs, error: guardError } = await admin.rpc('chat_deletion_world_reference_tables', { p_user_id: userId })
  if (guardError) throw new Error('cross_product_safety_check_failed')
  if (Array.isArray(refs) && refs.length) {
    await admin.from('chat_account_deletion_jobs').update({
      status: 'blocked', last_error: 'shared_auth_identity_has_world_data', locked_at: null, locked_by: null, updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return 'blocked'
  }

  const { data: ownedGroups, error: groupError } = await admin.from('chat_members')
    .select('conversation_id,chat_conversations!inner(kind)').eq('user_id', userId)
    .eq('role', 'owner').eq('chat_conversations.kind', 'group')
  if (groupError) throw new Error('group_ownership_check_failed')
  if ((ownedGroups ?? []).length) {
    await admin.from('chat_account_deletion_jobs').update({
      status: 'blocked', last_error: 'group_ownership_transfer_required', locked_at: null, locked_by: null, updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return 'blocked'
  }

  const tombstoneUsername = `deleted_${userId.replaceAll('-', '').slice(0, 12)}`
  const tombstoneAt = new Date().toISOString()
  const { error: tombstoneError } = await admin.from('chat_profiles').upsert({
    user_id: userId, username: tombstoneUsername, display_name: 'Deleted account',
    discoverable: false, show_online_status: false, show_last_seen: false,
    deleted_at: tombstoneAt, updated_at: tombstoneAt,
  }, { onConflict: 'user_id' })
  if (tombstoneError) throw new Error('profile_tombstone_failed')
  const { data: profile, error: profileError } = await admin.from('chat_profiles')
    .select('avatar_path').eq('user_id', userId).maybeSingle()
  if (profileError) throw new Error('profile_inventory_failed')
  if (profile?.avatar_path && profile.avatar_path.startsWith(`profiles/${userId}/`)) {
    await removePaths(admin, AVATAR_BUCKET, [profile.avatar_path])
  }

  const attachmentPaths: string[] = []
  for (let offset = 0; ; offset += 500) {
    const { data: attachments, error: attachmentError } = await admin.from('chat_attachments')
      .select('object_path').eq('uploader_id', userId).order('id', { ascending: true })
      .range(offset, offset + 499)
    if (attachmentError) throw new Error('attachment_inventory_failed')
    attachmentPaths.push(...(attachments ?? []).map((row: StoragePath) => row.object_path))
    if (!attachments || attachments.length < 500) break
    if (attachmentPaths.length > 20000) throw new Error('attachment_inventory_limit_exceeded')
  }
  await removePaths(admin, ATTACHMENT_BUCKET, attachmentPaths)

  const cleanup = await Promise.all([
    admin.from('chat_attachments').delete().eq('uploader_id', userId),
    admin.from('chat_notifications').delete().or(`user_id.eq.${userId},actor_id.eq.${userId}`),
    admin.from('chat_notification_preferences').delete().eq('user_id', userId),
    admin.from('chat_friend_requests').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),
    admin.from('chat_friendships').delete().or(`user_low.eq.${userId},user_high.eq.${userId}`),
    admin.from('chat_blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    admin.from('chat_presence').delete().eq('user_id', userId),
    admin.from('chat_message_reactions').delete().eq('user_id', userId),
    admin.from('chat_message_pins').delete().eq('pinned_by', userId),
    admin.from('chat_group_invitations').delete().or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`),
    admin.from('chat_members').delete().eq('user_id', userId),
  ])
  if (cleanup.some((result) => result.error)) throw new Error('account_data_cleanup_failed')

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId)
  if (authDeleteError && !/not found|does not exist/i.test(authDeleteError.message)) throw new Error('auth_user_deletion_failed')
  const completedAt = new Date().toISOString()
  const { error: completeError } = await admin.from('chat_account_deletion_jobs').update({
    status: 'completed', completed_at: completedAt, updated_at: completedAt,
    last_error: null, locked_at: null, locked_by: null,
  }).eq('user_id', userId)
  if (completeError) throw new Error('deletion_receipt_update_failed')
  return 'completed'
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const expected = Deno.env.get('CHAT_DELETION_WORKER_SECRET') ?? ''
  const supplied = request.headers.get('x-worker-secret') ?? ''
  if (expected.length < 32 || !safeEqual(supplied, expected)) return json(401, { error: 'worker_authentication_failed' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json(503, { error: 'worker_not_configured' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let batchSize = 10
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.batch_size === 'number') batchSize = Math.max(1, Math.min(25, Math.floor(body.batch_size)))
  } catch { /* use bounded default */ }
  const { data: jobs, error: claimError } = await admin.rpc('chat_claim_account_deletion_jobs', { p_limit: batchSize })
  if (claimError) return json(503, { error: 'job_claim_failed' })
  const results: Array<{ status: string }> = []
  for (const job of (jobs ?? []) as Job[]) {
    try {
      results.push({ status: await processJob(admin, job) })
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'deletion_failed'
      const retrySeconds = Math.min(3600, 30 * (2 ** Math.min(job.attempts, 7)))
      await admin.from('chat_account_deletion_jobs').update({
        status: 'failed', last_error: code.slice(0, 120),
        next_attempt_at: new Date(Date.now() + retrySeconds * 1000).toISOString(),
        locked_at: null, locked_by: null, updated_at: new Date().toISOString(),
      }).eq('user_id', job.user_id)
      console.error(JSON.stringify({ event: 'chat_account_deletion_job_failed', category: code.split(':')[0], attempt: job.attempts }))
      results.push({ status: 'retry_scheduled' })
    }
  }
  return json(200, { claimed: jobs?.length ?? 0, results })
})