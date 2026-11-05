# Vendrith Chat — Non-Production Migration Reconciliation

**Audited:** 2026-11-04  
**Repository:** `rakarakaa775/Vendrith-chat-`  
**Branch:** `chore/reconcile-chat-migrations-recovered`  
**Database:** Vendrith Non-Production E2E `npvlokuszipgwrdipeoi`  
**Method:** Read-only comparison of Supabase migration history with committed `supabase/migrations/` filenames and targeted PostgreSQL catalog extraction.

## Scope and safety

The Non-Production project is a shared Supabase database that also contains World of Vendrith/game-domain migrations. Those game-domain migration sources are outside this Chat repository and must not be copied into the Chat migration folder. This reconciliation tracks only the Chat-specific migration versions identified in the database history.

No migration was applied, rolled back, reset, or re-run during this audit. No Production schema was changed.

## Chat migrations present in the database but missing from this repository

| Version | Database migration name | Notes |
| --- | --- | --- |
| `20261103032402` | `chat_social_graph_v1` | Social graph schema |
| `20261103032544` | `chat_social_directory_rpcs_v1` | Directory/search RPCs |
| `20261103034300` | `chat_conversation_profiles_v1` | Conversation profile lookup |
| `20261103035600` | `chat_friend_presence_v1` | Friend presence |
| `20261103040851` | `chat_profile_presence_column_grants_v1` | Profile/presence grants |
| `20261103045533` | `chat_group_conversations_v1` | Group conversation schema |
| `20261103045720` | `chat_group_two_member_minimum_v1` | Group membership constraint |
| `20261103051345` | `group_reporting_moderation_v1` | Reports and moderation |
| `20261103051548` | `group_report_resolution_validation_v1` | Report resolution validation |
| `20261103154849` | `chat_pinned_messages_v1` | Pinned message records and RPCs |
| `20261103155201` | `chat_attachment_rpc_security_hardening_v1` | Attachment RPC hardening |
| `20261103162626` | `chat_deleted_account_identity_v1` | Deleted-account identity/tombstone |
| `20261103162636` | `chat_account_deletion_workflow_v1` | Account deletion workflow |
| `20261103162909` | `chat_preserve_shared_history_on_account_delete_v1` | Shared history preservation |
| `20261103175205` | `chat_list_my_sessions_v1` | Authorized session listing RPC |
| `20261103183150` | `phase5_realtime_social_events` | Realtime social event publication |
| `20261103184107` | `phase6_group_invites_and_avatars` | Group invitations and avatar support |
| `20261103190412` | `phase8_chat_fk_indexes` | Chat foreign-key indexes |
| `20261104071443` | `chat_private_session_list_rpc_hardening_v1` | Move session-list SECURITY DEFINER implementation behind private schema |
| `20261104151218` | `chat_deletion_export_operations_v1` | Account deletion queue, export audit, and worker RPCs |

## Recovery progress

A previous repository branch, `feat/chat-engine-server-ui`, contains source SQL for nine of the missing migrations. Those files have been copied without changing their SQL bodies into this reconciliation branch, using the exact version prefixes and names recorded by the Non-Production migration history:

- `20261103032402_chat_social_graph_v1.sql`
- `20261103032544_chat_social_directory_rpcs_v1.sql`
- `20261103034300_chat_conversation_profiles_v1.sql`
- `20261103035600_chat_friend_presence_v1.sql`
- `20261103040851_chat_profile_presence_column_grants_v1.sql`
- `20261103045533_chat_group_conversations_v1.sql`
- `20261103045720_chat_group_two_member_minimum_v1.sql`
- `20261103051345_group_reporting_moderation_v1.sql`
- `20261103051548_group_report_resolution_validation_v1.sql`

A fresh migration-history read confirms 20 Chat-specific migration versions are missing from `main`. Eighteen source files have now been recovered into this branch; two versions remain unresolved.

## Catalog evidence collected (read-only)

Targeted catalog queries against Non-Production confirmed the current state includes:

- `public.chat_message_pins`, with UUID primary key, conversation/message/user references, timestamp, and member-only SELECT RLS policy.
- `chat_private.pin_message(uuid)` and `chat_private.unpin_message(uuid)`; pinning checks registered authentication, membership, open conversation, serializes per-conversation writes, and enforces a maximum of 10 pins.
- `public.chat_group_invitations`, with inviter/invitee, status and response timestamps, plus inbox/outbox and pending-pair indexes.
- `chat_private.create_group_invitation(uuid, uuid)`, `respond_group_invitation(uuid, boolean)`, `cancel_group_invitation(uuid)`, and invitation-cancellation trigger functions.
- `chat_private.prepare_attachment(uuid,text,text,bigint)` and `confirm_attachment(uuid)`; current preparation logic checks registered authentication, filename/MIME/size, membership, closed-conversation status, and storage quotas.
- `public.chat_account_deletion_jobs` and `public.chat_data_export_events`, including queue claim index and export audit index.
- `chat_private.chat_deletion_world_reference_tables(uuid)`, `claim_chat_account_deletion_jobs(integer)`, and `chat_private.chat_list_my_sessions()`.
- Current profile/conversation catalog includes soft-delete marker `chat_profiles.deleted_at`, profile avatar path, and group avatar path.

This is evidence of the current live schema, **not proof of the exact historical SQL body** of each migration. Some catalog output was intentionally narrowed after the initial broad query exceeded response limits. The catalog extraction is therefore partial, not yet a complete reconstruction package.

## Additional nine historical sources recovered from local Git history

Desktop Commander inspected the separate Codespaces worktrees and located the original blobs for these nine migrations in the local Git object database. For every file, `git hash-object <file>` matched `git rev-parse <source-commit>:<path>` exactly. The unchanged files were copied into this branch:

| Migration file | Source commit (short) | Verification |
| --- | --- | --- |
| `20261103154849_chat_pinned_messages_v1.sql` | `9946111` | Blob hash exact match |
| `20261103155201_chat_attachment_rpc_security_hardening_v1.sql` | `39de207` | Blob hash exact match |
| `20261103162626_chat_deleted_account_identity_v1.sql` | `89f5f25` | Blob hash exact match |
| `20261103162636_chat_account_deletion_workflow_v1.sql` | `89f5f25` | Blob hash exact match |
| `20261103162909_chat_preserve_shared_history_on_account_delete_v1.sql` | `89f5f25` | Blob hash exact match |
| `20261103175205_chat_list_my_sessions_v1.sql` | `1e5975e` | Blob hash exact match |
| `20261103183150_phase5_realtime_social_events.sql` | `990cc54` | Blob hash exact match |
| `20261103184107_phase6_group_invites_and_avatars.sql` | `4a4633f` | Blob hash exact match |
| `20261103190412_phase8_chat_fk_indexes.sql` | `cd48623` | Blob hash exact match |

These nine are historical source recovery, not catalog reconstruction. Their source commit provenance and exact blob hashes were checked using Desktop Commander on the connected Codespaces device.

## Two catalog-reconstructed migration sources

The remaining two source files have been reconstructed from the current Non-Production PostgreSQL catalog and added under the exact version identifiers recorded by Supabase. They are explicitly labeled as reconstructed; neither is represented as the original historical SQL body.

### `20261104071443_chat_private_session_list_rpc_hardening_v1.sql`

The current catalog matches the reconstructed implementation:

- `chat_private.chat_list_my_sessions()` is a stable SECURITY DEFINER function with an empty search path, restricted to the caller's `auth.uid()`, and excludes expired sessions.
- `public.chat_list_my_sessions()` is a SECURITY INVOKER wrapper over the private function.
- Current privileges show authenticated execution, no anon execution, authenticated schema usage, and no service-role execution on the private function. The public wrapper is executable by authenticated and service_role.
- Both current function definitions and the relevant ACL/privilege checks were inspected read-only.

### `20261104151218_chat_deletion_export_operations_v1.sql`

The reconstructed migration was compared with the current live definitions:

- `chat_account_deletion_jobs` has the queued default, retry/lock columns, constrained status values, non-negative attempts, user-id primary key, and partial claim index for queued/failed work.
- `chat_data_export_events` has the expected UUID, user, timestamp, and JSON row-count fields; RLS is enabled, there are no user-facing policies, and table privileges are limited to service_role (apart from owner privileges).
- The export audit index, queue claim index, constraints, and table columns were read from PostgreSQL catalogs.
- Function definitions for `chat_private.chat_deletion_world_reference_tables(uuid)`, `chat_private.claim_chat_account_deletion_jobs(integer)`, `public.chat_deletion_world_reference_tables(uuid)`, `public.chat_claim_account_deletion_jobs(integer)`, `public.chat_claim_data_export_slot(uuid)`, and `chat_private.is_member(uuid)` match the reconstructed source. The latter denies membership to tombstoned identities.
- Function execute privileges and schema usage were inspected read-only.

A local untracked draft named `20261104100000_chat_deletion_export_operations_v1.sql` had no Git-history provenance and did not use the exact version recorded in Supabase. It was not copied under that name or claimed as historical source. Its contents were used only as a review lead; the committed `20261104151218` file has an explicit catalog-reconstruction header.

## Required reconciliation procedure

1. Retrieve original SQL for each missing version from an authoritative Git history/source, if available.
2. If original SQL is unavailable, extract the complete current definitions: tables, constraints, indexes, functions, triggers, grants, RLS policies, Realtime publication membership, and Storage policies.
3. Clearly label catalog-derived reconstruction as reconstructed; do not present it as the original migration body.
4. Review dependency order and compare the reconstructed source against the live Non-Production state.
5. Commit migration source only after review, using exact version prefixes.
6. Validate a fresh isolated database by applying the complete migration sequence to that disposable target.
7. Do not apply these already-recorded versions to the existing Non-Production database.
8. Do not apply, merge, reset, or reconcile anything against the canonical World of Vendrith Production project.

## Current status

**Source inventory complete — 20/20 files present; 18 historical and 2 catalog-reconstructed.**

All 20 migration versions recorded in Non-Production now have corresponding files in this branch. The 18 historical files were verified against their source Git blobs by exact hash comparison. The remaining two files are catalog reconstructions and are labeled as such. A PostgreSQL SQL parser successfully parsed all 42 migration files in the branch; this checks top-level SQL syntax but does not compile PL/pgSQL function bodies. No disposable database replay has been performed, so migration reproducibility is not yet proven.

No existing Non-Production migration was reapplied. Production was not changed. No clean-database rehearsal or Chat QA/E2E was run; QA/E2E remains deferred until Phase 9.


### Additional catalog pass — constraints, triggers, and indexes

A second read-only catalog pass extracted current constraints and trigger definitions for the Chat tables. Evidence includes:

- Pinned messages: unique `(conversation_id, message_id)`, foreign keys to conversations/messages/auth users, and cascade behavior.
- Group invitations: distinct inviter/invitee check, status constraint, conversation/user foreign keys, plus pending inbox/outbox and uniqueness indexes.
- Account deletion jobs: primary key on `user_id`, non-negative attempts check, constrained lifecycle status values, and partial claim index over due queued/failed jobs.
- Export audit: primary key, JSON object check for row counts, and per-user descending timestamp index.
- Attachment constraints: 1–10 MB byte-size limit, allowed MIME list, filename length, pending/ready status, object-path uniqueness, and conversation/uploader foreign keys.
- Realtime-related trigger inventory currently includes group invitation cancellation on group close, friendship end, and inviter membership removal, plus friend/group notification triggers.
- The query returned no Chat-named publication table rows for the publication filter used; this is not enough to conclude the social Realtime migration has no publication entries. Publication membership needs a separate exact query against `pg_publication_tables` and `pg_publication`.

This second pass improves the reconstruction evidence but still does not establish the exact historical migration bodies or fully cover all grants, policies, and function definitions.
