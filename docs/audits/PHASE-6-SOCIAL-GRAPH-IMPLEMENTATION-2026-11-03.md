# Vendrith Chat — Phase 6 Social Graph Implementation

**Date:** 2026-11-03
**Task:** VENDRITH-CHAT-PHASE-6-001
**Repository:** rakarakaa775/Vendrith-chat-
**Branch:** feat/chat-engine-server-ui
**Supabase target:** Vendrith Non-Production E2E (npvlokuszipgwrdipeoi)

## Scope delivered

The first Phase 6 slice implements the P0 social graph and an authenticated Friends & Community page:

- Opt-in player profiles with unique lowercase usernames and display names.
- Prefix username / display-name search with a minimum query length, bounded result count, and per-user search rate limit.
- Friend request creation, idempotent duplicate send, accept, decline, cancel, and remove.
- Block and unblock, including removal of an existing friendship and cancellation of pending requests.
- Block-aware player search, direct-conversation creation/reopening, and new direct-message send.
- Authenticated RPCs for friend, pending-request, and blocked-player directory reads.
- Authenticated /community route and a link from the server-backed Chat UI.

Profile discovery defaults to disabled. Search exposes only the selected profile fields (user_id, username, display_name); it does not expose email or Auth metadata.

## Database migrations applied to Non-Production

1. 20261103032208_chat_social_graph_v1
2. 20261103032511_chat_social_directory_rpcs_v1

Only Vendrith Chat-owned objects and existing chat_private.rate_limit_events were changed. No World of Vendrith game tables, Production project, or Production data were changed.

## Security model

- RLS enabled on all four new public tables: chat_profiles, chat_friend_requests, chat_friendships, and chat_blocks.
- Direct table writes are revoked from API roles; writes occur through validated RPC operations.
- Public RPC wrappers are SECURITY INVOKER. Privileged implementation functions remain in the unexposed chat_private schema with an empty search path and explicit authenticated execution grants.
- No new public Chat RPC is executable by anon; authenticated execution is granted to the intended RPCs.
- Profiles are visible by direct table read only to their owner; directory RPCs return a limited field set.
- Blocking serializes against direct-message creation and send using pair-scoped advisory locks. Existing conversation history remains readable to existing members, but new direct messages are rejected after a block.
- Friend-request and profile-search actions use per-user rate limits.

## Verification evidence

### Non-Production transactional checks

Executed as rollback-only transactions using existing non-anonymous test identities:

- Search returns an opted-in profile and excludes a blocked relationship.
- Duplicate outgoing friend-request calls return the same request ID.
- Recipient can accept a pending request; both participants receive the friendship in their list.
- Blocking removes the friendship and cancels a pending request.
- Blocked players are excluded from search and cannot send a friend request, create/reopen a direct conversation, or send a new direct message.
- Unblocking removes the block but does not recreate the friendship.
- Anonymous identity is rejected by the social search RPC.
- Friend, pending-request, and block-list RPCs return only the signed-in player's relevant rows.
- RLS read probe: a user sees their own profile and block list; the blocked target does not see the blocker's block list.
- All QA transactions were rolled back. No QA profile, request, friendship, block, or message rows were left behind.

### Repository checks

- npm run typecheck: PASS.
- npm test: 24 passed, 0 failed.
- npm run build: PASS; non-fatal webpack cache serialization warnings remain.
- npm run test:e2e: 5 passed, 1 skipped. The skipped test is the authenticated sign-in redirect check, which requires the explicit authenticated E2E environment.
- git diff --check: PASS.
- Supabase security advisor returned no new findings matching the Phase 6 social tables or RPCs. The project has pre-existing broader Vendrith schema notices; those are outside this Chat-only migration scope and were not changed.

## Not yet delivered / remaining gates

- Live Android/browser acceptance of the new /community page with two real Non-Production accounts.
- Automated authenticated two-account social-flow E2E.
- Group conversations, group membership lifecycle, admin/moderator permissions.
- Online/offline presence and last-seen privacy controls.
- Reporting, moderation queues, and notification delivery.
- Independent QA and final verification sign-off.

The successful build and transactional database probes do not by themselves prove the full browser-to-database experience. Phase 6 remains IN PROGRESS, not complete.

## Repository and release safety

- Branch was not switched.
- Existing untracked user audit reports were preserved unchanged.
- No push or deployment was created by this implementation checkpoint.
- No Production resource was accessed or modified.
