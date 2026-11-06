# Phase 8 implementation verification — 2026-11-04

## Scope and safety

- Work was performed only in `/workspaces/Vendrith-chat-audit`, an isolated audit worktree.
- No Production Supabase project was accessed or modified.
- No migration was applied to the hosted Non-Production project.
- No commit, push, branch switch, or deployment was performed.

## Implemented in the audit worktree

- Added a Chat-only personal-data export Edge Function with authenticated-user verification, recent-authentication requirement, bounded pagination, a service-role-only export cooldown/audit receipt, and explicit exclusions for other users' message/profile data, attachment bytes/paths, credentials, and World of Vendrith records.
- Added the account settings UI for password update, session listing/revocation, personal-data export, and explicit account-deletion request confirmation.
- Added worker-side account-deletion processing with cross-product ownership checks, group-owner guard, profile tombstone, attachment cleanup, retryable job processing, and Auth-user deletion.
- Added the SQL support migration for deletion-job claims, cross-product reference checks, export cooldown/audit receipts, and immediate membership denial for tombstoned identities.
- Added a scheduled GitHub Actions worker workflow guarded to the configured Non-Production project URL.
- Added Deno checks for the three Edge Functions in CI. Restored the existing `workflow_dispatch` trigger while preserving the new checks.

## Verification results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 24/24 |
| `npx deno check` on all 3 Edge Functions | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Hosted Non-Production migration apply | NOT RUN — requires explicit deployment/apply step |
| Disposable local Supabase migration replay | NOT COMPLETED — local Supabase container images were still downloading; no local DB was started and no migration replay occurred |
| Authenticated browser E2E for export/deletion | NOT RUN — prior Playwright E2E attempt did not complete |

## Release blockers / follow-up

1. Complete disposable local migration replay and fix any SQL/schema incompatibilities it exposes.
2. Review the export column list against the exact deployed Non-Production schema, including all social, notification, attachment, pin, report, and moderation tables.
3. Configure the worker secret in GitHub Actions and the matching Edge Function secret in Non-Production through approved secret-management flows; never place service-role credentials in source or chat.
4. Deploy the migration and Edge Functions to Non-Production only after the disposable replay passes.
5. Run authenticated two-account/browser tests for export authorization, export completeness/privacy boundaries, deletion confirmation, immediate access revocation, worker retries, shared-history preservation, and blocked World/group ownership cases.
6. Verify scheduled worker execution and operational alerts before marking Phase 8 release-ready.

**Status: implementation changes are present in the isolated audit worktree, but Phase 8 is not release-ready and is not complete in the hosted environment.**

## Disposable local database validation update — 2026-11-04

The earlier local replay blocker is resolved. The repository's original `project_id` ends in a hyphen, which caused Docker DNS hostname resolution to fail for the local Supabase stack. For the disposable local test only, the project ID was temporarily changed to the valid local slug `vendrith-chat-local`; after validation, the original project ID was restored. No hosted project was linked or contacted.

- `supabase start`: PASS after temporary local-only project slug adjustment.
- `supabase db reset`: PASS; all 42 migrations replayed from a fresh local database, including the 18 recovered historical migrations and the Phase 8 deletion/export migration.
- `supabase db lint`: PASS — no schema errors found in `chat_private`, `extensions`, or `public`.
- Catalog assertions: PASS — core Chat tables, attachment metadata, deletion jobs, and export receipts have RLS enabled; the three service-role operational RPCs deny `anon` and `authenticated` and allow `service_role`; `chat_profiles.deleted_at` exists.
- Operational privacy tables: no client policies found for `chat_account_deletion_jobs` or `chat_data_export_events`.
- Foreign-key review: Chat messages have no sender-to-Auth FK, so shared authored history is not cascaded by Auth-user deletion; deletion jobs also have no Auth-user FK and retain their operational receipt.
- `npm run typecheck`: PASS.
- `npm test`: PASS — 24/24.
- `npm run build`: PASS — `/settings/account` is included in the production build.
- `deno check` for all three account lifecycle Edge Functions: PASS.
- `git diff --check`: PASS.

Still not tested: authenticated browser E2E, storage deletion against real objects, scheduled worker execution, hosted Non-Production migration/function deployment, and retry/blocked-ownership scenarios. The local Supabase stack was stopped after validation. The original repository project ID was restored. No hosted deployment, commit, push, or branch switch occurred.

**Updated status: disposable database migration reproducibility is verified. Phase 8 remains not release-ready until the remaining authenticated E2E, hosted Non-Production deployment/configuration, and operational checks are explicitly completed.**

## Hosted Non-Production migration update — 2026-11-04

After the disposable replay passed, the additive migration `chat_deletion_export_operations_v1` was applied to the verified Supabase project **Vendrith Non-Production E2E** (`npvlokuszipgwrdipeoi`) only. Supabase recorded version `20261104151218`.

Post-apply read-only checks passed:

- `chat_data_export_events` exists, RLS is enabled, and `anon`/`authenticated` have no table SELECT privilege.
- The deletion guard, deletion-job claim, and export-slot RPCs are executable by `service_role` only; `anon` and `authenticated` are denied.
- `chat_private.is_member` now checks the `deleted_at` tombstone before allowing conversation membership access.
- The cross-product guard executed against the live schema for a sentinel UUID without SQL errors and returned no references; no user data was changed by this check.
- The live job status constraint now permits `queued`, fixing the previously observed mismatch that would have rejected the new deletion request state.

**Remaining activation blocker:** the live project currently lists `delete-chat-account` v5 and `export-chat-account` v1, but does not list `process-chat-account-deletions`. The required `CHAT_DELETION_WORKER_SECRET` is absent from the Supabase Edge Function secrets list. The connected GitHub token cannot read or write repository Actions secrets (HTTP 403), so I did not invent or expose a shared secret and did not deploy/activate the worker. The GitHub scheduled workflow remains local and will not run until the same strong secret is configured in both Supabase Edge Function secrets and repository Actions secrets.

No Edge Function was deployed in this step, no app deployment was performed, and no Production project was accessed or modified. The live migration is additive and leaves the current app/worker behavior unchanged until the matching function rollout.

## Worker deployment update — 2026-11-04

- Generated a fresh 384-bit random `CHAT_DELETION_WORKER_SECRET` on the Codespaces host and stored it directly in the verified Non-Production Supabase project's Edge Function secrets. The value was not printed or included in repository files.
- Deployed `process-chat-account-deletions` v1 to `npvlokuszipgwrdipeoi` with platform JWT verification disabled because the function performs its own strong `x-worker-secret` authentication.
- Verified the deployed endpoint rejects an unauthenticated POST with HTTP 401 and `worker_authentication_failed`; no job claim or account deletion was triggered by this negative test.
- Updated the local GitHub Actions workflow to hardcode the non-sensitive Non-Production URL, reducing required GitHub configuration to one Actions secret: `CHAT_DELETION_WORKER_SECRET`.
- The workflow file remains in the isolated audit worktree and is not yet pushed. The connected GitHub credential still cannot write Actions secrets (HTTP 403), so the secret must be added through the repository's Settings UI after the workflow change is merged/pushed. The scheduled worker is therefore deployed but not yet automatically scheduled by GitHub Actions.

### Latest hosted function versions

- `delete-chat-account` v7: deployed from the audited queue-based implementation; platform JWT verification remains enabled.
- `export-chat-account` v3: deployed with atomic export-slot claim, export audit receipt, and `pinned_by` included in the pin export projection; platform JWT verification remains enabled.
- `process-chat-account-deletions` v1: active; platform JWT verification disabled only because the endpoint validates the dedicated 384-bit random worker secret itself.
- Supabase reports `CHAT_DELETION_WORKER_SECRET` present in the Non-Production project secret list. Only its presence/digest metadata was inspected; its value was not printed.

The GitHub Actions workflow has not been published to the repository. A GitHub Actions secret write attempt was denied by the connected GitHub token (HTTP 403). To finish the automation, the user must add repository secret `CHAT_DELETION_WORKER_SECRET` using the value held in the private Codespaces file `/tmp/vendrith-chat-worker-secret`, then publish the audited worktree workflow. Until that is done, no scheduled worker call will occur.
