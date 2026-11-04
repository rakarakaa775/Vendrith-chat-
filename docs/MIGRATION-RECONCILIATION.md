# Vendrith Chat — Non-Production Migration Reconciliation

**Audited:** 2026-11-04  
**Repository:** `rakarakaa775/Vendrith-chat-`  
**Branch:** `main`  
**Database:** Vendrith Non-Production E2E `npvlokuszipgwrdipeoi`  
**Method:** Read-only comparison of Supabase migration history with committed `supabase/migrations/` filenames.

## Scope and safety

The Non-Production project is a shared Supabase database that also contains World of Vendrith/game-domain migrations. Those game-domain migration sources are outside this Chat repository and must not be copied into the Chat migration folder. This reconciliation tracks only the Chat-specific migration versions identified in the database history.

No migration was applied, rolled back, reset, or re-run during this audit.

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

The database also contains the three earlier Chat migrations and the later Chat migrations that are already committed. The exact complete version list must be re-read at the start of any future reconciliation operation.

## Required reconciliation procedure

1. Retrieve the original SQL for each missing version from an authoritative source, if available.
2. If the original SQL is unavailable, reconstruct each migration from the exact current schema, policies, triggers, function definitions, grants, publication membership, and Storage policies in the Non-Production database.
3. Compare the reconstructed source against the database state and review dependencies and execution order.
4. Do not invent a migration body from its name or from current UI behavior.
5. Commit source files with the exact version prefixes only after review.
6. Validate a fresh isolated database by applying the complete migration sequence to that disposable target.
7. Do not apply these already-recorded versions to the existing Non-Production database.
8. Do not apply, merge, reset, or reconcile anything against the canonical World of Vendrith production project.

## Current status

<badge>Blocked — source reconstruction required</badge>

The migration history proves these versions were recorded in Non-Production, but the migration history does not contain the original SQL bodies. Recreating exact source files safely requires catalog-level extraction and review. This document intentionally does not fabricate SQL or mark the repository reproducible.
