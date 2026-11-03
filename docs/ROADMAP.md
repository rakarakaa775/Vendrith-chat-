# Vendrith Chat — Implementation Roadmap

**Last reviewed:** 2026-11-03
**Active branch:** main
**Execution mode:** Implementation-first. All test execution, QA runs, manual acceptance checks, and verification gates are deferred until every planned implementation phase is complete.
**Environment boundary:** Vendrith Non-Production E2E only (npvlokuszipgwrdipeoi). No production World of Vendrith Auth, schema, data, storage, or settings changes.

## Working rules

- Implement in dependency order. Do not run unit, E2E, browser, manual, QA, or release tests during this implementation pass.
- Keep existing test files and CI definitions; testing is postponed, not removed from the final release process.
- Do not mark features verified or production-ready merely because code exists.
- Preserve existing work and data. Do not delete user data, reset databases, overwrite unrelated files, or switch branches automatically.
- Keep Chat isolated from World of Vendrith game-domain data. Canonical player identity remains the trusted Supabase Auth UUID.
- Apply migrations only to the approved Non-Production E2E project. Never apply them to production.
- No paid infrastructure, external providers, voice/video, AI chat, or game-world mutation without separate approval.

## Current implementation snapshot

### Implemented in repository / recorded as applied in Non-Production
- Responsive Next.js App Router / React / TypeScript application shell and mobile navigation.
- Email/password Auth screens, Supabase SSR clients, middleware session handling, PKCE callback, password reset routes, and protected main route.
- Chat-owned direct conversation, membership, and message tables with RLS, constrained read grants, and RPC-only writes.
- Direct conversation creation and idempotent message-send RPCs.
- Non-Production rate limiting for conversation creation and message sending.
- Realtime publication migration for chat messages and client subscription/recovery logic.
- Local preview remains available without backend configuration; authenticated main route uses the server-backed chat component.

### Product capabilities still to implement
- Social graph: player discovery, friend requests, accept/reject/cancel/remove, blocks/unblock, and relationship-aware direct messaging.
- Chat-owned profile presentation and preferences, preserving canonical Auth identity.
- Presence and privacy controls.
- Group conversations, member lifecycle, roles, and moderation permissions.
- Media attachments and in-app notifications/preferences.
- Operational controls, retention workflows, and production integration package.

## Phase 1 — Foundation
**Status:** Existing foundation retained.
- [x] Separate repository and chat-domain ownership boundary.
- [x] Next.js App Router, React, TypeScript, lockfile, responsive application shell.
- [x] English as primary application language.
- [x] Mobile conversation list/detail navigation and preview mode.
- [x] Environment placeholders and CI workflow.

## Phase 2 — Chat Engine
**Status:** Core local and server-backed direct-message paths implemented; final validation deferred.
- [x] Local versioned Chat Engine adapter and message validation/idempotency behavior.
- [x] Supabase-backed direct-message UI on authenticated main route.
- [x] Conversation creation and message-send RPC integration.
- [x] Server-backed history loading and bounded recent-message retrieval.
- [x] Realtime message subscription, deduplication, and history refresh behavior.
- [x] Member-scoped unread counts and server-authoritative read receipts; product-level pagination and archive/close lifecycle controls remain open.
- [ ] Consolidate local preview and authenticated remote modes behind a stable domain interface.

## Phase 3 — Authentication & Identity
**Status:** Main authentication implementation exists; remaining product integration work is open.
- [x] Supabase Auth email/password registration and sign-in UI.
- [x] SSR clients, middleware, protected route, callback, sign-out, and password reset routes.
- [x] Verified Auth UUID / JWT subject as canonical player identity.
- [ ] Account/session settings UI and session/device management.
- [x] Chat-owned display profile editor with server-side profile upsert and presence privacy controls; editable profile fields are presentation-only.
- [ ] Document identity handoff for eventual World of Vendrith integration; production connection remains prohibited.

## Phase 4 — Backend & Database
**Status:** Direct-message foundation implemented in Non-Production; social and group schema remain.
- [x] Chat-owned direct conversation, member, and message schema.
- [x] RLS and least-privilege grants for direct-message reads and RPC writes.
- [x] Server-derived sender identity, bounded message body, and idempotency key.
- [x] Non-Production rate-limit ledger and enforcement.
- [x] Social graph, profile, presence, group, report, and moderation database objects/RPCs are present in Non-Production; their migration files still need reconciliation into Git.
- [ ] Chat-owned player profile table and preferences.
- [ ] Friend relationship/request schema and state-transition RPCs.
- [ ] Block relationship schema and block/unblock RPCs.
- [ ] Group conversation, membership, invitation, role, and moderation schema.
- [ ] Notification preference and in-app notification persistence.
- [ ] Private attachment metadata and storage authorization design.

## Phase 5 — Realtime
**Status:** Message realtime implementation exists; social presence and event coverage remain.
- [x] Realtime publication for persisted chat messages in Non-Production.
- [x] Subscribe to active conversation and reconcile incoming messages.
- [x] Refresh persisted history after subscription and clean up subscriptions on navigation.
- [ ] Conversation-list updates for new conversations and latest-message changes.
- [ ] Realtime events for friend requests and relationship changes.
- [ ] Presence channels with expiry, privacy settings, and approximate status semantics.
- [ ] Realtime group membership and role-change events.
- [ ] Shared reconnect/backoff lifecycle and app-wide connection status.

## Phase 6 — Social & Community
**Status:** Social graph and profile UI now connected to existing Non-Production RPCs; group UI and remaining lifecycle features are next.
- [x] Player discovery/search through rate-limited RPC using public username/display name only; email addresses are not exposed.
- [x] Friend request creation, incoming/outgoing lists, accept, reject, and cancel.
- [x] Friend list, remove friend, and relationship state synchronization.
- [x] Block/unblock controls integrated with server-side relationship rules for discovery, requests, and new direct-message initiation.
- [x] Discoverability and presence privacy controls (online / last seen). Friend-request permissions remain open.
- [x] Group creation with friend selection, leave, add member, and member removal controls; invitations and join flow remain open.
- [x] Group role management controls for owner/admin/moderator/member, backed by server-side RPC permissions.
- [x] Admin/moderator management controls and owner-initiated ownership transfer; [ ] deeper audit-history presentation.
- [x] Group rename and description metadata; [ ] avatar upload, close/archive, and deletion policy.
- [x] Backend group report workflow and append-only moderation event table.
- [x] Community moderation report submission, report review, dismiss, and member-removal controls; audit-history presentation remains open.

## Phase 7 — Media & Advanced Features
**Status:** Planned after social foundation.
- [ ] Private image/file upload and download.
- [ ] MIME allow-list, byte-size limits, generated storage paths, quotas, and abuse controls.
- [ ] Attachment access restricted to active conversation members.
- [x] Private in-app notification persistence, inbox, read/unread state, and per-category preferences for messages/friends/groups/moderation; event triggers cover incoming messages, friend requests, group additions, and moderator report alerts.
- [x] Notification read/unread state and inbox controls; [ ] event-specific deep links; [x] realtime inbox refresh.
- [ ] Evaluate push provider and cost/privacy before external push implementation.
- [x] Persisted message reactions (six allowed emoji); [ ] reply context, edit/delete policy, and pinned messages.
- [ ] Accessibility and localization foundations.

## Phase 8 — Security, Operations & Production Preparation
**Status:** Planned; no production connection during implementation-first work.
- [ ] Consolidated authorization model and least-privilege database grants.
- [ ] Abuse prevention, rate-limit policy, reporting, moderation, and audit retention.
- [ ] Data retention, account deletion/export, backup/restore, and recovery procedures.
- [ ] Operational logging, error reporting, observability, and incident response.
- [ ] Performance and pagination improvements for large conversations and groups; message history still loads a bounded latest window without cursor pagination.
- [ ] Deployment configuration and environment separation documentation.
- [ ] Production integration plan for shared World of Vendrith identity, requiring separate explicit approval.

## Repository/database migration reconciliation

- [ ] Reconstruct and commit the already-applied Non-Production social, profile, presence, group, and moderation migrations missing from the repository migration folder.
- [ ] Ensure future clean environment setup can reproduce the Non-Production Chat schema without reapplying migrations to the existing Non-Production database.

## Final deferred verification phase

Only after Phases 1–8 implementation work is complete:
- Run unit, integration, E2E, browser, and manual tests.
- Verify authorization with multiple isolated Non-Production identities, including denial cases.
- Verify migrations, RLS, grants, rate limits, realtime recovery, social transitions, group permissions, media privacy, and notifications.
- Resolve release-blocking defects and record evidence.
- Obtain separate explicit approval before any production integration or production database change.

## Non-negotiable boundaries

- The Chat repository remains separate during development and integrates through documented contracts.
- Chat may eventually share canonical Supabase identity authority, but must not create a second player identity system.
- No production Auth settings, SQL, migrations, RLS changes, storage buckets, or data writes without separate explicit approval.
- No changes to World of Vendrith game data or its sign-up flow as part of Chat work.
- Never claim end-to-end functionality based only on implementation code or a successful build.


### Implementation update — 2026-11-03
- [x] Added per-membership `last_read_at` state and authenticated RPCs `chat_mark_conversation_read` / `chat_list_unread_counts` in Non-Production.
- [x] Chat client now records a read receipt when a conversation becomes active and displays server-calculated unread counts in the conversation list.
- [ ] Conversation pagination, archive/close lifecycle, notification persistence, and realtime conversation-list updates remain implementation work.
- [ ] No tests or QA were run as requested; this is implementation progress, not a verification claim.

- [x] Added per-member archive state so archiving hides a conversation only for the current player; other members retain their conversation and history.

- [x] Added authenticated `/notifications` inbox, mark-read/mark-all-read actions, and per-category preference controls.
- [x] Database triggers create private inbox notifications for incoming messages and new friend requests; archived conversations suppress new-message notifications for that member.
- [ ] Add group membership/moderation event triggers and realtime inbox updates; external push remains deferred pending provider/privacy/cost approval.

- [x] Added cursor-based loading of older messages in 50-message pages while retaining the latest-message window.

- [x] Added per-message reactions with server-side membership authorization and a fixed emoji allow-list.

- [x] Added owner/admin group name and description editing, plus explicit owner transfer (the former owner becomes admin).

- [x] Added group-added notifications for invited members and moderation-report alerts for group owners/admins/moderators.

- [x] Added a private Realtime subscription filtered to the authenticated user’s notification rows.
