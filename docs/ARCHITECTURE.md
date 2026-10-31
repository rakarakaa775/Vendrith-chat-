# Vendrith Chat — Architecture

**Status:** Proposed foundation  
**Last reviewed:** 2026-10-31

This document defines the initial system boundaries. It is a design proposal, not a claim that these services or integrations already exist.

## 1. Product boundary

Vendrith Chat is a standalone application/service for player communication. World of Vendrith remains the owner of game worlds, gameplay state, and the canonical player identity.

Vendrith Chat owns chat-domain data only:

- Conversations and conversation membership
- Messages and message status
- Friend relationships and blocks (subject to product approval)
- Group metadata and roles
- Attachment metadata and notification preferences

It must not become the source of truth for player progression, inventory, world state, character ownership, or gameplay permissions.

## 2. Identity integration

**Principle: one player identity, multiple authorized applications.**

- Reuse the existing World of Vendrith authentication identity where technically supported.
- Do not create a parallel username/password account database for players.
- The chat backend must verify identity credentials server-side; never trust a user ID supplied only by the browser.
- Map the verified external subject to an internal chat principal using a stable, unique identity key.
- Keep authorization checks in the backend for every conversation, message, group, and attachment operation.
- Define token issuer, audience, expiry, key rotation, logout/revocation behavior, and service-to-service trust before production integration.

The exact authentication verification mechanism is an implementation decision pending inspection of the current World of Vendrith auth configuration. Do not assume that sharing a frontend session automatically authorizes backend API calls.

## 3. Logical components

### Client
Responsive web client for conversation lists, message timelines, compose controls, friend/group views, and notification settings. It is an untrusted presentation layer.

### Application API
Authenticated entry point for chat commands and queries. It validates input, applies authorization, enforces rate limits, and coordinates domain operations.

### Realtime gateway
Delivers authorized message and presence events. It must not bypass the same membership and authorization rules used by the application API. Realtime transport may be WebSocket, Server-Sent Events, or a managed equivalent; choose after a small technical spike.

### Chat domain
Contains conversation, membership, message, friendship, block, group-role, and delivery-state rules. Keep business rules independent from transport and storage details.

### Persistence
Stores chat-owned records with relational constraints and indexes. Local development must be possible without paid infrastructure. Production database/provider selection is deferred.

### Attachment storage
Stores binary media separately from message records. Use private objects and short-lived, authorization-checked access URLs. Attachment upload, scanning, size/type limits, retention, and deletion need explicit policies before launch.

### Notification delivery
Creates in-app notification events first. External push/email delivery is a later capability and must respect user preferences and consent.

## 4. Suggested request flow

1. Client presents a credential issued by the trusted identity provider.
2. API verifies the credential and resolves the chat principal.
3. API validates the requested operation and payload.
4. Domain layer checks conversation membership, block state, and role permissions.
5. Persistence commits the authorized state change.
6. Realtime gateway publishes an event only to authorized recipients.
7. Client reconciles the event with server state; it does not treat optimistic UI as proof of delivery.

## 5. Initial data model (conceptual)

- `chat_profiles`: chat-specific display preferences keyed to a verified external identity.
- `friendships`: directed request/acceptance state or a normalized relationship model; exact model to be decided.
- `blocks`: blocker and blocked principal, unique pair.
- `conversations`: direct/group type, creator, timestamps, lifecycle state.
- `conversation_members`: principal, role, joined/left timestamps, notification settings.
- `messages`: conversation, sender, body/content type, created/edited/deleted timestamps, client idempotency key.
- `message_receipts`: message, recipient, delivered/read timestamps where product requirements justify the cost.
- `attachments`: storage key, owner, MIME type, size, checksum, scan state, lifecycle state.
- `notification_events`: recipient, event type, reference, created/read timestamps.

All ownership and membership relationships require database constraints where possible. Message retrieval must be paginated and ordered with stable cursors.

## 6. Reliability and correctness

- Sending a message must be idempotent for a client-generated request key.
- A message is not considered persisted until the transaction commits.
- Realtime delivery is an optimization; clients must be able to recover missed events by fetching history.
- Define ordering guarantees per conversation; do not promise global ordering.
- Use pagination rather than loading full conversation history.
- Treat presence as ephemeral and approximate, not authoritative gameplay state.
- Define retention and deletion semantics before enabling user-generated media.

## 7. Technology selection gates

No framework or vendor is locked by this document. Before implementation, compare options against:

- Existing repository conventions and maintainability
- Local development without paid services
- Authentication compatibility with World of Vendrith
- Realtime reliability and operational complexity
- Data portability and backup/export
- Security controls and testability
- Cost at expected early usage

A likely web stack can be proposed after repository requirements and deployment constraints are confirmed. Avoid introducing a second backend/database platform solely for convenience.

## 8. Deployment boundary

Development and test environments must use isolated credentials and data. Production integration requires explicit environment separation, least-privilege credentials, backup/restore procedures, monitoring, and a rollback plan.

Never commit secrets, service-role keys, private signing keys, or production data.
