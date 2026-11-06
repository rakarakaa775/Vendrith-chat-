# Vendrith Chat — Cross-Phase Audit 1–8

- **Audit date:** 2026-11-04
- **Repository:** `rakarakaa775/Vendrith-chat-`
- **Audited commit:** `4887bd268da9f0fdd350cfbce70a2ce2d85ff2a1`
- **Environment:** Vendrith Non-Production E2E `npvlokuszipgwrdipeoi` only
- **Method:** Desktop Commander connected to Codespaces Linux; six parallel review workstreams with 30 role responsibilities; read-only repository/database inspection before the explicitly listed implementation changes.

> The available execution environment exposes one Desktop Commander session, not six independent autonomous agent runtimes. The audit therefore used six parallel workstreams and 30 defined company-role responsibilities. It does not claim that six separate AI agents were spawned.

## Workspace integrity and safety

- The existing Codespaces checkout was `main` at `2dd745b`, clean, one local commit ahead and 172 commits behind `origin/main`.
- That checkout was not reset, rebased, merged, or overwritten.
- A separate detached worktree was created at `/workspaces/Vendrith-chat-audit` from the then-current `origin/main` commit `4887bd2`.
- All implementation edits in this audit are isolated to that worktree until the final reviewed commit is ready.
- No Production World of Vendrith database, Auth configuration, storage, or game data was accessed or changed.
- Post-change verification was run after the implementation pass: `npm ci`, `npm run typecheck`, `npm test` (24 passed), `npm run build`, and `git diff --check` all passed. Playwright E2E was attempted separately but did not complete in the Codespaces environment; authenticated E2E also remains unavailable until the Supabase URL is configured in the environment/Actions secrets.

## Six workstreams / 30 role responsibilities

| Workstream | Five role responsibilities |
| --- | --- |
| 1. Roadmap | Roadmap owner; scope guardian; dependency analyst; acceptance-criteria owner; evidence recorder |
| 2. Auditor | Repository auditor; frontend auditor; Auth auditor; database auditor; security auditor |
| 3. Implementer | Client implementer; RPC/migration implementer; realtime implementer; storage implementer; operations implementer |
| 4. QA Tester | Static-check planner; unit-test planner; E2E-test planner; negative-authorization planner; accessibility/device-test planner |
| 5. Integrator | API-contract integrator; identity integrator; environment integrator; migration integrator; deployment integrator |
| 6. Verifikator | Diff verifier; evidence verifier; database-state verifier; branch-safety verifier; release-gate verifier |

## Phase-by-phase findings

### Phase 1 — Foundation

**Existing:** Next.js App Router, React, TypeScript, lockfile, English primary UI, responsive app shell, local preview, CI workflow.

**Missed / open:**
- Physical desktop browser/monitor acceptance remains unverified.
- The CI workflow had not mapped the repository's GitHub Actions secrets into the Playwright process. The account secrets existed in GitHub settings, but the workflow did not consume them.

**Implemented in this audit:**
- Wired the Non-Production Supabase URL, publishable key, and first E2E account credentials into the CI job environment.
- Added a derived `E2E_SUPABASE_AUTH` flag that enables authenticated E2E only when all four required secrets exist; fork PRs or incomplete configuration remain safely skipped.
- Added a bounded 20-minute job timeout.

**Still open:** physical desktop acceptance and deferred final CI execution.

### Phase 2 — Chat Engine

**Existing:** local versioned store, message validation, idempotency, server-backed direct chat, cursor pagination, read/unread state, archive/restore, group closure.

**Missed / open:**
- Local preview and authenticated server-backed chat remain separate implementations without one stable shared domain interface.
- The final authenticated multi-account delivery/isolation acceptance is not evidenced by the current source audit.

**Still open:** unify the local/remote domain interface and complete deferred two-account acceptance.

### Phase 3 — Authentication & Identity

**Existing:** email/password Auth, SSR clients, middleware claim verification, PKCE callback, password recovery, protected routes, Auth UUID identity, account settings, session inventory.

**Missed / open:**
- Per-device revocation is not available in the current browser Auth interface.
- Shared World of Vendrith identity remains a documented future contract only; production integration is not authorized.

**Implemented in this audit:**
- Moved the privileged `auth.sessions` query into `chat_private.chat_list_my_sessions()`.
- Replaced the public RPC body with a `SECURITY INVOKER` wrapper.
- Revoked anonymous execution and kept the private function actor-scoped through `auth.uid()`.

**Database metadata verification:** public wrapper `SECURITY DEFINER=false`; private implementation `SECURITY DEFINER=true`; `anon_execute=false`; `authenticated_execute=true`. The public advisor warning for the former public-schema definer function is no longer present in the current security-advisor result.

### Phase 4 — Backend & Database

**Existing:** chat-owned conversations, members, messages, social graph, groups, moderation, invitations, notifications, reactions, pins, attachments, and rate limits in Non-Production.

**Missed / open:**
- 18 historical Chat migrations recorded in Non-Production are missing from the repository. Their exact versions and names are listed in `docs/MIGRATION-RECONCILIATION.md`.
- The historical migration bodies cannot be recovered from the migration-history table alone. They must not be fabricated from migration names.
- A clean, isolated schema-rebuild proof remains outstanding.

**Still open:** validate the recovered migration sequence on a disposable target and compare its resulting catalog with Non-Production. Do not replay the already-applied historical versions into the existing Non-Production database.

### Phase 5 — Realtime

**Existing:** message subscriptions, notification subscriptions, friend-request/group-invitation/member-change subscriptions, persisted-history refresh.

**Missed / open:**
- Presence is currently heartbeat/expiry based; no dedicated privacy-aware Realtime Presence channel is implemented.
- Group role changes are not covered by a complete realtime event contract.
- Reconnect/backoff and connection state are implemented separately per page rather than as a shared application lifecycle.

**Still open:** unified reconnect manager, privacy-aware presence events, and group role-change event coverage.

### Phase 6 — Social & Community

**Existing:** discovery, friend requests, accept/reject/cancel, friendships, block/unblock, groups, role management, moderation, invitations, profile/group avatar uploads.

**Missed / open:**
- Friend-request permission preference exists in the database profile schema but is not fully exposed as a user setting and enforced through the UI.
- Group/profile/friend avatar display and old-object cleanup were not fully wired in the client.
- The database already had a friend-request privacy RPC, now exposed as a profile preference in this audit worktree.
- Account deletion has no discovered user-facing request flow or processing worker.

**Implemented in this audit:**
- Added short-lived signed URL display for the authenticated user's profile avatar, accepted friends' avatars, and group avatars, after validating stored object paths against the expected owner/group prefixes.
- Added best-effort cleanup of prior avatar objects after successful replacement.
- Exposed the existing server-enforced friend-request permission RPC as a profile privacy toggle.
- Added responsive avatar presentation and corrected the Community refresh callback dependency on the authenticated user ID.

**Still open:** a fully operational account-deletion workflow and approved avatar-retention/cleanup policy.

### Phase 7 — Media & Advanced Features

**Existing:** private attachment bucket, MIME/size limits, quota RPCs, member-scoped storage reads, notifications, reactions, replies, message edit/delete, pinned-message controls.

**Missed / open:**
- External push delivery remains intentionally deferred pending privacy/cost/provider review.
- Broader accessibility and localization reviews remain outstanding.
- Retention/cleanup automation for obsolete media remains unimplemented.

**Still open:** accessibility review, localization foundation, retention automation, and an approved push-provider decision.

### Phase 8 — Security, Operations & Production Preparation

**Existing:** RLS, RPC-oriented writes, rate limiting, private storage, runbook, deployment guide, lifecycle policy, privacy-safe error boundary, production boundary.

**Missed / open:**
- The public session-list `SECURITY DEFINER` warning; now remediated as described under Phase 3.
- The `chat_account_deletion_jobs` table is only a service-role-owned operational queue (`user_id`, status, attempts, timestamps, error); the recovered SQL defines no user request RPC or processor. No Auth-admin/service-role worker or Edge Function was found in the application repository. A complete deletion flow must not be faked from the table alone.
- User export endpoint/UX is absent.
- Retention periods and automated cleanup are not approved/implemented.
- Centralized metrics, alerting, dashboards, and provider-backed error reporting are absent.
- Backup/restore is documented but no isolated restore exercise has been evidenced.
- Migration source reconciliation and fresh-environment reproducibility remain release blockers.

**Database advisor snapshot:**
- Seven Chat tables have RLS enabled and no policies: the rate-limit ledger, account-deletion jobs, group invitations, moderation events, group reports, notification preferences, and presence.
- A separate privilege inspection showed no direct SELECT or INSERT/UPDATE/DELETE privileges for `anon` or `authenticated` on those seven tables. This is consistent with a private/RPC-only model; the INFO finding alone is not proof of public access.
- The current Chat tables inspected have RLS enabled. Column-level SELECT grants exist where required by direct client reads; direct writes remain constrained to RPC paths.
- The avatar and attachment buckets are private. Avatar Storage policies constrain reads to self/friends or group members and uploads to the profile owner or group owner/admin.

## Changes made during this audit

1. `.github/workflows/ci.yml` — pass GitHub Actions Non-Production secrets into CI and derive the authenticated E2E enable flag.
2. `supabase/migrations/20261104071443_chat_private_session_list_rpc_hardening_v1.sql` — forward hardening migration for the session-list RPC.
3. `app/community/community-client.tsx` — private signed avatar display, old-avatar cleanup, and authenticated-user refresh dependency.
4. `app/globals.css` — profile/group avatar presentation.
5. `docs/ROADMAP.md` — reconcile stale status and checklist entries.
6. This audit report.

The session-list hardening migration was applied only to Non-Production project `npvlokuszipgwrdipeoi`. The database catalog was queried afterwards to confirm the public wrapper is invoker-security and anonymous execution is denied.

## Deferred work / release blockers

1. Validate the 18 recovered historical Chat migration sources on a disposable database and prove clean-environment reproducibility.
2. Implement account-deletion request/worker with retries, shared-history preservation, Auth/Storage cleanup, and user-visible state.
3. Implement user-scoped data export.
4. Add privacy-aware presence/reconnect lifecycle and complete group role-change realtime coverage.
5. Approve avatar-retention/cleanup policy and inspect any stale objects left by failed cleanup attempts.
6. Define and implement retention and automated cleanup.
7. Add centralized observability and alerting.
8. Rehearse backup/restore on an isolated recovery target.
9. Finish accessibility/localization and physical desktop acceptance.
10. After implementation is complete, run the deferred unit, integration, E2E, browser, cross-user authorization, and manual acceptance suite.

## Verification state

**Partially implemented; not release verified.**

The following local checks passed after the code changes: `npm ci`, `npm run typecheck`, `npm test` (24 passed, 0 failed, 0 skipped), `npm run build`, and `git diff --check`. Playwright E2E was attempted but did not finish in this Codespaces run; no E2E pass is claimed. Authenticated E2E remains gated on the Non-Production Supabase URL and the configured GitHub Actions secrets. Avatar upload/display, account isolation, and full end-to-end behavior remain unverified. The session-list hardening was separately checked through read-only database catalog/privilege metadata.

No Production World of Vendrith changes were made.

### Phase 8 validation addendum — 2026-11-04

The fresh local Supabase replay blocker listed above is resolved: all 42 migrations replayed successfully on a disposable PostgreSQL 17 stack, `supabase db lint` reported no schema errors, and the service-role-only deletion/export RPC grants and RLS posture were catalog-checked. The account export/deletion implementation and worker are now present in the isolated audit worktree. Hosted Non-Production deployment and authenticated E2E remain intentionally unperformed; see `PHASE-8-IMPLEMENTATION-VERIFICATION-2026-11-04.md` for exact verification and remaining release gates.

### Hosted Non-Production follow-up — 2026-11-04

The Phase 8 SQL migration `chat_deletion_export_operations_v1` is now applied to Vendrith Non-Production E2E only (migration version `20261104151218`). Live catalog checks confirm RLS and service-role-only grants for the new export/deletion operations, and the tombstone membership guard is active. The account-deletion worker is still not deployed because `CHAT_DELETION_WORKER_SECRET` is not configured and the connected GitHub integration cannot access repository Actions secrets (HTTP 403). Do not expose or reuse service-role credentials as a substitute. See the Phase 8 verification report for the exact remaining activation gates.

### Worker deployment addendum — 2026-11-04

`process-chat-account-deletions` v1 is deployed to Non-Production and its endpoint's missing-secret negative test returned HTTP 401. A fresh random worker secret is configured in Supabase Edge Function secrets. The local workflow now requires only the same `CHAT_DELETION_WORKER_SECRET` GitHub Actions secret (Non-Production URL is a non-sensitive constant). The workflow remains unpushed because repository Actions-secret write permission is unavailable; scheduled execution and authenticated deletion E2E are still pending.

Current Non-Production Edge Function versions: `delete-chat-account` v7, `export-chat-account` v3, and `process-chat-account-deletions` v1. The first two retain platform JWT verification. The worker validates its own dedicated secret and has platform JWT verification disabled. Its secret is present in Supabase Non-Production. The GitHub Actions workflow is still only in the isolated worktree because the connected GitHub token cannot write repository Actions secrets; the repository secret must be entered by the user and the workflow still needs to be published before scheduled execution.

### Integration audit follow-up — 2026-11-06

A fresh Playwright run exposed an environment-coupling issue in CI: when the hosted Non-Production Supabase URL and publishable key were set at job scope, the three legacy local-preview chat tests loaded the authenticated server-chat route instead of the local preview route and failed because their local composer/fixture UI was absent. The same preview suite passed when run with both Supabase public environment variables explicitly empty and both E2E mode flags disabled: **5 passed, 4 skipped** (the two hosted-auth tests and two local-Supabase Phase 9 tests are gated in that mode).

The CI workflow was adjusted to isolate these modes: the ordinary browser suite now receives empty Supabase configuration and explicit disabled E2E flags; a separate Auth-only Playwright invocation receives the Non-Production secrets and runs `e2e/auth.spec.ts`. This prevents hosted Auth configuration from contaminating mock-preview tests. The workflow parses successfully with PyYAML. Authenticated hosted E2E was not run from this audit worktree because no test credentials were supplied to this execution; GitHub Actions will exercise it only when all four expected repository secrets are configured.

Latest local verification after the application and migration changes: `npm run typecheck` passed; `npm test` passed **35/35**; `npm run build` passed; `git diff --check` passed; the isolated local-preview Playwright suite passed **5/5 executed, 4 skipped**. A separate Playwright run with the existing `.env.local` hosted configuration confirmed the three preview tests fail under that mode, which is the CI issue corrected above. The Phase 9 local-Supabase browser tests remain skipped unless the explicit loopback URL, local E2E flag, disposable account, and deletion opt-in are provided.

Deno is not installed in the active Codespaces host, so the Edge Function `deno check` commands were not rerun locally during this follow-up. CI installs Deno 2.x and runs all three checks. No hosted project, database, GitHub secret, commit, push, merge, branch switch, or deployment was changed.
