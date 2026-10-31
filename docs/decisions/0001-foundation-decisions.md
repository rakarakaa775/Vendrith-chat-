# ADR 0001: Vendrith Chat foundation decisions

- **Status:** Proposed
- **Date:** 2026-10-31

## Context

Vendrith Chat is a new repository intended to provide player communication for the World of Vendrith ecosystem. The repository was confirmed empty on its default branch. The game project already has its own identity and runtime responsibilities, so chat must not silently duplicate those responsibilities.

## Decisions

### 1. Separate repository

Vendrith Chat remains independently versioned and developed. Integration with World of Vendrith occurs through documented contracts, not shared source edits.

### 2. Reuse canonical player identity

Chat will verify the existing trusted identity rather than creating duplicate player accounts. Exact token verification and identity mapping remain subject to inspection of the game project's current auth implementation.

### 3. Documentation-first delivery

Architecture, roadmap, security baseline, and workflow are established before application scaffolding.

### 4. Local-first development

The first implementation should be runnable and testable locally without paid managed infrastructure. Production provider selection is deferred.

### 5. Server-authoritative security

The backend owns authorization decisions. Client-supplied identity, optimistic UI state, and realtime subscriptions are never treated as authorization evidence.

### 6. MVP order

Direct messaging and identity/authorization foundations precede friends, groups, media, and external notifications.

## Deferred decisions

- Frontend and backend framework
- Database engine/provider and migration tooling
- Realtime transport
- Hosting/deployment platform
- Exact identity token issuer, audience, claims, and verification mechanism
- Message edit/delete and retention policy
- Moderation/reporting workflow
- Media storage, scanning, and retention

## Consequences

This approach reduces premature vendor and framework lock-in. It also means implementation cannot begin until the auth contract and local stack are inspected and selected. The documents are planning artifacts, not working software.
