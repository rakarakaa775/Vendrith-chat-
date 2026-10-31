# ADR 0002: Canonical World of Vendrith player identity

- **Status:** Proposed
- **Date:** 2026-10-31
- **Evidence:** Read-only audit of `World-of-vendrith` branch `feat/vendrith-ecc-v1`, HEAD `8380b90aa1c84b6e68b8f4d2f4f0868dface2e03`.

## Context

World of Vendrith currently uses Supabase Auth. Its browser auth helper resolves the authenticated user through `auth.getUser()`, and its authenticated AI API verifies Bearer tokens server-side with `auth.getUser(token)`, rejects anonymous users, and scopes Supabase data access with the verified access token.

Vendrith Chat must identify the same players without creating duplicate player accounts.

## Decision proposed

1. World of Vendrith's canonical Supabase Auth user remains the source of truth for player identity.
2. Chat's stable principal is the verified Supabase Auth `user.id` (UUID / JWT subject), never username or email.
3. Every protected Chat API request is verified server-side against the explicitly configured trusted auth project.
4. Chat owns only chat-domain records and does not mutate game/player domain records.
5. Browser sessions on different origins are not assumed to be shared. MVP may authenticate independently against the same identity authority; seamless handoff requires a separately reviewed, single-use authorization flow.
6. Local and E2E environments must use isolated credentials and non-production identities.

## Consequences

This avoids a duplicate player/password system and aligns Chat authorization with the existing game's identity. It does not by itself provide seamless SSO, and it does not choose the Chat database or realtime provider.

## Deferred

- Same-project chat tables versus separate Chat database
- Login UX versus seamless cross-origin handoff
- Production domain and redirect allow-list
- Real-token verification and negative authorization test evidence
