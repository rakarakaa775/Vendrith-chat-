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

A fresh migration-history read confirms 20 Chat-specific migration versions are missing from `main`; nine source files have been recovered, leaving 11 outstanding.

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

## Outstanding 11 migrations

The following still need source recovery or full catalog-level reconstruction:

1. `20261103154849_chat_pinned_messages_v1`
2. `20261103155201_chat_attachment_rpc_security_hardening_v1`
3. `20261103162626_chat_deleted_account_identity_v1`
4. `20261103162636_chat_account_deletion_workflow_v1`
5. `20261103162909_chat_preserve_shared_history_on_account_delete_v1`
6. `20261103175205_chat_list_my_sessions_v1`
7. `20261103183150_phase5_realtime_social_events`
8. `20261103184107_phase6_group_invites_and_avatars`
9. `20261103190412_phase8_chat_fk_indexes`
10. `20261104071443_chat_private_session_list_rpc_hardening_v1`
11. `20261104151218_chat_deletion_export_operations_v1`

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

**Blocked — partial catalog evidence; 11 source files outstanding.**

The migration history proves these versions were recorded in Non-Production, but migration history does not contain the original SQL bodies. Nine historical source files are recovered. Catalog queries confirm several live objects relevant to the remaining migrations, but the definitions, policies, triggers, grants, publication memberships, and FK/index inventory have not yet been extracted comprehensively enough to author safe reconstructed migration files.

No existing Non-Production migration was reapplied. Production was not changed. No clean-database rehearsal or Chat QA/E2E was run.


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
