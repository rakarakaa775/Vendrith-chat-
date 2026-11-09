# Vendrith Chat — Migration History Verification

**Date:** 2026-11-10  
**Database:** Vendrith Non-Production E2E `npvlokuszipgwrdipeoi` (read-only)  
**Compared against:** `integration/reconcile-2026-11-06` (PR #3)  

## Method

The recorded SQL of every Chat migration version `>= 20261101000000` was read from `supabase_migrations.schema_migrations` (statements joined by a newline). The MD5 recomputed locally matched the database MD5 for all versions. Each recorded body was then compared with the file of the same name in the integration branch: first byte-for-byte, then after normalization (comments removed, whitespace collapsed, lower-cased).

This shows that the original SQL **is** available in the migration history table. It does not prove that a clean database built from the files has the same catalog as Non-Production; that still needs a disposable-database replay and catalog comparison.

## Result

- Versions recorded in the database: 43
- byte-identical: 2
- format-only: 34
- see note: 6
- version mismatch: 1

## Versions in Git that are not recorded in the database

- `20261105153203_chat_account_lifecycle_service_role_grants.sql`
- `20261107013000_chat_attachment_pending_upload_visibility.sql`

Each of these must be either applied through an approved process or renamed to the version already recorded in the database. Do not apply anything to the existing Non-Production database from this document.

## Per-version table

| Version | Name | MD5 of recorded SQL | Status | Note |
| --- | --- | --- | --- | --- |
| `20261101122649` | `chat_messaging_core_v1` | `52f04bb64ee449bb543f5dea93e1c059` | format-only |  |
| `20261101155621` | `chat_rpc_rate_limits` | `adcc0db15cb780194eecb32aebdb2e5c` | see note | DB uses `create function`; Git uses `create or replace function` and different table-comment text. Behaviour equivalent. |
| `20261102034513` | `enable_chat_message_realtime` | `c2a9832767af0e76eea553621bf84551` | format-only |  |
| `20261103032402` | `chat_social_graph_v1` | `42aeeeb996a5ed4401007314aa93b031` | format-only |  |
| `20261103032544` | `chat_social_directory_rpcs_v1` | `ab6c64857558185c114f8689ff48e453` | format-only |  |
| `20261103034300` | `chat_conversation_profiles_v1` | `9331dca4586ab8017c0bbcf7f1d1bbaf` | format-only |  |
| `20261103035600` | `chat_friend_presence_v1` | `891b7a50139d202c90f828677dddbd5a` | format-only |  |
| `20261103040851` | `chat_profile_presence_column_grants_v1` | `9b071ee814f72783da2f3e7cfb4c9565` | format-only |  |
| `20261103045533` | `chat_group_conversations_v1` | `15681c745c5d16b0b55eede891d90f41` | format-only |  |
| `20261103045720` | `chat_group_two_member_minimum_v1` | `bdf1bfa7503c533d40a99b96b8da7374` | format-only |  |
| `20261103051345` | `group_reporting_moderation_v1` | `fa68f4c9f27c88fca7b74b11222fbde5` | format-only |  |
| `20261103051548` | `group_report_resolution_validation_v1` | `9685fb5a55e1febf3717ccc47015eead` | format-only |  |
| `20261103065811` | `chat_get_my_profile_rpc_v1` | `61c77e3ca887ffba2d4cb5a05978bc2a` | format-only |  |
| `20261103070242` | `chat_unread_read_state_v1` | `263ffb367f58d30e7c0e4275313e9ec9` | byte-identical |  |
| `20261103070327` | `chat_conversation_archive_v1` | `757676957a6a022ff50e22d5fa5d025e` | format-only |  |
| `20261103070354` | `chat_member_archive_read_grant_v1` | `f6f91a8e8c0db8c0770e5c9220ded627` | format-only |  |
| `20261103070441` | `chat_notifications_preferences_v1` | `547927165d3baab9ad1e537108e36122` | see note | Local alias names differ (`current_user_row` vs `u`). Equivalent. |
| `20261103070640` | `chat_message_reactions_v1` | `e0da1bdb502c8c26f7c239e06c5a5718` | format-only |  |
| `20261103070747` | `chat_group_metadata_v1` | `bd2118b6fc73933add3b98c1f09646cf` | format-only |  |
| `20261103070830` | `chat_group_notifications_v1` | `476e98bbc247b106a306663756befc75` | format-only |  |
| `20261103070853` | `enable_chat_notification_realtime` | `07ce4b315b1e2e3adc66a9562e1bc0a7` | byte-identical |  |
| `20261103071009` | `chat_message_replies_v1` | `3c6efa46b2db7a36230aac1f709bdb86` | format-only |  |
| `20261103071103` | `chat_group_close_lifecycle_v1` | `16e7d7cd7b346a9743b10377adc97ee1` | format-only |  |
| `20261103071205` | `chat_group_moderation_history_rpc_v1` | `820217d4284f059191acfb3662f174a9` | see note | Alias names differ (`event_row` vs `e`). Equivalent. |
| `20261103071248` | `chat_reopen_archived_direct_conversation_v1` | `122432e812bcf477df15e82b920e86af` | see note | Alias names differ (`target_user` vs `u`). Equivalent. |
| `20261103071355` | `chat_group_metadata_reply_authorization_hardening_v1` | `8b4afd6559d848b734eea9f561702dbc` | format-only |  |
| `20261103071457` | `chat_message_edit_delete_v1` | `67a7ca4db0ebdf00824b96b05bb526db` | format-only |  |
| `20261103071810` | `chat_report_notification_reporter_privacy_v1` | `c56d0147724847f47ba29b7563f627f2` | format-only |  |
| `20261103072103` | `chat_restore_send_message_rate_limits_v1` | `52e6d8cff55f322cae88d6dc2e2cd9dc` | format-only |  |
| `20261103153634` | `chat_private_attachments_v1` | `6985866cb2c762e81b5bfb7098deec53` | format-only |  |
| `20261103153644` | `chat_confirm_attachment_rowcount_fix` | `188f85bff9f4319669b9ae3b5723c788` | format-only |  |
| `20261103154849` | `chat_pinned_messages_v1` | `c7f070b295e3834f48291355c2f021f6` | format-only |  |
| `20261103155201` | `chat_attachment_rpc_security_hardening_v1` | `5e9697779caca87f826a8197399694ff` | see note | Regex bracket escaping differs (`[/\\]` in DB, `[/\\\\]` in Git). Both appear to match the same characters (`/` and `\`). Review recommended. |
| `20261103162626` | `chat_deleted_account_identity_v1` | `e770489b2405eb291c21ff79719bbba4` | format-only |  |
| `20261103162636` | `chat_account_deletion_workflow_v1` | `aa02a65611e18808d753c79f1ee163ed` | format-only |  |
| `20261103162909` | `chat_preserve_shared_history_on_account_delete_v1` | `5957d2a6b82ca0b216b909eeead523c1` | format-only |  |
| `20261103175205` | `chat_list_my_sessions_v1` | `677472369ac730f3b6d15d4494c31905` | format-only |  |
| `20261103183150` | `phase5_realtime_social_events` | `b371dbb12b83df40a128e2ed8236704a` | format-only |  |
| `20261103184107` | `phase6_group_invites_and_avatars` | `ccb5b4481bced39454dca6d845601d54` | see note | Recorded SQL is only `select 1;`. The Git file is a catalog-derived reconstruction of the Phase 6 objects (group invitations, avatars). Not original SQL. |
| `20261103190412` | `phase8_chat_fk_indexes` | `b5abdb5ad9ba77eeefea5e3b03013335` | format-only |  |
| `20261104071443` | `chat_private_session_list_rpc_hardening_v1` | `bfb25b43d8a6b7b35d8ee521703987d3` | format-only |  |
| `20261104151218` | `chat_deletion_export_operations_v1` | `c1d9d733ba8d85016c55baa50db29cb9` | format-only |  |
| `20261106182923` | `chat_attachment_pending_upload_visibility` | `0a14834d02e30bc1fa5b58e0db843ef1` | version mismatch | Same SQL (ignoring whitespace) is committed in Git as `20261107013000_chat_attachment_pending_upload_visibility.sql` (different version number). |
