-- Add indexes for Chat foreign-key columns flagged by Supabase performance advisors.
-- These indexes do not change row visibility or authorization policies.
create index if not exists idx_chat_conversations_closed_by
  on public.chat_conversations (closed_by);

create index if not exists idx_chat_group_moderation_events_report_id
  on public.chat_group_moderation_events (report_id);

create index if not exists idx_chat_group_reports_message_id
  on public.chat_group_reports (message_id);

create index if not exists idx_chat_group_reports_reviewed_by
  on public.chat_group_reports (reviewed_by);

create index if not exists idx_chat_members_added_by
  on public.chat_members (added_by);

create index if not exists idx_chat_members_user_id
  on public.chat_members (user_id);

create index if not exists idx_chat_message_pins_message_id
  on public.chat_message_pins (message_id);

create index if not exists idx_chat_message_pins_pinned_by
  on public.chat_message_pins (pinned_by);

create index if not exists idx_chat_message_reactions_user_id
  on public.chat_message_reactions (user_id);

create index if not exists idx_chat_messages_reply_to_message_id
  on public.chat_messages (reply_to_message_id);

create index if not exists idx_chat_notifications_actor_id
  on public.chat_notifications (actor_id);

create index if not exists idx_chat_notifications_conversation_id
  on public.chat_notifications (conversation_id);