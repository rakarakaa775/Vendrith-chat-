-- Auth user deletion must not cascade into shared Chat history or moderation evidence.
alter table public.chat_messages
  drop constraint if exists chat_messages_sender_id_fkey;

alter table public.chat_conversations
  drop constraint if exists chat_conversations_created_by_fkey;

alter table public.chat_group_reports
  drop constraint if exists chat_group_reports_reporter_id_fkey,
  drop constraint if exists chat_group_reports_reported_user_id_fkey;

alter table public.chat_group_moderation_events
  drop constraint if exists chat_group_moderation_events_actor_id_fkey,
  drop constraint if exists chat_group_moderation_events_target_user_id_fkey;

comment on column public.chat_messages.sender_id is
  'Stable internal sender tombstone key. Deliberately not an Auth foreign key so deleting an account preserves shared messages.';
comment on column public.chat_conversations.created_by is
  'Stable internal creator tombstone key. Deliberately not an Auth foreign key so account deletion cannot cascade-delete shared conversations.';
comment on column public.chat_group_reports.reporter_id is
  'Pseudonymous reporter identity retained for moderation audit after account deletion.';
comment on column public.chat_group_moderation_events.actor_id is
  'Pseudonymous moderator identity retained for moderation audit after account deletion.';
