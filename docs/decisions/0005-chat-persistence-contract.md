# Chat Persistence Contract — Draft for Review

**Status:** Approved basis for non-production implementation; database schema and migration remain subject to separate review
**Date:** 2026-11-01
**Scope:** Replace or wrap the browser-local Chat Engine adapter with a server-backed direct-message adapter in a future, explicitly approved non-production phase.

## 1. Purpose and boundary

The current Chat Engine is a local-only vertical slice. This document proposes the minimum contract needed to persist direct messages safely without changing World of Vendrith identity ownership or touching production resources.

The project owner approved this contract as the basis for non-production implementation on 2026-11-01. This approval excludes the production project, production Auth settings, production schema, and production data. A specific database migration still requires code review and verification before it is applied to non-production.

## 2. Local adapter limitations

The existing `vendrith-chat:local:v1` adapter is suitable for UI development and deterministic single-browser tests, but not for real player communication:

- Data exists only in one browser profile/device and can be cleared by the browser or user.
- localStorage is readable and editable by same-origin JavaScript and is not encrypted or a trusted identity boundary.
- Read-modify-write is not transactional across tabs; simultaneous tabs can race and lose updates.
- There is no server authorization, conversation membership check, remote delivery, cross-device history, or reliable multi-user ordering.
- Browser quota, private browsing policies, storage eviction, and device loss can prevent persistence.
- Client timestamps and client-generated sender fields are not authoritative.

The adapter must remain clearly labelled local preview and must never silently masquerade as a remote store.

## 3. Identity contract

- Canonical player identity remains the verified Supabase Auth UUID (`auth.uid()` / JWT `sub`) owned by World of Vendrith.
- Vendrith Chat must not create a second player identity system.
- The server derives `sender_id` from a verified request-scoped session. It must ignore or reject any client-supplied sender identity.
- Email, username, display name, and editable user metadata are not authorization identifiers.
- A conversation ID supplied by a client is only a resource locator; membership must be checked on every operation.

## 4. Proposed send operation

A future authenticated server operation accepts only:

```ts
type SendMessageRequest = {
  conversationId: string;
  clientMessageId: string; // UUID generated once per logical send; reused on retry
  body: string;
};
```

Validation:

- Require a valid UUID idempotency key and a valid conversation identifier.
- Trim body; reject empty content and content longer than 4,000 characters.
- Derive the sender from verified claims; do not accept sender ID, sender name, `mine`, status, or authoritative timestamp from the client.
- Check active membership before returning history or accepting a send.
- Apply rate limits and bounded request sizes before database work.

Successful response returns the canonical persisted message, including server-generated `id`, `sender_id`, `created_at`, and the echoed `client_message_id`. Only after the server confirms commit may the UI represent the message as persisted remotely. Realtime delivery, if later enabled, occurs after commit and is not the persistence source of truth.

## 5. Idempotency and transaction behavior

Proposed database uniqueness:

`UNIQUE (conversation_id, sender_id, client_message_id)`

- The insert and idempotency lookup must be race-safe under concurrent retries.
- A retry with the same key and same normalized payload returns the original persisted message, not a second row.
- Reusing the same key with a different payload returns a conflict and must not mutate the original message.
- A client retry must reuse the original `clientMessageId`; a new logical message receives a new key.
- The UI distinguishes pending, remotely persisted, and failed states. A failed request is not shown as delivered.

## 6. Ordering and pagination

- Server-generated `created_at` and a unique immutable message ID define a deterministic order.
- Query order and cursor use the composite tuple `(created_at, id)`; do not paginate by timestamp alone.
- Cursor values are opaque to the UI where practical and validated by the server.
- The API returns bounded pages and an explicit continuation cursor.
- Realtime events are reconciled with paginated persisted history to recover missed events and deduplicate repeated events.

## 7. Authorization and data model constraints

The schema proposal in `docs/ARCHITECTURE.md` remains provisional. Before any migration:

- Every exposed table has RLS enabled and least-privilege grants.
- Message reads require active conversation membership.
- Message inserts require active membership and `sender_id = auth.uid()`.
- Clients cannot create arbitrary membership rows, change sender identity, or elevate roles.
- Membership policies must avoid recursive RLS dependencies and be tested with multiple isolated users.
- Any privileged function or server-only write path receives a separate security review.
- Cross-user, non-member, removed-member, anonymous, and impersonation-denial tests are release blockers.

## 8. Adapter interface direction

Keep UI/domain code independent of storage implementation. A future adapter should expose operations equivalent to:

```ts
interface ChatMessageStore {
  listMessages(input: { conversationId: string; before?: string; limit?: number }): Promise<MessagePage>;
  sendMessage(input: SendMessageRequest): Promise<CanonicalMessage>;
}
```

The current local adapter can implement a compatible development-only interface, but the application must select the adapter explicitly by environment. Production must fail closed when server configuration is missing; never fall back to local storage while presenting the session as authenticated or messages as shared.

## 9. Migration and rollout gates

1. Review and approve this contract.
2. Separately authorize work in the named non-production Supabase project only.
3. Verify exact Auth project identity and environment variables before any connection.
4. Review schema, indexes, uniqueness, RLS, grants, and rollback plan before migration creation/application.
5. Implement the server adapter and request-scoped identity verification.
6. Test with at least two isolated non-production users, including denial cases and concurrent duplicate sends.
7. Verify history recovery and realtime only after persisted authorization is correct.
8. Production integration requires a separate explicit approval and release plan.

## 10. Decisions requested

- Approve or revise the proposed request/response and idempotency semantics.
- Confirm the 4,000-character message limit for remote chat.
- Confirm direct-message membership is the only server-persistence scope for the first iteration; groups/friends remain out of scope.
- Confirm that the first backend implementation may target only the isolated Vendrith Non-Production E2E project, with no production connection or writes.
