# Vendrith Chat — Roadmap

**Last reviewed:** 2026-11-03
**Current phase:** Phase 6 — Social & Community
**Current status:** Phase 2–5 foundations are implemented with Non-Production Auth, database authorization, and manual realtime recovery evidence; the automated authenticated two-account chat E2E and live non-member Realtime negative test remain open. Phase 6 social graph, authenticated Friends & Community UI, friend-only expiring Presence, and group-conversation backend/UI are implemented on feat/chat-engine-server-ui and the Non-Production E2E project. The owner has manually verified profile-label synchronization, history preservation, Block/Unblock, and blocked-user Presence privacy. Group browser acceptance, automated authenticated social E2E, and reporting/moderation remain open.

A phase is complete only when its acceptance criteria are verified and evidence is recorded. Work proceeds through Planning, Implementation, QA, and Verification for every phase.

## Phase 1 — Foundation

**Status: Partially verified; local foundation is ready, external/release checks remain**

- [x] Confirm Vendrith Chat is a separate repository and owns chat-domain data only.
- [x] Define the eventual shared Supabase identity direction without connecting to production.
- [x] Select Next.js App Router, React, and TypeScript; use the Flutter reference selectively for interaction patterns only.
- [x] Build the responsive app shell, conversation list, conversation detail, mobile list/detail navigation, and conversation search.
- [x] Clearly label sample conversations and disabled composer as preview-only; no claim of message delivery or persistence.
- [x] Add environment example with placeholders only.
- [x] Add five dependency-free unit tests for conversation filtering.
- [x] Generate an npm lockfile and verify a clean `npm ci` in an isolated temporary directory.
- [x] Pin the vulnerable transitive PostCSS dependency through an npm override; `npm audit` reports zero vulnerabilities.
- [x] Configure CI to use `npm ci`, dependency audit, typecheck, unit tests, and production build.
- [x] Set English as the primary application language (`lang="en"`); additional language support remains deferred.
- [x] Track the reviewed `package-lock.json` and generated `next-env.d.ts` in Git and synchronize the foundation changes to GitHub.
- [x] Verify the running interface on mobile Chrome at two viewport sizes and in Chrome Android desktop mode.
- [ ] Verify the running interface on a physical desktop browser/monitor.
- [x] Confirm the updated GitHub Actions workflow passes on the synchronized commit.

**Verification evidence:** see [Foundation verification — 2026-11-01](audits/FOUNDATION-VERIFICATION-2026-11-01.md).

**Exit criteria:** reproducible clean install from the committed lockfile; CI audit, typecheck, unit tests, and production build pass; local app starts; responsive UI is verified in mobile and desktop browsers; preview-only behavior is explicit. No real authentication, database access, or message delivery is implied by this phase.

## Phase 2 — Chat Engine

**Status: Core engine and authenticated server-chat UI implemented; remaining automated authenticated E2E is open**

- [x] Define message validation, stable ordering, cursor pagination, and client idempotency contracts.
- [x] Implement an injectable local storage adapter with versioned browser storage; no network or Supabase dependency.
- [x] Enable the composer and conversation switching against the local adapter.
- [x] Clearly label locally saved messages; do not imply delivery to another player or server synchronization.
- [x] Add domain tests for validation, message creation, duplicate requests, ordering, pagination, reload persistence, and unknown conversations.
- [x] Add a visible pending-save state, failed-save message, and retry action that reuses the same idempotency key.
- [x] Detect corrupt/unsupported local data without overwriting it; offer raw backup download and an explicit-confirmation reset.
- [x] Test retry after transient storage write failure, corrupt data preservation, schema validation, and reset confirmation.
- [x] Add Playwright browser tests for send, refresh persistence, conversation switching, mobile navigation, and transient storage failure/retry.
- [x] Verify send, refresh persistence, and conversation switching manually in Android Chrome; owner confirmed the test message remained after refresh and after switching away and back.
- [x] Approve the chat persistence contract as the basis for non-production backend work; production remains explicitly excluded.
- [x] Implement non-production-only Supabase Auth SSR clients, middleware claim verification, email/password sign-in/sign-up, PKCE callback, and sign-out.
- [ ] Verify Auth end-to-end with a dedicated non-production test account, including sign-in, refresh, logout, and email-confirmation callback.
- [x] Review the existing E2E schema and apply the isolated `chat_messaging_core_v1` migration to non-production with explicit grants/RLS.
- [x] Implement the authenticated main Chat UI against Chat RPCs and member-scoped message history; latest 50 messages per conversation are loaded with manual refresh (owner-reported live two-account delivery and persistence are recorded; automated authenticated E2E remains pending).
- [ ] Test authenticated conversation creation, read isolation, idempotent send, and two-player delivery using dedicated non-production accounts. Draft: [Chat Persistence Contract](decisions/0005-chat-persistence-contract.md).

**Current verification (2026-11-03):** 24 unit tests pass; Playwright local-preview tests pass (5 passed, 1 authenticated redirect test skipped without explicit E2E configuration); typecheck and production build pass. Owner-reported two-account chat delivery, persistence, and manual connection recovery are recorded in the Phase 3 acceptance report. An automated authenticated two-account server-chat E2E remains pending.

**Exit criteria:** deterministic chat-domain behavior and tests pass against a local/test adapter; reload persistence and UI behavior are verified; no production identity or database dependency is required.

## Phase 3 — Authentication & Identity

**Status: Authentication implemented; acceptance partially verified**

- Use verified Supabase Auth `user.id` / JWT `sub` as the canonical player identity.
- Implement request-scoped Supabase SSR clients and secure cookie/session handling.
- [x] Implement sign-in, registration, callback, logout, and protected server routes.
- [x] Verify unauthenticated redirect and login/recovery routes in the explicit Non-Production E2E run.
- [x] Record owner-reported sign-in and two-account manual acceptance.
- [ ] Complete automated authenticated two-account server-chat E2E and remaining negative session cases.

**Exit criteria:** server-verified identity gates the chat application; negative identity tests pass in non-production.

## Phase 4 — Backend & Database

**Status: Non-Production chat schema implemented; authorization checks recorded**

- [x] Implement chat-owned conversations, membership, messages, private rate limits, and social graph tables.
- [x] Review constraints, indexes, membership authorization, RLS, grants, and migration history.
- [x] Verify member/non-member read isolation and non-member send denial in Non-Production.
- [x] Keep all World of Vendrith game-domain records outside Chat ownership; no Production changes.

**Exit criteria:** reviewed schema and RLS policies pass cross-user and non-member denial tests in non-production.

## Phase 5 — Realtime

**Status: Realtime implemented; live negative authorization check remains open**

- [x] Deliver committed messages to authorized conversation members using member-scoped Postgres Changes.
- [x] Recover missed events from persisted history after resubscription.
- [x] Verify manual Android connection-loss detection and automatic recovery/catch-up.
- [x] Cover event deduplication and deterministic ordering with unit tests.
- [ ] Complete live non-member WebSocket negative test with a member positive control.

**Exit criteria:** realtime is consistent with persisted history and cannot bypass membership authorization.

## Phase 6 — Social & Community

**Status: Social graph, friend-only Presence, and group conversations implemented; browser acceptance and moderation remain pending**

- [x] Opt-in player profiles and limited-field player search.
- [x] Friend requests, accept/decline/cancel/remove, and block/unblock.
- [x] Enforce blocks against discovery, friend requests, direct-conversation create/reopen, and new direct messages.
- [x] Add authenticated Friends & Community route with profile, search, request, friend, and block management.
- [x] Resolve current display names and @usernames in existing conversation lists and thread headers through a membership-scoped RPC; refresh labels when the chat regains focus.
- [ ] Complete live browser acceptance with two real Non-Production accounts and automated authenticated social-flow E2E.
- [x] Implement friend-only Presence with 90-second expiry, privacy controls, and membership/block authorization; browser acceptance remains pending.
- [x] Implement group conversations, membership lifecycle, and owner/admin/moderator/member authorization in Non-Production.
- [ ] Complete live browser acceptance for group creation, messaging, member add/remove/leave, role changes, and history isolation.
- [ ] Reporting and moderation workflows.

**Current evidence:** see [Phase 6 Social Graph Implementation — 2026-11-03](audits/PHASE-6-SOCIAL-GRAPH-IMPLEMENTATION-2026-11-03.md), [Conversation Profile Display Fix — 2026-11-03](audits/CONVERSATION-PROFILE-DISPLAY-FIX-2026-11-03.md), [Friend Presence Implementation — 2026-11-03](audits/FRIEND-PRESENCE-IMPLEMENTATION-2026-11-03.md), and [Group Conversations Implementation — 2026-11-03](audits/PHASE-6-GROUP-CONVERSATIONS-IMPLEMENTATION-2026-11-03.md).

**Exit criteria:** relationship transitions and privacy tests pass in transactional database verification and authenticated browser flows; group authorization tests pass in both transactional and authenticated browser flows; reporting/moderation workflows are delivered before Phase 6 is closed.

## Phase 7 — Media & Advanced Features

**Status: Planned**

- Private attachment upload/download with MIME, size, abuse, and lifecycle controls.
- In-app notifications and user preferences.
- External push delivery only after provider, privacy, and cost review.
- Other advanced features require separate product approval.

**Exit criteria:** private media access and notification preference tests pass; operational costs and retention are documented.

## Phase 8 — Security, QA & Production

**Status: Planned**

- Independent security review, abuse/rate-limit tests, and cross-user authorization tests.
- Accessibility, responsive browser/device, load, and recovery verification.
- Backup/restore, retention, observability, incident, and rollback procedures.
- Production integration only after explicit approval.

**Exit criteria:** release checklist is signed off with reproducible evidence and an approved production change plan.

## Non-negotiable boundaries

- The Chat repository remains separate during development and integrates through documented contracts.
- Chat may share the canonical Supabase project eventually, but must not create a second player identity system.
- No production Auth settings, SQL, migrations, RLS changes, storage buckets, or data writes without separate explicit approval.
- No changes to World of Vendrith game data or its sign-up flow as part of Chat work.
- No Firebase, paid managed infrastructure, voice/video, public global channels, AI chat, or game-world mutation features without separate approval.
- Never claim end-to-end functionality based only on a successful build or static preview.
