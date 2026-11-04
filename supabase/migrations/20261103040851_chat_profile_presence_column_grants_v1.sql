-- Allow authenticated users to read only their own presence privacy settings.
-- The existing chat_profiles_select_self RLS policy still limits rows to auth.uid().
-- No profile columns beyond these two are newly exposed by this migration.
grant select (show_online_status, show_last_seen)
  on public.chat_profiles to authenticated;
