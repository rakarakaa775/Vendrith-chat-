# Vendrith Chat — Conversation Profile Display Fix

**Date:** 2026-11-03
**Repository:** rakarakaa775/Vendrith-chat-
**Branch:** feat/chat-engine-server-ui
**Supabase target:** Vendrith Non-Production E2E (npvlokuszipgwrdipeoi)

## User-reported issue

After editing username and display name on Friends & Community, the conversation list and thread title continued to show the old generic player label. The other participant's latest profile name was also not displayed.

## Root cause

The server-backed chat UI loaded conversation membership UUIDs and rendered a label derived from the first eight UUID characters. It did not read current chat_profiles values. Direct reads of another player's profile are intentionally restricted by RLS, so the fix uses a narrowly scoped authenticated RPC instead of broadening profile-table visibility.

## Change delivered

- Added chat_private.get_conversation_profiles(uuid[]) and public SECURITY INVOKER wrapper chat_get_conversation_profiles(uuid[]).
- The private SECURITY DEFINER function requires a non-anonymous authenticated identity, caps the request at 100 conversation IDs, and returns profile fields only for conversations where the caller is a member.
- The RPC returns only conversation ID, user ID, username, and display name. It exposes no email or Auth metadata.
- The server chat loads current profile labels when it loads conversations.
- Conversation list, thread heading, and other participant's message labels now show the current display name with the @username handle.
- Conversation names refresh when the page regains focus or becomes visible, so profile edits made by the other participant are picked up on return. Manual Refresh remains available.
- Existing messages, conversation IDs, and membership rows are unchanged.

## Non-Production verification

- Applied migration chat_conversation_profiles_v1 to Non-Production project only.
- Authenticated RPC probe returned current profile fields for the caller's conversation members.
- Cross-conversation probe supplied three conversation IDs; the function returned rows only for the two conversations where the caller was a member. The non-member conversation was excluded.
- Database probe used an explicit authenticated JWT claim and ran in a rollback transaction.
- Function privileges: private implementation executable by authenticated only; public wrapper executable by authenticated only; anon/public execution revoked.
- Security Advisor was run. No finding for this new function was identified in the returned findings; the project still has pre-existing general Vendrith schema notices unrelated to this change.
- npm run typecheck: PASS.
- npm test: 24 passed, 0 failed.
- npm run build: PASS; existing non-fatal webpack cache serialization warnings.
- git diff --check: PASS.

## Remaining acceptance

The owner should reopen the deployed preview after the next deployment, verify both accounts' display names and @usernames in the conversation list and thread, then edit one profile from the second account and return to the first account's chat to verify the label refreshes. This browser acceptance has not yet been claimed.

## Safety

- Only Non-Production Vendrith Chat schema was changed.
- No Production project, World of Vendrith game data, or user message history was modified.
- Existing untracked user-owned audit documents remain untouched.
