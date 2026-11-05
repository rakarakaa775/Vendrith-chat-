# Vendrith Chat integration plan — 2026-11-06

## Scope and safety

This began as a read-only branch topology and integration-readiness assessment. No Git branch was checked out, moved, or merged. The subsequent focused audit made one uncommitted client correction and updated this report; no commit, push, deployment, or hosted Supabase migration was performed.

## Branch topology (all compared against `4887bd268da9f0fdd350cfbce70a2ce2d85ff2a1`)

- `origin/main` is one commit ahead and contains `ee32873` (the Non-Production deletion-worker GitHub Actions workflow).
- `origin/chore/reconcile-chat-migrations-recovered` contains `origin/main` and adds 27 commits, including recovered migration sources and reconciliation evidence.
- `origin/feat/account-data-controls-nonprod` contains `origin/main` and adds 8 commits for account settings, Edge Function sources, and roadmap updates. It does **not** contain the migration-recovery branch.
- `origin/chore/chat-deletion-worker-nonprod` is a separate, older two-commit line and is not an ancestor of `origin/main`; its worker workflow is already present on `origin/main`. It should not be merged independently without a specific missing change being identified.

## Dry-run merge results

`git merge-tree --write-tree` was run without changing the worktree:

- `origin/main` + `origin/chore/reconcile-chat-migrations-recovered`: clean, exit 0.
- `origin/chore/reconcile-chat-migrations-recovered` + `origin/feat/account-data-controls-nonprod`: clean, exit 0.

The account-data-controls branch's tree lacks the 20 migration files introduced by the recovery branch because it branched from `main`; those are not deletions relative to their common base. The three-way dry-run therefore preserves the recovered migration additions. Do not copy the account branch's tree wholesale over the recovery branch.

## Worktree-only changes (separate patch set)

The current detached worktree contains 12 tracked modifications and 38 untracked files. In addition to branch content, it includes:

- community avatar display and cleanup, friend-request privacy UI, and associated styling;
- explicit loopback-only Supabase E2E configuration and tests;
- local account-lifecycle test helpers and service-role grants migration;
- isolated local Phase 9 browser tests;
- CI split between isolated preview and authenticated Non-Production browser tests;
- follow-up audit/reconciliation documents.

These changes are not all represented by either remote feature branch. The focused audit and tests recorded below cover the avatar/storage, friend-request privacy, Edge Function, service-role, and local E2E areas; this remains a distinct patch set to carry into final branch assembly. `.env.local` remains ignored and must never be staged.

## Recommended integration order

1. Use `origin/chore/reconcile-chat-migrations-recovered` as the integration base because it already contains `origin/main` and the recovered SQL source inventory.
2. Merge `origin/feat/account-data-controls-nonprod` into that base (dry-run is clean), retaining the recovered migrations. Resolve documentation status text against the completed local Phase 9 rehearsal; do not copy stale statements wholesale.
3. Carry the audited detached worktree-only changes as a distinct patch set into the final integration tree. Preserve the avatar-path correction, exact migration versions, local E2E gating, worker/CI workflow, and least-privilege service-role grants. Do not replay migrations on hosted Supabase.
4. After assembling the final branch tree, repeat the disposable 43-file migration replay and the local checks recorded below against that exact assembled tree. Authenticated hosted Non-Production E2E remains a separate, explicitly approved activity.
5. Only after review and green CI should the user decide whether to create a commit/PR/merge. No Production integration is in scope.

## Focused worktree audit — 2026-11-06

The detached worktree was reviewed without changing branches or touching hosted Supabase projects.

### Findings and remediation

- **Group avatar field mismatch found and corrected in the worktree.** The migration stores private group avatar objects in `chat_conversations.avatar_path`, while the client previously selected/read only `avatar_url`. The client now selects `avatar_path`, signs private object paths for display, preserves the private path when editing group metadata, and cleans up the previous private object after a successful replacement. HTTPS `avatar_url` values remain supported as a legacy/external fallback.
- Avatar bucket verified private, with a 5 MiB limit and JPEG/PNG/WebP allow-list. Storage policies are scoped to the owner/accepted friends for profile avatars and current group members for group avatars.
- **Live isolated API/RLS rehearsal passed:** a recipient disabling friend requests is not requestable; enabling requests allows the flow; only the request participants see the pending request; an accepted friendship is visible to its participants; an accepted friend can create a signed profile-avatar URL; a non-friend cannot.
- **Edge Functions:** Deno 2.9.6 `check`, `lint`, and `fmt --check` passed for the three account-lifecycle functions. Unauthenticated POSTs to `delete-chat-account`, `export-chat-account`, and `process-chat-account-deletions` each returned HTTP 401.
- **Service-role grants:** verified against the fresh local catalog. Lifecycle tables have the intended scoped SELECT/INSERT/UPDATE/DELETE privileges; user-facing roles cannot execute the three service-only lifecycle RPCs. `chat_profiles` is not granted DELETE to `service_role`.

### Fresh database and browser rehearsal

- A separate disposable Supabase project was created under `/tmp/vendrith-chat-clean-rehearsal`, with non-overlapping ports and a distinct Docker project ID. It applied all **43/43 migrations from an empty database** successfully, including the catalog-reconstructed `20261104151218` source. This confirms the current SQL set replays cleanly; it does not change the historical-source caveat recorded above.
- Core local services (Postgres, Auth, Storage, Realtime, PostgREST, Kong, and Edge Runtime) became healthy. Optional Studio/Logflare/Vector services were excluded because their health checks were not required for the rehearsal and did not become healthy in this environment.
- Phase 9 local Playwright E2E passed **2/2**: unauthenticated redirect, and the UI-driven export plus deletion-request flow using a disposable local Auth account.
- Local social/privacy and avatar Storage RLS checks passed. The temporary Auth users, Chat profiles, export/deletion rows, and avatar object were cleaned up; final disposable database counts were zero Auth users and zero deletion jobs.
- The disposable Supabase stack was stopped after verification. The pre-existing `vendrith-chat-local` stack was not reset or modified.

### Updated validation

- Unit tests: **35/35 passed**.
- TypeScript typecheck: passed.
- Next.js production build: passed.
- Deno check/lint/fmt: passed (Deno 2.9.6 obtained through temporary `npx`; no package or lockfile change).
- `git diff --check`: passed.
- Phase 9 local browser E2E: **2/2 passed**.
- Fresh disposable migration replay: **43/43 passed**.
- No Production or hosted Non-Production database was accessed or changed. No commit, push, deployment, or merge was performed.

## Current readiness

The focused worktree audit and clean-database rehearsal are complete. The avatar mismatch is corrected in the uncommitted worktree, and the focused privacy, Storage, Edge Function authentication, service-role grants, unit, type, build, and local Phase 9 checks passed.

**The repository is still not merged and no branch is checked out:** `HEAD` remains detached at `4887bd2`. The original uncommitted changes and untracked migration/function/test files remain in place. The next integration action is still a deliberate assembly of the two verified remote lines plus this separate worktree delta, followed by a final review of the assembled diff. Only then should the user decide whether to stage, commit, open a PR, or merge. No such action has been taken here.

## Isolated integration worktree assembly — 2026-11-06

A separate worktree was created at `/workspaces/Vendrith-chat-integration` on branch `integration/reconcile-2026-11-06`, based on `origin/main` (`ee32873`). The original audit worktree remains detached at `4887bd2` with its uncommitted changes preserved.

Remote branch integration completed without merge conflicts:

- `origin/chore/reconcile-chat-migrations-recovered` merged as `77c3be1`.
- `origin/feat/account-data-controls-nonprod` merged as `179668f`.
- The worker workflow was already present in `main`; it was verified byte-identical and was not merged a second time.

The detached worktree delta was then carried separately. Four overlapping tracked files were not blindly overlaid: the pinned-message TypeScript typing fix was retained alongside the branch implementation; the account settings UI was upgraded to the audited password reauthentication/export/deletion version; migration-reconciliation and roadmap records were retained and extended rather than replaced. Lifecycle Edge Functions and their Deno import maps were brought forward with the shared recent-password-authentication helper. Avatar path/signing and replacement cleanup changes were carried into the community client. The session-RPC catalog-reconstruction migration retains its explicit provenance header; its SQL statements match the audited rehearsal source.

### Assembled-tree verification

- `npm ci`: completed; 49 packages audited, 0 vulnerabilities.
- Node unit tests: **35/35 passed**.
- TypeScript typecheck: passed.
- Next.js production build: passed.
- Deno 2.9.6 check, lint, and format check: passed.
- Playwright baseline with hosted/local Supabase environment variables unset and `E2E_SUPABASE_AUTH=0`: **5 passed, 4 skipped**. The skipped tests require explicit authenticated Non-Production or disposable local Phase 9 credentials.
- Migration inventory: **43/43 filenames and SQL statements match** the clean-rehearsed audit source. The catalog-reconstructed session-RPC migration has only its documented provenance comments retained in the integration tree.
- `git diff --check`: passed.

The previous disposable clean-database rehearsal and local Phase 9 authenticated flow (2/2) were completed against the audited source tree before assembly. The assembled tree contains the same 43 migration SQL statements and the same audited lifecycle function/client changes; however, the full disposable database replay and authenticated Phase 9 browser flow have **not yet been repeated against this exact integration worktree**. Those remain final gates.

No commit, push, PR, deployment, branch merge to `main`, or hosted Supabase operation was performed. The integration branch remains local and uncommitted.

## Exact integration-worktree clean-room rehearsal — 2026-11-06 (latest)

This is a fresh verification against the assembled branch at `/workspaces/Vendrith-chat-integration`, not the earlier detached audit worktree.

### Disposable database replay

- Created a separate Supabase project `vendrith-chat-integration-qa` under `/tmp/vendrith-chat-integration-rehearsal` with a unique Docker project label and non-overlapping database/Studio/Mailpit/analytics ports. The API uses `127.0.0.1:54321` because the application deliberately permits local E2E only on that exact loopback endpoint.
- The clean database applied **43/43 migrations**; `supabase_migrations.schema_migrations` also reports 43 rows.
- Catalog checks found 18 public tables and all 18 have RLS enabled; 56 public functions are present.
- The prior `vendrith-chat-local` Docker project was left untouched. No hosted Supabase URL or credentials were used.

### Local application and Edge Function checks

- The Phase 9 unauthenticated redirect test passed **1/1** against this exact integration tree and the isolated local API.
- Local `export-chat-account` and `delete-chat-account` routes rejected unauthenticated POST requests with HTTP 401 at the gateway. `process-chat-account-deletions` rejected a request without its worker secret with HTTP 401.
- The full authenticated account-level browser test passed: a disposable local Auth account signed up through the UI, downloaded its Chat data export, and submitted the deletion request. The local deletion worker then claimed one job and completed it successfully (HTTP 200).
- Deno 2.9.6 check, lint, and format checks passed for the three lifecycle functions and shared helper. There are no Deno test modules under `supabase/functions`; the attempted generic `deno test supabase/functions` therefore reported “No test modules found” and is not counted as a test pass or code failure. Lifecycle helper tests are included in the Node test suite.

### Revalidated assembled-tree checks

- Node unit tests: **35/35 passed**.
- TypeScript typecheck: passed.
- Next.js production build: passed.
- Deno check/lint/fmt: passed.
- `git diff --check`: passed.
- Playwright Phase 9 authenticated local browser E2E: **2/2 passed** (unauthenticated redirect; signup + export + deletion request).
- Clean local migration replay: **43/43 passed**.
- Post-worker cleanup: **1 deletion job completed; 0 Auth users; 1 completed receipt; 0 queued/failed jobs**.
- The isolated `vendrith-chat-integration-qa` containers and data volumes were stopped and removed after verification. The earlier `vendrith-chat-local` stack remained healthy and untouched.

No commit, push, PR, deployment, merge to `main`, or hosted database operation was performed. The integration branch remains local and uncommitted.
