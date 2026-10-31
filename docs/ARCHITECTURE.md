# Vendrith Chat — Architecture

**Status:** Selected initial web architecture; runtime implementation pending  
**Last reviewed:** 2026-10-31

This document records the agreed architecture and current implementation boundary. It is not a claim that authentication, persistence, or messaging already work.

## 1. Product boundary

Vendrith Chat is a standalone web application during development and will later be integrated into the larger World of Vendrith website.

Chat owns only communication-domain data:
- Chat-specific display profile/preferences
- Conversations and conversation membership
- Messages and message lifecycle
- Friend relationships and blocks (subject to product approval)
- Group metadata and roles (later phase)
- Attachment metadata and notification preferences (later phase)

World of Vendrith remains the owner of player identity and all game-domain data, including worlds, maps, characters, inventory, progression, and gameplay permissions. Chat must not mutate those records.

## 2. Selected technology

- Next.js App Router
- TypeScript
- React
- Existing CSS / minimal Tailwind; avoid introducing a large UI framework without need
- Supabase Auth as the canonical identity authority
- Supabase Postgres for chat-owned persistence, subject to schema/RLS review and explicit environment approval
- Supabase SSR integration for cookie-based web sessions
- Supabase Realtime only after authorization boundaries and history recovery are verified

The application skeleton and mock responsive chat screen exist. Authentication, database schema, RLS, APIs, realtime, and real message delivery are not yet implemented.

## 3. Identity and session contract

- The stable player identity is the server/provider-verified Supabase Auth `user.id` / JWT `sub`.
- Email, username, display name, and editable user metadata are not identity or authorization keys.
- Never trust a browser-supplied `user_id`, sender ID, username, or profile field to establish identity.
- Server routes/actions must validate the trusted session/claims using the supported Supabase SSR pattern. Client-only session state is not server authorization.
- Use request-scoped server/browser clients and secure cookie handling. Keep redirect targets constrained to local application paths.
- Separate origins do not automatically share cookies. Same Supabase project does not, by itself, provide seamless cross-origin SSO.
- Do not put tokens in URLs, message bodies, logs, or analytics.

## 4. Environment boundary

Known project roles:

| Environment | Project ref | Permitted use |
| --- | --- | --- |
| Canonical World of Vendrith production | `ojtmfokjcirvjvhnbnos` | Identity authority target only; no development writes or experiments |
| Vendrith Non-Production E2E | `npvlokuszipgwrdipeoi` | Isolated test identities and explicitly approved non-production verification |

The non-production project has a separate user directory. Its test users are not production players.

- Missing or invalid configuration must fail closed or show an explicit mock preview.
- Never silently fall back to production.
- Only public publishable/legacy anon keys may be used in browser-exposed configuration.
- Never expose service-role or secret keys in client bundles.
- Production Auth settings, redirect allow-lists, SQL, migrations, RLS, storage, and data writes require separate explicit approval.

## 4.1 Phase 2 local chat-engine boundary

The first Chat Engine vertical slice uses a versioned browser-local adapter (vendrith-chat:local:v1). It is a development/test boundary, not a backend.

- Message bodies are trimmed, non-empty, and limited to 4,000 characters.
- Each send request carries a client-generated idempotency key; repeated requests with the same key do not append a second message.
- Message ordering is deterministic by timestamp and message ID. History pagination uses a stable (createdAt, id) cursor.
- A message is labelled saved_locally only after the browser storage write succeeds.
- Browser-local data is scoped to that browser profile/device. It is not visible to other players, not backed up by the app, and not synchronized across devices.
- No authentication, remote API, Supabase client, database write, or production credential is used by this adapter.
- Storage errors are surfaced while preserving the draft so the user can retry manually. Corrupt-store recovery and a dedicated retry state remain open work.

The local adapter must be replaced or wrapped by a separately reviewed server adapter before any message is represented as delivered or shared with another player. Local storage must never be treated as an authorization boundary or source of trusted sender identity.

## 5. Logical components

### Web client
Responsive conversation list, conversation detail, message composer, auth screens, and accessible loading/empty/error states. The client is an untrusted presentation layer.

### Server authorization boundary
Server components, route handlers, and server actions validate the user session and derive the principal from trusted claims. Every chat operation is scoped to that principal.

### Chat domain
Conversation creation, membership, message validation, idempotency, ordering, and lifecycle rules. Keep domain rules independent from UI components.

### Persistence
Relational chat-owned tables with constraints, indexes, and RLS. Every exposed table must have RLS enabled and policies matching the actual relationship model. RLS is not replaced by hidden UI controls or authenticated-role-only policies.

### Realtime (later)
Delivers authorized events only to conversation members. Realtime is an optimization, not the source of truth; clients recover missed events from paginated history.

## 6. Initial direct-message data model (proposal only)

A minimal first pass may use:
- `chat_profiles`: one row keyed by Auth UUID; display-only fields.
- `conversations`: UUID, direct type, timestamps, lifecycle state.
- `conversation_members`: conversation UUID, Auth UUID, joined/left timestamps, last_read_at; unique pair.
- `messages`: UUID, conversation UUID, sender Auth UUID, body, timestamps, deletion state, client idempotency key.

Before migration creation, review:
- Whether direct conversation identity is represented by a canonical pair key or another race-safe uniqueness strategy.
- How membership policies avoid recursive RLS dependencies.
- Whether clients can write membership rows directly or only through a narrowly authorized server operation.
- How message sender identity is constrained to `auth.uid()`.
- Whether updates include both `USING` and `WITH CHECK` so ownership cannot be reassigned.
- Stable chronological pagination and indexes.
- Message length, retention, deletion, and idempotency semantics.

This is a proposal, not authorization to create or apply remote migrations.

## 7. Request flow

1. Browser submits a request using its secure application session.
2. Server validates the session against the configured trusted Supabase project.
3. Server derives the principal from verified claims.
4. Input is validated and bounded.
5. Authorization checks conversation membership and applicable block/role rules.
6. Database constraints and RLS enforce the allowed operation.
7. A successful commit is the point at which the message is considered persisted.
8. Realtime may notify authorized recipients after commit; clients reconcile against persisted history.

## 8. Reliability and correctness

- Sending is idempotent using a client-generated request key.
- Do not show a failed/pending message as delivered.
- Paginate history with a stable cursor and deterministic ordering.
- Prevent duplicate direct threads under concurrent creation.
- Realtime events can be missed; history fetch must recover state.
- Presence, when added, is ephemeral and approximate, not authoritative game state.

## 9. Delivery stages

1. Repository baseline and responsive mock shell.
2. Authentication and protected server boundary.
3. Reviewed chat schema/RLS design and isolated non-production provisioning.
4. Direct-message persistence and two-test-user authorization tests.
5. Friends, blocks, presence, groups.
6. Media and notifications after privacy, abuse, and cost review.
7. Production integration only after explicit approval and release review.

## 10. Explicit non-goals

- Firebase Auth, Firestore, Firebase Storage, or Firebase Cloud Messaging.
- A second player-account database.
- Game-world mutation APIs.
- Voice/video calls, global public channels, AI chat, or push delivery in the initial MVP.
- Production database/Auth changes without separate approval.
- Claims of end-to-end functionality based only on a successful build or static preview.
