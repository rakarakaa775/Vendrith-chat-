# Vendrith Chat — Roadmap

**Status:** Foundation decisions accepted; application skeleton next  
**Date:** 2026-10-31

The roadmap is dependency-driven. A phase is complete only when its acceptance criteria are verified and evidence is recorded.

## Phase 0 — Foundation and architecture

**Status: Decisions recorded**

- [x] Establish project purpose and repository boundary.
- [x] Define initial architecture and identity principles.
- [x] Define security baseline.
- [x] Define six-role workflow and evidence rules.
- [x] Confirm shared canonical Supabase project direction; production changes remain gated.
- [x] Select responsive Next.js web stack and document selective use of the Flutter reference.
- [x] Define initial MVP scope: responsive shell, conversation list, direct conversation view, empty/loading/error states.
- [ ] Confirm isolated local/non-production development configuration.

**Exit criteria:** approved scope, stack decision, local development plan, and integration contract draft. Architecture decisions: [ADR 0003](decisions/0003-shared-supabase-project.md) and [ADR 0004](decisions/0004-web-stack-and-reference-scope.md).

## Phase 1 — Repository and application skeleton

**Status: Next**

- Inspect current repository state before scaffolding.
- Add minimal Next.js App Router + TypeScript application skeleton.
- Add responsive app shell, conversation list, and direct conversation view using clearly marked mock data.
- Add formatting, linting, type checking, and test commands.
- Add environment variable example with placeholders only; no production values.
- Document how to run tests without production credentials.
- Verify install, local startup, static checks, and baseline tests.

**Exit criteria:** clean install, local startup, static checks, and baseline tests pass. Mock UI must not imply real message delivery or persistence.

## Phase 2 — Identity and authorization foundation

**Status: Planned**

- Inspect World of Vendrith authentication contract and token claims.
- Confirm the trusted issuer/project configuration in an approved non-production environment.
- Define server-side token verification and session handling.
- Implement canonical identity mapping without duplicate player accounts.
- Add authorization tests for unauthenticated and cross-user access.
- Keep integration in a development/test environment.

**Exit criteria:** verified identity can access only its own authorized chat resources; negative tests pass.

## Phase 3 — Direct messaging MVP

**Status: Planned**

- Create or retrieve direct conversations safely.
- Send, persist, paginate, edit/delete according to approved policy.
- Enforce membership and block rules.
- Add idempotent send behavior.
- Add realtime delivery with history recovery after authorization is verified.

**Exit criteria:** two test identities can exchange messages; unauthorized access and duplicate-send tests pass.

## Phase 4 — Friends and presence

**Status: Planned**

- Friend request, accept, reject, and remove flows.
- Block/unblock flows.
- Online/away/offline presence with expiry.
- Privacy controls for presence visibility.

**Exit criteria:** relationship transitions and privacy rules have automated tests.

## Phase 5 — Group conversations

**Status: Planned**

- Create groups and invite/remove members.
- Define owner/moderator/member permissions.
- Handle member departure and group lifecycle.
- Enforce membership changes on all reads and writes.

**Exit criteria:** role matrix and membership edge cases pass.

## Phase 6 — Media and notifications

**Status: Planned**

- Private attachment upload/download.
- MIME, size, and abuse controls.
- Attachment lifecycle and deletion policy.
- In-app notification events and preferences.
- External push delivery only after provider/cost review.

**Exit criteria:** private access, validation, and notification preference tests pass.

## Phase 7 — Hardening and release readiness

**Status: Planned**

- Security review and abuse/rate-limit tests.
- Load and realtime recovery tests.
- Backup/restore and retention validation.
- Accessibility and responsive UI checks.
- Observability, incident and rollback procedures.
- Production integration approval.

**Exit criteria:** release checklist signed off with reproducible evidence.

## Out of scope until separately approved

- Voice/video calls
- Public channels or global chat
- AI moderation or AI chat agents
- Game-world actions initiated directly from chat
- Cross-game federation
- Paid managed infrastructure
- Native Flutter application and platform-specific code

These may be revisited after the direct messaging MVP demonstrates product value.
