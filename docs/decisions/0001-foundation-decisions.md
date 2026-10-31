# ADR 0001: Vendrith Chat foundation decisions

- **Status:** Accepted
- **Date:** 2026-10-31
- **Last reviewed:** 2026-11-01

## Context

Vendrith Chat is a separate repository for player communication in the World of Vendrith ecosystem. The game project already owns player identity and game-domain responsibilities. Chat must evolve independently without duplicating accounts or silently taking ownership of game data.

## Decisions

### 1. Separate repository and domain ownership

Vendrith Chat remains independently versioned and developed. It owns communication-domain data only. Integration with World of Vendrith occurs through documented contracts, not by sharing source files or allowing Chat to mutate game-domain records.

### 2. Canonical player identity

Use the shared canonical Supabase Auth identity. The stable player principal is the provider-verified `user.id` / JWT `sub`, never a client-supplied ID, username, or email. See [ADR 0002](0002-canonical-player-identity.md) and [ADR 0003](0003-shared-supabase-project.md).

### 3. Web application stack

Use Next.js App Router, React, and TypeScript. Adapt only relevant interaction patterns from the Flutter reference; do not copy its Firebase backend or Flutter-only dependencies. See [ADR 0004](0004-web-stack-and-reference-scope.md).

### 4. Local-first, isolated development

The preview shell and automated checks must run locally without paid managed infrastructure. Any future Supabase integration test must use the explicitly selected non-production project or local Supabase environment. Missing configuration must never fall back to production.

### 5. Server-authoritative security

The backend verifies identity and authorizes every protected operation. Client-supplied identity, hidden UI controls, optimistic UI state, and realtime subscriptions are never authorization evidence.

### 6. Dependency-driven delivery

Deliver the foundation before the chat engine, identity, persistence, realtime, social/community, media, and production hardening phases. Each phase requires planning, implementation, QA, and independent verification with recorded evidence.

## Deferred decisions

- Exact authentication UX and any cross-origin session handoff
- Chat schema, migrations, grants, RLS policies, and rollback strategy
- Realtime transport and history recovery implementation
- Hosting/deployment platform and production integration timing
- Message edit/delete, retention, moderation, and reporting policy
- Media storage, scanning, and retention

## Consequences

The architecture aligns with the eventual unified Vendrith website while preserving independent development. The current app remains a preview; this ADR does not authorize production Auth changes, database writes, migrations, or deployment.
