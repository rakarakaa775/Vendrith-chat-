# Vendrith Chat

Vendrith Chat is the standalone communication service for the World of Vendrith ecosystem. It is developed in its own repository so chat features can evolve independently before later integration into the larger Vendrith website.

## Current status

**Stage:** Implementation-first roadmap. Email/password authentication, server-backed messaging, realtime inbox updates, unread/read state, per-user archive, reactions/replies, social graph, profile/privacy controls, group lifecycle/moderation, and in-app notifications are implemented in the isolated Non-Production environment. All test execution and QA are intentionally deferred until the roadmap implementation phases are complete.
**Repository:** `rakarakaa775/Vendrith-chat-`
**Default branch:** `main`
**Primary application language:** English

The app provides a local preview when backend configuration is absent and an authenticated server-backed chat experience when configured for Vendrith Non-Production E2E. The main chat includes direct and group conversations, cursor-based history, unread counters, per-user archive, reactions, replies, and live conversation previews. Community includes player discovery, friend requests, blocks, presence privacy, profile management, group metadata, ownership transfer, closure, member roles, and moderation history. A private notification inbox provides per-category preferences and realtime updates. These implementation statements do not mean the deferred final QA/release gates have passed.

## Product direction

The MVP targets:
- Email/password sign-in and registration using the canonical Supabase Auth identity.
- Protected responsive chat shell with direct and group conversations.
- Secure membership-scoped message history and sending.
- Player discovery, friendships, blocks, presence privacy, and group role management.
- Private media/file attachments remain planned; in-app notifications and preferences are implemented for message, friend-request, group-addition, and moderation-report events.
- Final automated authorization, messaging, and release tests after all implementation work is complete.

Voice/video, AI chat, public global channels, and game-world mutation remain out of scope unless separately approved.

## Architecture and safety

- Next.js App Router, TypeScript, React, local preview adapter, and authenticated Supabase-backed chat/social RPCs.
- npm lockfile with reproducible `npm ci`; CI checks dependency audit, typecheck, unit tests, Playwright browser tests, and production build.
- Supabase Auth is the identity authority; verified `user.id` / JWT `sub` is the stable player identity.
- Chat owns chat-domain data only. It must not mutate World of Vendrith game data.
- Production integration, Auth configuration changes, SQL/RLS/migrations, and production data writes require separate explicit approval.
- Use isolated non-production test identities. Never silently fall back to production.
- No Firebase and no service-role key in browser code.

## Development workflow

Work proceeds through six sequential roles: Roadmap, Auditor, Implementer, QA Tester, Integrator, and Verifikator. See [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Key documents

- [Architecture](docs/ARCHITECTURE.md)
- [Chat persistence contract and non-production schema record](docs/decisions/0005-chat-persistence-contract.md)
- [Supabase local configuration and migrations](supabase/)
- [Roadmap](docs/ROADMAP.md)
- [Security model](docs/SECURITY.md)
- [Workflow and evidence rules](docs/WORKFLOW.md)
- [Authentication implementation plan](docs/AUTH-IMPLEMENTATION-PLAN.md)
- [Identity integration contract](docs/IDENTITY-INTEGRATION.md)
- [WOV authentication contract recheck](docs/audits/WOV-AUTH-CONTRACT-RECHECK-2026-10-31.md)
- [Bolt AI implementation handoff](docs/BOLT-AI-HANDOFF.md)
- [Architecture decisions](docs/decisions/)
- [Foundation verification — 2026-11-01](docs/audits/FOUNDATION-VERIFICATION-2026-11-01.md)
- [Chat Engine Phase 2 checkpoint — 2026-11-01](docs/audits/CHAT-ENGINE-PHASE-2-2026-11-01.md)

## Local development

```bash
npm ci
npm run dev
```

Run automated checks:

```bash
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Status vocabulary

- **Planned:** described but not implemented.
- **In progress:** implementation has started.
- **Verified:** acceptance criteria passed with recorded evidence.
- **Blocked:** progress depends on an unresolved external decision or prerequisite.

A design document or green CI run is not evidence that remote message delivery or end-to-end player communication works.
