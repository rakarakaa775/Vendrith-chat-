-- Least-privilege service_role grants for Vendrith Chat tables (Non-Production).
-- Supabase default privileges give service_role ALL on every new public table.
-- Revoke that on the Chat tables and grant back only what the account-lifecycle
-- Edge Functions (delete-chat-account, export-chat-account,
-- process-chat-account-deletions) actually use.
-- Scope: Chat tables only. Default privileges and game-domain tables are not touched.

revoke all on table
  public.chat_account_deletion_jobs,
  public.chat_attachments,
  public.chat_blocks,
  public.chat_conversations,
  public.chat_data_export_events,
  public.chat_friend_requests,
  public.chat_friendships,
  public.chat_group_invitations,
  public.chat_group_moderation_events,
  public.chat_group_reports,
  public.chat_members,
  public.chat_message_pins,
  public.chat_message_reactions,
  public.chat_messages,
  public.chat_notification_preferences,
  public.chat_notifications,
  public.chat_presence,
  public.chat_profiles
from service_role;

-- Read access (export and ownership checks); also required by filtered UPDATE/DELETE.
grant select on table
  public.chat_account_deletion_jobs,
  public.chat_attachments,
  public.chat_blocks,
  public.chat_conversations,
  public.chat_data_export_events,
  public.chat_friend_requests,
  public.chat_friendships,
  public.chat_group_invitations,
  public.chat_group_moderation_events,
  public.chat_group_reports,
  public.chat_members,
  public.chat_message_pins,
  public.chat_message_reactions,
  public.chat_messages,
  public.chat_notification_preferences,
  public.chat_notifications,
  public.chat_presence,
  public.chat_profiles
to service_role;

-- Tombstone upserts and job queue rows.
grant insert, update on table
  public.chat_profiles,
  public.chat_account_deletion_jobs
to service_role;

-- Export audit receipt (row_counts).
grant update on table public.chat_data_export_events to service_role;

-- Account deletion cleanup.
grant delete on table
  public.chat_attachments,
  public.chat_blocks,
  public.chat_friend_requests,
  public.chat_friendships,
  public.chat_group_invitations,
  public.chat_members,
  public.chat_message_pins,
  public.chat_message_reactions,
  public.chat_notification_preferences,
  public.chat_notifications,
  public.chat_presence
to service_role;

-- Rollback (manual, if ever needed):
--   grant all on table <the 18 chat_* tables above> to service_role;