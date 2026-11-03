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
- [ ] Product-level conversation pagination, unread/read state, and lifecycle controls.
- [ ] Consolidate local preview and authenticated remote modes behind a stable domain interface.

## Phase 3 — Authentication & Identity
**Status:** Main authentication implementation exists; remaining product integration work is open.
- [x] Supabase Auth email/password registration and sign-in UI.
- [x] SSR clients, middleware, protected route, callback, sign-out, and password reset routes.
- [x] Verified Auth UUID / JWT subject as canonical player identity.
- [ ] Account/session settings UI and session/device management.
- [ ] Chat-owned display profile editing; editable profile fields must never authorize access.
- [ ] Document identity handoff for eventual World of Vendrith integration; production connection remains prohibited.

## Phase 4 — Backend & Database
**Status:** Direct-message foundation implemented in Non-Production; social and group schema remain.
- [x] Chat-owned direct conversation, member, and message schema.
- [x] RLS and least-privilege grants for direct-message reads and RPC writes.
- [x] Server-derived sender identity, bounded message body, and idempotency key.
- [x] Non-Production rate-limit ledger and enforcement.
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
**Status:** Next major implementation phase.
- [ ] Player discovery/search with safe, rate-limited lookup fields; never expose email addresses.
- [ ] Friend request creation, incoming/outgoing lists, accept, reject, and cancel.
- [ ] Friend list, remove friend, and relationship state synchronization.
- [ ] Block/unblock players; define prevention of new direct-message initiation and behavior for existing conversations.
- [ ] Privacy settings for discoverability and friend-request permissions.
- [ ] Group creation, invitations, join/leave, and member removal.
- [ ] Group roles: owner, admin, moderator, and member, enforced server-side.
- [ ] Admin/moderator management and safe ownership transfer.
- [ ] Group rename, description, avatar metadata, close/archive, and deletion policy.
- [ ] Community moderation actions and audit trail for privileged actions.

## Phase 7 — Media & Advanced Features
**Status:** Planned after social foundation.
- [ ] Private image/file upload and download.
- [ ] MIME allow-list, byte-size limits, generated storage paths, quotas, and abuse controls.
- [ ] Attachment access restricted to active conversation members.
- [ ] In-app notifications and per-category preferences.
- [ ] Notification read/unread state and deep links.
- [ ] Evaluate push provider and cost/privacy before external push implementation.
- [ ] Message reactions, reply context, edit/delete policy, and pinned messages.
- [ ] Accessibility and localization foundations.

## Phase 8 — Security, Operations & Production Preparation
**Status:** Planned; no production connection during implementation-first work.
- [ ] Consolidated authorization model and least-privilege database grants.
- [ ] Abuse prevention, rate-limit policy, reporting, moderation, and audit retention.
- [ ] Data retention, account deletion/export, backup/restore, and recovery procedures.
- [ ] Operational logging, error reporting, observability, and incident response.
- [ ] Performance and pagination improvements for large conversations and groups.
- [ ] Deployment configuration and environment separation documentation.
- [ ] Production integration plan for shared World of Vendrith identity, requiring separate explicit approval.

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
