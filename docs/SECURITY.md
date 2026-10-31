# Vendrith Chat — Security Baseline

**Status:** Required design constraints  
**Date:** 2026-10-31

## Identity and sessions

- Verify tokens on the server using a trusted issuer and expected audience.
- Reject expired, malformed, unsigned, or incorrectly scoped credentials.
- Never accept a browser-provided player ID as proof of identity.
- Never expose signing secrets, service-role credentials, or privileged database keys to the client.
- Define logout, revocation, expiry, and key rotation behavior before production use.

## Authorization

- Deny by default.
- Check conversation membership on every message read, send, edit, delete, and realtime subscription.
- Check group role permissions on every membership or settings mutation.
- Prevent blocked principals from initiating prohibited interactions.
- Use private attachment storage; authorize every upload and download.
- Do not rely on hidden UI controls as security enforcement.

## Input and abuse controls

- Validate and bound message length, metadata, and attachment size/type.
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

## Operational controls

- Audit privileged group and moderation actions.
- Monitor authentication failures, authorization denials, abuse signals, and delivery failures.
- Prepare backup/restore and incident-response procedures before production launch.
- Test cross-user and cross-conversation access denial as a release blocker.

## Minimum security test cases

1. Anonymous user cannot read or send messages.
2. User A cannot read User B's private conversation.
3. Non-member cannot subscribe to a group event stream.
4. Removed member loses access immediately according to the defined consistency policy.
5. Client cannot impersonate another sender by changing payload fields.
6. Block rules are enforced server-side.
7. Invalid or oversized message payloads are rejected.
8. Private attachment URLs cannot be reused by unauthorized users.
9. Duplicate send requests do not create duplicate messages.
10. Secrets are absent from committed files and client bundles.
