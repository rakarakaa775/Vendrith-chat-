-- Least-privilege table access for the trusted account lifecycle Edge Functions.
-- service_role is server-only; user-facing roles retain their existing RLS/grants.
begin;

grant usage on schema public to service_role;

-- Export inventory and deletion safety checks require read-only access.
grant select on table
  public.chat_profiles,
  public.chat_members,
  public.chat_conversations,
  public.chat_friend_requests,
  public.chat_friendships,
  public.chat_blocks,
  public.chat_notifications,
  public.chat_notification_preferences,
  public.chat_presence,
  public.chat_message_reactions,
  public.chat_message_pins,
  public.chat_attachments,
  public.chat_group_invitations,
  public.chat_group_reports,
  public.chat_group_moderation_events,
  public.chat_messages
to service_role;

-- Account deletion may tombstone a profile and remove only Chat-owned records.
grant insert, update on table public.chat_profiles to service_role;

grant delete on table
  public.chat_members,
  public.chat_attachments,
  public.chat_notifications,
  public.chat_notification_preferences,
  public.chat_friend_requests,
  public.chat_friendships,
  public.chat_blocks,
  public.chat_presence,
  public.chat_message_reactions,
  public.chat_message_pins,
  public.chat_group_invitations
to service_role;

-- chat_account_deletion_jobs and chat_data_export_events already grant the
-- trusted role the exact lifecycle operations they require in prior migrations.
commit;
