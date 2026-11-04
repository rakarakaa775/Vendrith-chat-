# Vendrith Chat — Operations Runbook

**Scope:** Vendrith Chat Non-Production E2E only  
**Project reference:** `npvlokuszipgwrdipeoi`  
**Status:** Operational baseline; production use is not authorized.

## Environment safety

- The application configuration intentionally accepts only `https://npvlokuszipgwrdipeoi.supabase.co`.
- Never copy a production World of Vendrith URL, key, database connection string, or user data into this project.
- Never run migrations, resets, branch merges, destructive SQL, storage cleanup, or account deletion against the canonical World of Vendrith production project.
- Use the publishable key in browser configuration. Never put service-role or secret keys in `NEXT_PUBLIC_*` variables or Git.
- Missing or partial Supabase configuration must fail closed; do not add a production fallback.

## Routine operational checks

Before investigating an incident, record:
1. UTC timestamp and affected deployment URL/commit.
2. Environment and Supabase project reference (must be Non-Production).
3. Affected route and operation, without copying message bodies or personal content.
4. Request/correlation identifier if available.
5. Whether the issue affects one account, one conversation, or all users.

Review:
- Vercel deployment status and build/runtime logs.
- GitHub Actions run and step outcomes.
- Supabase Auth, Postgres, Storage, and Realtime logs for the same time window.
- Supabase security and performance advisors after any schema change.

Do not repeatedly retry a failed operation if it may create duplicate writes. Message send uses an idempotency key; preserve it when retrying the same logical send.

## Incident response

### Authentication or session incident
- Confirm the deployment points to the Non-Production project.
- Check Auth logs and callback/redirect configuration.
- Revoke affected Non-Production sessions if compromise is suspected.
- Never ask a user to send passwords, access tokens, refresh tokens, or secret keys in chat.
- Record the impact and rotate only the affected Non-Production credential through its provider.

### Authorization or privacy incident
- Treat suspected cross-user or cross-conversation access as a release blocker.
- Preserve timestamps, route, request IDs, and sanitized error metadata.
- Disable the affected feature or deployment if exposure is ongoing.
- Do not “fix” the incident by granting broad table access or disabling RLS.
- Review RPC grants, RLS policies, Storage policies, and realtime membership filters before restoring service.

### Realtime or notification incident
- Treat persisted database rows as authoritative; realtime is a delivery optimization.
- Reconcile by reloading the relevant conversation history or inbox.
- Check subscription status, reconnect lifecycle, and Postgres changes publication.
- Do not infer delivery from a client-side optimistic state.

### Attachment incident
- Keep both Chat Storage buckets private.
- Verify the authenticated user remains a member of the owning conversation before download.
- Do not share object paths or signed URLs in logs or support messages.
- If an object is suspected to be exposed, restrict access first and investigate the Storage policies and metadata authorization path.

### Data loss or corruption
- Stop writes to the affected Non-Production feature while investigating.
- Identify the last known good migration and deployment commit.
- Restore only into an isolated recovery target after checking current provider backup/restore capabilities and cost.
- Never reset the shared Non-Production database as a shortcut; it contains test identities and state that may be needed for evidence.
- Record recovery point, recovery time, affected rows/resources, and any data that could not be restored.

## Backup and restore readiness

Before any production launch, document and rehearse:
- Provider backup/PITR availability and retention for the selected plan.
- Expected recovery point objective (RPO) and recovery time objective (RTO), approved by the product owner.
- A separate restore target and access restrictions.
- Restore order for schema/migrations, Auth dependencies, Chat rows, and private Storage objects.
- Referential integrity and authorization checks after restore.
- A rollback procedure for application deployments and database migrations.

No RPO, RTO, or provider backup guarantee is asserted by this document. They must be confirmed in the Supabase project plan/settings and approved before production.

## Logging and privacy

- Never log passwords, access/refresh tokens, Authorization headers, message bodies, private attachment URLs, or exported user content.
- Prefer structured events with operation name, environment, result, latency, sanitized error code, and correlation ID.
- Restrict log access to maintainers who need it.
- Set a documented retention period for logs before production; provider defaults must be checked rather than assumed.
- Do not enable external error-reporting or analytics vendors without separate privacy, cost, and data-transfer approval.

## Release gate

A deployment is not production-ready until the deferred verification phase passes, migration sources are reproducible, access-denial tests pass, data lifecycle behavior is documented, backups are rehearsed, observability is active, and the owner separately approves production integration.
