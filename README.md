# Vendrith Chat

Vendrith Chat is the standalone web communication service for the World of Vendrith ecosystem. It is developed in its own repository so chat features can evolve independently before later integration into the larger Vendrith website.

## Current status

**Stage:** Foundation and responsive preview committed; authentication and messaging are not yet implemented.  
**Repository:** `rakarakaa775/Vendrith-chat-`  
**Default branch:** `main`

The current application is a design preview with illustrative mock conversations. It does not yet authenticate users, send or persist messages, or connect to a chat database.

## Product direction

The first MVP targets:
- Email/password sign-in and registration using the canonical Supabase Auth identity.
- Protected responsive chat shell.
- Conversation list and direct-message view.
- Secure membership-scoped message history and sending.
- Automated authorization and messaging tests.

Friends, groups, media, push notifications, calls, AI chat, and game-world actions are later or separately approved scope.

## Architecture and safety

- Next.js App Router, TypeScript, React, minimal styling.
- Supabase Auth is the identity authority; verified `user.id` / JWT `sub` is the stable player identity.
- Chat owns chat-domain data only. It must not mutate World of Vendrith game data.
- Production integration, Auth configuration changes, SQL/RLS/migrations, and production data writes require separate explicit approval.
- Use isolated non-production test identities. Never silently fall back to production.
- No Firebase and no service-role key in browser code.

## Development workflow

Work proceeds through six sequential roles: Roadmap, Auditor, Implementer, QA Tester, Integrator, and Verifikator. See [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Key documents

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Security model](docs/SECURITY.md)
- [Workflow and evidence rules](docs/WORKFLOW.md)
- [Authentication implementation plan](docs/AUTH-IMPLEMENTATION-PLAN.md)
- [WOV authentication contract recheck](docs/audits/WOV-AUTH-CONTRACT-RECHECK-2026-10-31.md)
- [Bolt AI implementation handoff](docs/BOLT-AI-HANDOFF.md)
- [Architecture decisions](docs/decisions/)

## Status vocabulary

- **Planned:** described but not implemented.
- **In progress:** implementation has started.
- **Verified:** acceptance criteria passed with recorded evidence.
- **Blocked:** progress depends on an unresolved external decision or prerequisite.

A design document or green CI run is not evidence that an end-to-end product feature works.
