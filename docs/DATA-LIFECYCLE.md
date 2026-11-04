# Vendrith Chat — Data Lifecycle, Retention, Export & Deletion

**Scope:** Design record for Non-Production implementation and later product approval. This is not a claim that legal retention requirements have been established.

## Data categories

- Identity reference: verified Supabase Auth UUID.
- Chat profile: username, display name, discoverability, presence privacy, avatar object path, and deletion tombstone.
- Conversation data: membership, roles, group metadata, archive/read state.
- User content: message body, replies, reactions, pins, and attachment metadata/objects.
- Safety records: reports and append-only moderation events.
- Delivery metadata: notification rows, preferences, presence heartbeat, rate-limit events, and session metadata.

## Current deletion behavior evidenced in Non-Production schema

The Chat profile schema includes `deleted_at` and documents a non-discoverable pseudonymous tombstone used to render shared historical messages as “Deleted account”. The Non-Production migration history includes account-deletion and shared-history-preservation versions, and a `chat_account_deletion_jobs` table exists.

A read-only catalog inspection did not find a public account-deletion request RPC or a trigger attached to the job table/Auth users that proves the workflow is being processed. Therefore, the migration/table presence is not evidence that end-user deletion is operational. A worker or approved server-side orchestration path, idempotency/retry behavior, and full Auth/Storage cleanup still need implementation and verification.

## Retention policy decisions still required

Do not invent a retention period. Before production approval, the product owner must decide and document:
- Message and attachment retention after account deletion.
- Whether deleted messages remain as placeholders and for how long.
- Retention of reports and moderation audit records.
- Notification retention and cleanup schedule.
- Presence and rate-limit event cleanup schedule.
- Backup retention and expiry behavior.
- Legal hold and abuse-investigation exceptions.
- Export format, delivery channel, expiry, and deletion of generated export artifacts.

Until those decisions are approved, retain the current Non-Production behavior and do not add destructive scheduled cleanup.

## Export requirements

A user export must be scoped to the authenticated account and include only records the account is entitled to receive. It must not expose other users' private profile data, private conversations the user is not a member of, hidden reporter identity, internal rate-limit records, credentials, or private storage URLs.

Before implementing export:
1. Define the exact data inventory and format.
2. Use a server-authorized, rate-limited export job.
3. Generate a short-lived download mechanism with authorization checks.
4. Exclude secrets and internal security metadata.
5. Define expiry and deletion of the generated artifact.
6. Record a sanitized audit event without logging exported content.

## Deletion requirements

A production deletion workflow must:
1. Re-authenticate or otherwise verify recent account control.
2. Revoke active refresh-token sessions and document the remaining access-token expiry window.
3. Prevent new Chat actions during deletion.
4. Preserve shared conversation integrity according to the approved policy.
5. Remove or anonymize the user's profile and private avatar object.
6. Remove user-owned private attachments only when no other retention/legal rule requires preservation.
7. Remove or anonymize notifications and other private account-owned rows.
8. Retain only explicitly approved moderation/audit records with a documented lawful purpose and retention window.
9. Handle Auth-user deletion only after Chat-owned cleanup is complete and verified.
10. Return a clear completion state without claiming backup copies are instantly erased.

## Backup and restore

Backup/PITR availability, retention, and recovery guarantees depend on the active Supabase plan and settings. Confirm those facts in the project before publishing an RPO/RTO. Restore exercises must use an isolated target, never the canonical World of Vendrith production project during this development pass.
