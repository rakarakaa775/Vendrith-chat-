# Vendrith Chat — Security Baseline

**Status:** Required design constraints  
**Date:** 2026-10-31

## Identity and sessions

- Canonical principal: verified Supabase Auth UUID `user.id` / JWT `sub`.
- Verify sessions/claims on the server against the explicitly configured trusted project.
- Reject expired, malformed, unsigned, anonymous, or incorrectly scoped credentials where the product requires a registered player.
- Never authorize using browser-provided player IDs, usernames, email addresses, or editable `user_metadata`.
- Never expose signing secrets, service-role credentials, or privileged database keys to the client.
- Do not assume same-project apps on separate origins share browser cookies or provide seamless SSO.
- Define logout, revocation, expiry, and key rotation behavior before production use.

## Authorization

- Deny by default.
- Check conversation membership on every message read, send, edit, delete, and realtime subscription.
- Every exposed table must have RLS enabled; grants and RLS are separate controls.
- `TO authenticated` alone is not authorization. Policies must include ownership/membership predicates.
- UPDATE policies need both `USING` and `WITH CHECK` to prevent a user from reassigning ownership.
- Avoid RLS policy designs that recursively query the same membership table without a reviewed strategy.
- Do not use `SECURITY DEFINER` as a shortcut around RLS. Any privileged function requires a separate security review, restricted schema/execute grants, explicit identity checks, and tests.
- Views must not accidentally bypass RLS; review security-invoker behavior and grants.
- Do not let clients create arbitrary membership rows, elevate roles, or change conversation ownership.
- Group role permissions must be checked server-side for every membership or settings mutation.
- Block rules must be enforced server-side, not only hidden in the UI.
- Use private attachment storage and authorize every upload/download when media is introduced.

## Input and abuse controls

- Validate and bound message length, metadata, and attachment size/type.
- Reject empty/whitespace-only messages.
- Encode untrusted content on output; do not render raw user HTML.
- Rate-limit authentication-sensitive and message/friend/group operations.
- Add spam/reporting controls before broad public access.
- Use idempotency keys for message submission.
- Avoid logging message bodies, credentials, or private attachment URLs by default.

## Data protection

- Keep development, test, preview, and production data isolated.
- Store only data needed for the product.
- Define retention, export, deletion, and backup policies.
- Use TLS in transit and encryption at rest through the selected storage platform.
- Keep secrets in environment/secret management, never in Git.
- Use least-privilege service credentials.
- Do not silently fall back to production when non-production configuration is missing.

## Operational controls

- Audit privileged group and moderation actions.
- Monitor authentication failures, authorization denials, abuse signals, and delivery failures.
- Prepare backup/restore and incident-response procedures before production launch.
- Test cross-user and cross-conversation access denial as a release blocker.
- Pin Supabase package versions and commit the package-manager lockfile.

## Minimum security test cases

1. Anonymous user cannot read or send messages.
2. User A cannot read User B's private conversation.
3. Non-member cannot subscribe to a group event stream.
4. Removed member loses access according to the defined consistency policy.
5. Client cannot impersonate another sender by changing payload fields.
6. Block rules are enforced server-side.
7. Invalid or oversized message payloads are rejected.
8. Private attachment URLs cannot be reused by unauthorized users.
9. Duplicate send requests do not create duplicate messages.
10. Ownership cannot be reassigned by a malicious UPDATE.
11. Missing non-production configuration cannot connect to production.
12. Secrets are absent from committed files and client bundles.

## Production gate

No production Auth settings, redirect allow-list changes, SQL, migrations, RLS changes, storage buckets, or data writes are authorized by this baseline. Obtain explicit approval after isolated non-production verification and a documented rollback plan.
