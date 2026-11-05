import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hasRecentAuthentication,
  passwordAuthTimeFromJwt,
} from "../_shared/account-lifecycle.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};
const MAX_AUTH_AGE_SECONDS = 10 * 60;
const PAGE_SIZE = 500;
const MAX_ROWS_PER_COLLECTION = 20_000;
const EXPORT_COLUMNS: Record<string, string> = {
  chat_profiles:
    "user_id,username,display_name,discoverable,created_at,updated_at,show_online_status,show_last_seen,deleted_at,allow_friend_requests",
  chat_members:
    "conversation_id,user_id,joined_at,role,last_read_at,archived_at",
  chat_friend_requests:
    "id,sender_id,recipient_id,status,created_at,responded_at",
  chat_friendships: "user_low,user_high,created_at",
  chat_blocks: "blocker_id,blocked_id,created_at",
  chat_notifications:
    "id,user_id,category,event_type,title,body,conversation_id,related_id,created_at,read_at",
  chat_notification_preferences:
    "user_id,messages_enabled,friends_enabled,groups_enabled,moderation_enabled,updated_at",
  chat_presence: "user_id,last_seen_at",
  chat_message_reactions:
    "id,message_id,conversation_id,user_id,emoji,created_at",
  chat_message_pins: "id,conversation_id,message_id,pinned_by,pinned_at",
  chat_attachments:
    "id,conversation_id,uploader_id,original_name,mime_type,byte_size,status,created_at,uploaded_at",
  chat_group_invitations:
    "id,conversation_id,inviter_id,invitee_id,status,created_at,responded_at",
  chat_group_reports:
    "id,conversation_id,reporter_id,reported_user_id,message_id,category,details,status,created_at",
  chat_group_moderation_events:
    "id,conversation_id,actor_id,report_id,target_user_id,action,note,created_at",
  chat_messages:
    "id,conversation_id,sender_id,client_message_id,body,created_at,reply_to_message_id,edited_at,is_deleted",
};
const ORDER_COLUMNS: Record<string, string[]> = {
  chat_profiles: ["user_id"],
  chat_members: ["conversation_id"],
  chat_friendships: ["user_low", "user_high"],
  chat_blocks: ["blocker_id", "blocked_id"],
  chat_notification_preferences: ["user_id"],
  chat_presence: ["user_id"],
};
type Row = Record<string, unknown>;
function json(status: number, body: Row) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
async function allRows(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0;; offset += PAGE_SIZE) {
    let query = admin.from(table).select(EXPORT_COLUMNS[table]).eq(
      column,
      value,
    );
    for (const orderColumn of ORDER_COLUMNS[table] ?? ["id"]) {
      query = query.order(orderColumn, { ascending: true });
    }
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`export_query_failed:${table}`);
    result.push(...((data ?? []) as unknown as Row[]));
    if (result.length > MAX_ROWS_PER_COLLECTION) {
      throw new Error(`export_limit_exceeded:${table}`);
    }
    if (!data || data.length < PAGE_SIZE) return result;
  }
}
async function rowsForEither(
  admin: SupabaseClient,
  table: string,
  first: string,
  second: string,
  userId: string,
) {
  const [a, b] = await Promise.all([
    allRows(admin, table, first, userId),
    allRows(admin, table, second, userId),
  ]);
  const merged = [...a, ...b];
  const key = (row: Row) => String(row.id ?? `${row[first]}:${row[second]}`);
  return [...new Map(merged.map((row) => [key(row), row])).values()];
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }
  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return json(401, { error: "authentication_required" });
  const authTime = passwordAuthTimeFromJwt(token);
  const now = Math.floor(Date.now() / 1000);
  if (!hasRecentAuthentication(authTime, now, MAX_AUTH_AGE_SECONDS)) {
    return json(401, { error: "recent_sign_in_required" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !serviceKey) {
    return json(503, { error: "export_service_not_configured" });
  }
  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(
    token,
  );
  const user = authData.user;
  if (authError || !user || user.is_anonymous) {
    return json(401, { error: "valid_account_session_required" });
  }
  const userId = user.id;

  const { data: auditId, error: auditError } = await admin.rpc(
    "chat_claim_data_export_slot",
    { p_user_id: userId },
  );
  if (auditError) {
    if (auditError.message?.includes("export_rate_limited")) {
      return json(429, {
        error: "export_rate_limited",
        retry_after_seconds: 600,
      });
    }
    return json(503, { error: "export_audit_unavailable" });
  }
  if (typeof auditId !== "string") {
    return json(503, { error: "export_audit_unavailable" });
  }

  try {
    const [
      profile,
      memberships,
      friendRequests,
      friendships,
      blocks,
      notifications,
      notificationPreferences,
      presence,
      reactions,
      pins,
      attachments,
      invitations,
      reports,
      moderationEvents,
      authoredMessages,
    ] = await Promise.all([
      allRows(admin, "chat_profiles", "user_id", userId),
      allRows(admin, "chat_members", "user_id", userId),
      rowsForEither(
        admin,
        "chat_friend_requests",
        "sender_id",
        "recipient_id",
        userId,
      ),
      rowsForEither(admin, "chat_friendships", "user_low", "user_high", userId),
      rowsForEither(admin, "chat_blocks", "blocker_id", "blocked_id", userId),
      allRows(admin, "chat_notifications", "user_id", userId),
      allRows(admin, "chat_notification_preferences", "user_id", userId),
      allRows(admin, "chat_presence", "user_id", userId),
      allRows(admin, "chat_message_reactions", "user_id", userId),
      allRows(admin, "chat_message_pins", "pinned_by", userId),
      allRows(admin, "chat_attachments", "uploader_id", userId),
      rowsForEither(
        admin,
        "chat_group_invitations",
        "inviter_id",
        "invitee_id",
        userId,
      ),
      allRows(admin, "chat_group_reports", "reporter_id", userId),
      allRows(admin, "chat_group_moderation_events", "actor_id", userId),
      allRows(admin, "chat_messages", "sender_id", userId),
    ]);
    const conversationIds = [
      ...new Set(
        memberships.map((row) => String(row.conversation_id)).filter(Boolean),
      ),
    ];
    const conversations: Row[] = [];
    for (let offset = 0; offset < conversationIds.length; offset += 100) {
      const ids = conversationIds.slice(offset, offset + 100);
      const { data, error } = await admin.from("chat_conversations")
        .select(
          "id,kind,created_by,created_at,title,description,closed_at,closed_by",
        )
        .in("id", ids);
      if (error) throw new Error("export_query_failed:chat_conversations");
      conversations.push(...(data ?? []));
    }

    const data = {
      profile,
      memberships,
      conversations,
      authored_messages: authoredMessages,
      friend_requests: friendRequests,
      friendships,
      blocks,
      notifications,
      notification_preferences: notificationPreferences,
      presence,
      reactions,
      pins,
      uploaded_attachment_metadata: attachments,
      group_invitations: invitations,
      reports_submitted: reports,
      moderation_actions_authored: moderationEvents,
    };
    const rowCounts = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value.length]),
    );
    const { error: receiptError } = await admin.from("chat_data_export_events")
      .update({ row_counts: rowCounts }).eq("id", auditId);
    if (receiptError) throw new Error("export_audit_receipt_failed");
    const document = {
      manifest: {
        product: "Vendrith Chat",
        schema_version: 1,
        exported_at: new Date().toISOString(),
        subject: { auth_user_id: userId, email: user.email ?? null },
        scope:
          "Chat-owned personal data only. Messages authored by other participants, their private profile data, Auth credentials, and private attachment bytes are excluded.",
        omitted: [
          "Other participants’ messages and private profile data",
          "Password hashes, access/refresh tokens, signing keys, and service credentials",
          "Private attachment bytes, internal Storage object paths, and signed download URLs",
          "Incoming moderation evidence authored by other users",
          "World of Vendrith game/editor/runtime records",
        ],
      },
      data,
    };
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(document, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="vendrith-chat-export-${date}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "export_failed";
    const category = message.startsWith("export_limit_exceeded:")
      ? "export_limit_exceeded"
      : "export_unavailable";
    console.error(
      JSON.stringify({
        event: "chat_personal_export_failed",
        category,
        at: new Date().toISOString(),
      }),
    );
    return json(503, { error: category });
  }
});
