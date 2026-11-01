# Vendrith Chat

Vendrith Chat is the standalone communication service for the World of Vendrith ecosystem. It is developed in its own repository so chat features can evolve independently before later integration into the larger Vendrith website.

## Current status

**Stage:** Phase 2 — Chat Engine. The local-only chat vertical slice is implemented and covered by unit and Playwright browser tests. The app does not yet authenticate players or deliver/synchronize messages through a server.
**Repository:** `rakarakaa775/Vendrith-chat-`
**Default branch:** `main`
**Primary application language:** English

The local preview supports composing messages, saving them in the current browser's local storage, switching conversations, and recovering from transient local-storage write failures. An email/password Auth foundation and a separate non-production backend test console are now available for the isolated Vendrith Non-Production E2E project only. The console exercises server-backed direct-conversation creation and message RPCs. The main chat interface is still local-preview mode until authenticated two-player tests pass and the remote adapter is integrated.

## Product direction

The first MVP targets:
- Email/password sign-in and registration using the canonical Supabase Auth identity.
- Protected responsive chat shell.
- Conversation list and direct-message view.
- Secure membership-scoped message history and sending.
- Automated authorization and messaging tests.

Friends, groups, media, push notifications, calls, AI chat, and game-world actions are later or separately approved scope.

## Architecture and safety

- Next.js App Router, TypeScript, React, and a local-only chat domain adapter for the current vertical slice.
- npm lockfile with reproducible `npm ci`; CI checks dependency audit, typecheck, unit tests, Playwright browser tests, and production build.
- Supabase Auth is the intended identity authority; verified `user.id` / JWT `sub` is the stable player identity.
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
