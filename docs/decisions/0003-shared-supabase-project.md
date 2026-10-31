# ADR 0003: Shared Supabase Project for Vendrith

- Status: Accepted
- Date: 2026-10-31
- Decision owners: Vendrith project owner

## Context

World of Vendrith and Vendrith Chat are being developed in separate repositories to keep implementation work focused and reduce coordination complexity. The long-term product direction is to integrate both applications into one larger Vendrith website.

Creating independent production identity systems would add unnecessary account duplication and make the eventual integration harder.

## Decision

World of Vendrith and Vendrith Chat will use the same canonical Supabase project for production authentication and, subject to schema and security review, the same project database.

- Supabase Auth is the single source of truth for player accounts.
- The verified Supabase Auth `user.id` is the canonical player identity across both applications.
- Vendrith Chat owns chat-domain tables; World of Vendrith owns world/game-domain tables.
- Table ownership is logical and enforced through explicit grants, Row Level Security (RLS), server-side authorization, and narrowly scoped access policies.
- Chat APIs must verify the user's access token server-side against the explicitly configured canonical project. They must not trust client-supplied user IDs.
- Chat features must not directly mutate world/game data unless a separately reviewed, authorized integration contract explicitly permits the operation.
- Separate repositories remain a development and delivery boundary, not separate player-account systems.
- Local development and automated tests must use an isolated non-production Supabase project or local Supabase environment. They must never silently fall back to production.
- The eventual unified website may compose both applications behind one domain and shared navigation. Cross-origin browser sessions are not assumed to be shared automatically; any seamless session handoff requires a separately reviewed secure design.

## Consequences

### Benefits

- One player account and stable identity across the Vendrith ecosystem.
- Less friction when the two repositories are integrated into one website.
- Chat and game code can be developed independently while sharing a canonical identity authority.
- No separate production identity provider is required solely for Chat.

### Risks and controls

- A shared project increases the impact of misconfigured access policies. Every Chat table must have explicit RLS policies and cross-user isolation tests before production use.
- Shared infrastructure does not imply shared authorization. Each application and API must enforce its own domain permissions.
- Production schema changes require review and explicit approval; this ADR does not authorize database migrations or production writes.
- Project sharing does not guarantee a shared browser session across origins.
- Costs, quotas, and plan limits must be monitored; this decision does not authorize a paid plan upgrade.

## Scope and non-goals

This decision records the target architecture. It does not implement authentication, create tables, change RLS, configure providers, change secrets, run migrations, or modify the World of Vendrith repository or production Supabase project.

## Required verification before implementation

1. Confirm the exact canonical production project configuration from an authorized source without exposing secrets.
2. Establish isolated local/non-production configuration for Chat.
3. Design Chat table ownership, schema, indexes, retention, and RLS policies.
4. Test valid, invalid, expired, anonymous, and cross-user access cases.
5. Verify that Chat cannot mutate game/world records through its normal API surface.
6. Review deployment domains, callback URLs, CORS, cookies, and any required session handoff.
7. Obtain explicit approval before any production database or Auth configuration change.
