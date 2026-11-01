# Vendrith Chat — Roadmap

**Last reviewed:** 2026-11-01
**Current phase:** Phase 2 — Chat Engine
**Current status:** Phase 1 foundation is implemented and CI-verified; mobile and Android Chrome desktop-mode visuals were checked, while a physical desktop browser remains unverified. Phase 2 local chat engine has a tested local-only implementation; interactive browser verification remains open.

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

**Status: In progress — local-only vertical slice implemented**

- [x] Define message validation, stable ordering, cursor pagination, and client idempotency contracts.
- [x] Implement an injectable local storage adapter with versioned browser storage; no network or Supabase dependency.
- [x] Enable the composer and conversation switching against the local adapter.
- [x] Clearly label locally saved messages; do not imply delivery to another player or server synchronization.
- [x] Add domain tests for validation, message creation, duplicate requests, ordering, pagination, reload persistence, and unknown conversations.
- [x] Add a visible pending-save state, failed-save message, and retry action that reuses the same idempotency key.
- [x] Detect corrupt/unsupported local data without overwriting it; offer raw backup download and an explicit-confirmation reset.
- [x] Test retry after transient storage write failure, corrupt data preservation, schema validation, and reset confirmation.
- [x] Add Playwright browser tests for send, refresh persistence, conversation switching, mobile navigation, and transient storage failure/retry.
- [ ] Review local adapter limits and approve the server persistence contract before any backend integration.

**Current verification:** 19 unit tests pass; Playwright Chromium browser tests cover desktop send/refresh/switching, mobile navigation/composition, and transient storage failure/retry; TypeScript passes; dependency audit reports zero vulnerabilities; production build compiles and prerenders. Manual Android Chrome verification by the project owner remains open.

**Exit criteria:** deterministic chat-domain behavior and tests pass against a local/test adapter; reload persistence and UI behavior are verified; no production identity or database dependency is required.

## Phase 3 — Authentication & Identity

**Status: Planned; contract documented**

- Use verified Supabase Auth `user.id` / JWT `sub` as the canonical player identity.
- Implement request-scoped Supabase SSR clients and secure cookie/session handling.
- Implement sign-in, registration, callback, logout, and protected server routes.
- Test invalid, expired, anonymous, and cross-user identity cases using isolated test identities.

**Exit criteria:** server-verified identity gates the chat application; negative identity tests pass in non-production.

## Phase 4 — Backend & Database

**Status: Planned; schema proposal only**

- Design chat-owned profiles, conversations, membership, and messages.
- Review constraints, indexes, membership authorization, RLS, grants, and migration/rollback strategy.
- Provision and test only in the explicitly approved non-production project.
- Keep all World of Vendrith game-domain records outside Chat ownership.

**Exit criteria:** reviewed schema and RLS policies pass cross-user and non-member denial tests in non-production.

## Phase 5 — Realtime

**Status: Planned**

- Deliver committed messages to authorized conversation members.
- Recover missed events from paginated persisted history.
- Test reconnect, duplicate events, ordering, and removed-member access.

**Exit criteria:** realtime is consistent with persisted history and cannot bypass membership authorization.

## Phase 6 — Social & Community

**Status: Planned**

- Friend requests, accept/reject/remove, and block/unblock.
- Presence with expiry and privacy controls.
- Group conversations, membership lifecycle, and role permissions.

**Exit criteria:** relationship transitions, privacy, and group authorization tests pass.

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
