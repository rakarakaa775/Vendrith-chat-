-- Enable Realtime for the community page (Non-Production).
-- The client (app/community/community-client.tsx) already subscribes to changes on
-- chat_friend_requests, chat_group_invitations and chat_members, but the
-- supabase_realtime publication only contained chat_messages and chat_notifications.
-- The client only uses these events as a trigger to refresh; payloads are not used.

-- 1) chat_group_invitations had RLS enabled but no policy and no read grant.
--    Allow the inviter and the invitee to read their own invitation rows.
grant select (id, conversation_id, inviter_id, invitee_id, status, created_at, responded_at)
  on public.chat_group_invitations to authenticated;

create policy chat_group_invitations_select_participant
  on public.chat_group_invitations
  for select
  to authenticated
  using (
    inviter_id = (select auth.uid())
    or invitee_id = (select auth.uid())
  );

-- 2) Add the three tables to the Realtime publication.
alter publication supabase_realtime add table
  public.chat_friend_requests,
  public.chat_group_invitations,
  public.chat_members;

-- Rollback (manual, if ever needed):
--   alter publication supabase_realtime drop table
--     public.chat_friend_requests, public.chat_group_invitations, public.chat_members;
--   drop policy chat_group_invitations_select_participant on public.chat_group_invitations;
--   revoke select (id, conversation_id, inviter_id, invitee_id, status, created_at, responded_at)
--     on public.chat_group_invitations from authenticated;