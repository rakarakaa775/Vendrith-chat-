# Chat Engine — Phase 2 implementation checkpoint

**Date:** 2026-11-01
**Repository:** rakarakaa775/Vendrith-chat-
**Branch at start:** main
**Starting commit:** 8c3a5bf
**Scope:** Local-only Chat Engine vertical slice; no backend or production environment access.

## Implemented

- lib/chat-engine.mjs defines message body validation, deterministic message ordering, stable cursor pagination, idempotent append behavior, and an injectable browser-storage adapter.
- lib/chat-engine.d.mts provides TypeScript declarations for the JavaScript domain module.
- app/page.tsx now enables the composer and conversation switching using browser-local persistence.
- Messages are marked saved_locally; the UI explicitly says they remain on this device and are not delivered or synchronized.
- Browser storage uses the versioned key vendrith-chat:local:v1.
- tests/chat-engine.test.mjs covers empty/oversized messages, normalization, message creation, duplicate request handling, ordering, pagination, reload persistence, unknown conversations, corrupt/unsupported data, explicit reset confirmation, and retry after a transient write failure.
- The UI now exposes a pending local-save state and a retry action that retains the same client request ID.
- Corrupt or unsupported local data is never silently overwritten; users can download the raw data and explicitly confirm a reset to sample conversations.

## Security and scope boundary

- No Supabase package, client, endpoint, migration, SQL, RLS, production Auth setting, or database write was introduced.
- No credentials were read or added.
- Local browser storage is not an authorization boundary and does not establish a trusted player identity.
- The local sender identifier is a preview placeholder only.
- A successful local storage write is not equivalent to remote delivery.

## Verification checkpoint

- npm test: 19 passed, 0 failed.
- npm run typecheck: passed.
- npm audit --audit-level=low: 0 vulnerabilities.
- npm run build: passed; Next.js compiled and prerendered the application.
- HTTP smoke: local production server returned HTTP 200.
- Interactive browser verification: pending. This environment has no installed Chromium/Chrome or Playwright/Puppeteer runner, so send/refresh behavior still needs a real browser check.
- git diff --check: passed after implementation.
- GitHub Actions for these Phase 2 changes: not yet run.

## Remaining before Phase 2 completion

1. Verify sending, refresh persistence, switching conversations, retry, and local-storage failure in a real browser.
2. Add automated UI/browser tests and review the future server persistence contract.
3. Run GitHub Actions on the synchronized commit.


## Follow-up verification — Playwright browser coverage

**Follow-up date:** 2026-11-01
**Branch:** main (working changes not yet committed at time of this record)

- Added `@playwright/test` and `playwright.config.ts`; Chromium is installed in the Codespaces environment for local headless execution.
- Added `e2e/chat.spec.ts` coverage for message save + reload persistence + conversation switching, transient local-storage write failure + preserved draft + retry, and mobile viewport navigation/composition.
- `npm run test:e2e`: 3 passed, 0 failed in Chromium.
- CI workflow now installs Playwright Chromium and runs browser interaction tests before the production build. GitHub Actions run #32 (`41304083175`) passed all steps on commit `3dfa9227142a820f806e54c779c2743b3242b304`, including browser interaction tests and production build: https://github.com/rakarakaa775/Vendrith-chat-/actions/runs/41304083175
- README and roadmap now describe the actual local-only implementation instead of the stale initial-preview status.
- Architecture documentation now records the real local adapter behavior and its cross-tab limitation. Authentication plan status was corrected to reflect the committed npm lockfile and current implementation gate.
- Added [Chat Persistence Contract — Draft for Review](../decisions/0005-chat-persistence-contract.md), documenting local adapter limits, server-side identity derivation, idempotency, ordering, authorization, and approval gates. It is explicitly a proposal, not authorization to connect to Supabase or change any database.

## Owner verification — Android Chrome

**Date:** 2026-11-01
**Environment:** Android Chrome, production Vercel deployment `vendrith-chat.vercel.app`
**Evidence:** Owner-provided screenshots and explicit confirmation in the project conversation.

- Opened the Elaria conversation and sent the message `Halo`; the UI showed `Saved on this device`.
- Reloaded the page; the `Halo` message remained visible.
- Switched to another conversation and returned to Elaria; the owner confirmed the `Halo` message was still present.
- The visible `Local preview mode` notice correctly communicates that messages are only stored in this browser/device and are not delivered to another player or synchronized.

**Result:** Manual Android Chrome checks for send, refresh persistence, and conversation switching passed. This verifies only same-browser local persistence, not remote delivery, cross-device sync, or multi-user authorization.

**Still open:** project owner review and explicit approval of the persistence contract draft before any backend integration. No Supabase or production database resources were accessed.


## Backend preparation — non-production Auth foundation

**Date:** 2026-11-01
**Approved target:** `Vendrith Non-Production E2E` (`npvlokuszipgwrdipeoi`) only
**Production boundary:** `ojtmfokjcirvjvhnbnos` was not used for connections, Auth, SQL, schema, or data operations.

### Read-only environment audit

- The approved non-production project is active and runs PostgreSQL 17.11.
- It is a shared Vendrith E2E environment, not an empty database: 220 public tables and 38 migrations were present at inspection. All 220 public tables had RLS enabled.
- The existing `profiles` and `users` structures were inspected by metadata only; Vendrith Chat does not alter or own them. Chat identity remains the verified Supabase Auth UUID.
- Existing Supabase security advisors reported 78 RLS-enabled tables without policies, 54 functions with mutable search paths, 105 authenticated-executable SECURITY DEFINER functions, and leaked-password protection disabled. These are pre-existing WOV/E2E baseline findings, not introduced by Vendrith Chat. They were not modified.
- Supabase changelog indicates that newly created public tables are no longer automatically exposed through the Data API as of 2026-10-30. Any future Chat table migration must explicitly review grants as well as RLS.

### Code implementation

- Pinned `@supabase/ssr` and `@supabase/supabase-js` and updated the npm lockfile.
- Added request-scoped browser and server clients, Next.js 15 middleware session refresh, server-side `auth.getClaims()` verification, email/password sign-in and test registration, PKCE callback exchange, and sign-out.
- Hard-restricted the application to the non-production Supabase hostname and new `sb_publishable_` key format. Wrong-project and partial configuration fail closed; production project hostname smoke test returned HTTP 503.
- Playwright with the actual non-production URL and publishable key confirmed an unauthenticated visitor is redirected to the non-production sign-in page.
- Chat UI clearly states that authentication does not yet mean messages are remote: messages remain browser-local until the separate persistence adapter is implemented.

### Verification and open gates

- TypeScript: passed.
- Unit tests: 19 passed.
- Existing browser tests: 3 passed.
- Non-production unauthenticated redirect: passed.
- Wrong-project guard: HTTP 503 verified with production hostname string; no production connection attempted.
- Dependency audit: 0 vulnerabilities.
- Production build: passed.
- Live test-account sign-in/signup, session refresh, and logout: pending.
- Chat database migration and remote message RPCs: not yet created or applied. The existing shared E2E database requires a dedicated `chat_` namespace, least-privilege grants, and reviewed membership RLS; do not alter unrelated WOV tables or remediate unrelated baseline advisor findings as part of Chat work.
