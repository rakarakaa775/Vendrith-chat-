# Vendrith Chat — Implementation Roadmap

**Last reviewed:** 2026-11-04
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

### Remaining product capabilities
- Private media/file attachments, storage authorization, quotas, and abuse controls.
- Account/session settings and device/session management.
- Group invitation/join flow, avatar upload, and deletion policy.
- Friend-request preference controls and app-wide presence/reconnect improvements.
- Notification deep links and external push evaluation.
- Pinned messages, accessibility/localization, retention/export, observability, and production integration package.

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
- [x] Realtime message subscriptions across visible conversations, deduplication, and persisted history pagination.
- [x] Cursor-based 50-message history pagination, member-scoped unread/read state, per-user archive/restore, and owner-controlled group closure.
- [ ] Consolidate local preview and authenticated remote modes behind a stable domain interface.

## Phase 3 — Authentication & Identity
**Status:** Main authentication implementation exists; remaining product integration work is open.
- [x] Supabase Auth email/password registration and sign-in UI.
- [x] SSR clients, middleware, protected route, callback, sign-out, and password reset routes.
- [x] Verified Auth UUID / JWT subject as canonical player identity.
- [x] Account settings UI, password change, current-session details, and sign-out-other-sessions; [ ] full device/session enumeration requires a server-authorized management API.
- [x] Chat-owned display profile editor with server-side profile upsert and presence privacy controls; editable profile fields are presentation-only.
- [ ] Document identity handoff for eventual World of Vendrith integration; production connection remains prohibited.

## Phase 4 — Backend & Database
**Status:** Direct-message, social, group, notification, unread/read, and reaction schema/RPCs implemented in Non-Production; migration-source reconciliation and attachment storage remain open.
- [x] Chat-owned direct conversation, member, and message schema.
- [x] RLS and least-privilege grants for direct-message reads and RPC writes.
- [x] Server-derived sender identity, bounded message body, and idempotency key.
- [x] Non-Production rate-limit ledger and enforcement.
- [x] Social graph, profile, presence, group, report, and moderation database objects/RPCs are present in Non-Production; their migration files still need reconciliation into Git.
- [x] Chat-owned player profile table and presentation/privacy preferences.
- [x] Friend relationship/request schema and state-transition RPCs.
- [x] Block relationship schema and block/unblock RPCs.
- [x] Group conversation, membership, role, reporting, and moderation schema/RPCs; invitation/join-link flow remains open.
- [x] Notification preference and in-app notification persistence.
- [x] Private attachment metadata and storage authorization design implemented in Non-Production.

## Phase 5 — Realtime
**Status:** Message realtime implementation exists; social presence and event coverage remain.
- [x] Realtime publication for persisted chat messages in Non-Production.
- [x] Subscribe to all visible conversations and reconcile incoming messages.
- [x] Refresh persisted history after subscription and clean up subscriptions on navigation.
- [x] Realtime latest-message previews and unread badge updates across all visible conversations; newly created conversations still refresh through the standard list reload.
- [x] Community client subscribes to friend-request, group-invitation, and own group-membership changes and refreshes server-backed state; final event delivery verification is deferred.
- [ ] Presence channels with expiry, privacy settings, and approximate status semantics.
- [ ] Realtime group membership and role-change events.
- [ ] Shared reconnect/backoff lifecycle and app-wide connection status.

## Phase 6 — Social & Community
**Status:** Core social graph, profile privacy, groups, moderation, ownership transfer, group closure, and audit UI are implemented; invitation flow, avatars, and deletion policy remain.
- [x] Player discovery/search through rate-limited RPC using public username/display name only; email addresses are not exposed.
- [x] Friend request creation, incoming/outgoing lists, accept, reject, and cancel.
- [x] Friend list, remove friend, and relationship state synchronization.
- [x] Block/unblock controls integrated with server-side relationship rules for discovery, requests, and new direct-message initiation.
- [x] Discoverability and presence privacy controls (online / last seen). Friend-request permissions remain open.
- [x] Group creation with friend selection, leave, add member, and member removal controls; invitations and join flow remain open.
- [x] Group role management controls for owner/admin/moderator/member, backed by server-side RPC permissions.
- [x] Admin/moderator management controls and owner-initiated ownership transfer; [x] role-restricted audit-history presentation.
- [x] Group rename/description, owner transfer, and owner-controlled close; [ ] avatar upload and deletion policy.
- [x] Backend group report workflow and append-only moderation event table.
- [x] Community moderation report submission, report review, dismiss/member-removal controls, and role-restricted audit-history presentation.

## Phase 7 — Media & Advanced Features
**Status:** Notifications, reactions, replies, message edit/delete, and inbox are implemented; private media/storage, pinned messages, accessibility, and localization remain.
- [x] Private image/file upload and download in the authenticated conversation view.
- [x] MIME allow-list, 10 MB per-file limit, generated storage paths, 100 MB account quota, and 25 MB daily upload quota enforced before upload.
- [x] Private Storage reads restricted by RLS to members of the owning conversation; uploads require a short-lived pending metadata authorization.
- [x] Private in-app notification persistence, inbox, read/unread state, and per-category preferences for messages/friends/groups/moderation; event triggers cover incoming messages, friend requests, group additions, and moderator report alerts.
- [x] Notification read/unread state, inbox controls, and realtime inbox refresh; [x] message/group and friend-request notification deep links.
- [ ] Evaluate push provider and cost/privacy before external push implementation.
- [x] Persisted message reactions, same-conversation reply context, and author-only 15-minute edit/soft-delete; [ ] pinned messages.
- [x] Route error and not-found states provide accessible recovery messaging; message pin controls include labels and keyboard-operable buttons.
- [ ] Broader accessibility audit and localization foundation remain open.

## Phase 8 — Security, Operations & Production Preparation
**Status:** Security hardening has progressed, but retention/export, observability, deployment preparation, and production integration documentation remain. No production connection is permitted during this pass.
- [ ] Consolidated authorization model and least-privilege database grants.
- [ ] Abuse prevention, rate-limit policy, reporting, moderation, and audit retention.
- [x] Data lifecycle, retention, export, and deletion requirements documented; Non-Production schema has account-deletion/tombstone/shared-history migrations.
- [x] Backup/restore and incident-response runbook documented.
- [ ] Retention windows require product approval; export endpoint/UX, scheduled cleanup, and a rehearsed restore remain open.
- [x] Privacy-safe route error boundary logs only a non-content digest; incident response and log privacy guidance documented.
- [ ] Centralized structured telemetry, alerting, dashboards, and provider-backed error reporting remain open.
- [x] Cursor-based 50-message history pagination; [ ] large-group pagination and broader performance tuning.
- [x] Non-Production deployment, environment separation, CI secret names, callback rules, and rollback guidance documented in `docs/DEPLOYMENT.md`.
- [x] Draft shared-identity integration contract exists in `docs/IDENTITY-INTEGRATION.md`; production integration remains prohibited and requires separate explicit approval.

## Repository/database migration reconciliation

- [ ] Reconstruct and commit the 18 Chat-specific Non-Production migrations missing from the repository. Exact versions, names, and safe reconstruction procedure are recorded in `docs/MIGRATION-RECONCILIATION.md`. Do not copy World of Vendrith/game-domain migrations into this repository.
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
- [x] Conversation pagination, archive/restore lifecycle, group closure, notification persistence, and realtime conversation-list updates have implementation code; final acceptance remains deferred.
- [ ] No tests or QA were run as requested; this is implementation progress, not a verification claim.

- [x] Added per-member archive state so archiving hides a conversation only for the current player; other members retain their conversation and history.

- [x] Added authenticated `/notifications` inbox, mark-read/mark-all-read actions, and per-category preference controls.
- [x] Database triggers create private inbox notifications for incoming messages and new friend requests; archived conversations suppress new-message notifications for that member.
- [x] Added group membership/moderation event triggers and realtime inbox updates; external push remains deferred pending provider/privacy/cost approval.

- [x] Added cursor-based loading of older messages in 50-message pages while retaining the latest-message window.

- [x] Added per-message reactions with server-side membership authorization and a fixed emoji allow-list.

- [x] Added owner/admin group name and description editing, plus explicit owner transfer (the former owner becomes admin).

- [x] Added group-added notifications for invited members and moderation-report alerts for group owners/admins/moderators.

- [x] Added a private Realtime subscription filtered to the authenticated user’s notification rows.

- [x] Expanded realtime subscriptions from only the active thread to all visible conversations, with duplicate-safe unread increments.

- [x] Added server-authorized replies restricted to parent messages in the same conversation, plus quoted context in the thread.

- [x] Added owner-only group closure; closed groups retain member read access and reject new message writes at the server RPC boundary.

- [x] Added persisted reaction records and same-conversation reply references with authenticated RPC entry points.

- [x] Added a moderator-only/owner/admin audit-history RPC and group Community display for moderation actions.

- [x] Added a separate archived conversation view and per-user restore action; reopening a direct conversation automatically restores it for the initiating player.

- [x] Added server-enforced 15-minute author-only edit and soft-delete operations; deletion retains a placeholder and preserves the conversation timeline.

- [x] Reconciled the filenames of all newly added migrations against the exact versions recorded by the Non-Production database; no existing migration was reapplied. Nine earlier social/group migration source files remain absent and are explicitly tracked above.

- [x] Hardened moderation notifications so the reporter’s identity is not exposed to group moderators through notification actor metadata.

- [x] Added `/settings/account` with password update, current session expiry display, and sign-out-other-sessions action.

- [x] Restored the original 30/minute and 500/hour message-send rate limits after adding group-close enforcement; idempotent retries return the original message without consuming another send quota.
