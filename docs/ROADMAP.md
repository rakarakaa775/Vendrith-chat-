# Vendrith Chat — Roadmap

**Status:** Foundation and preview skeleton committed; WOV Auth contract source audit complete; Bolt implementation handoff prepared  
**Date:** 2026-10-31

The roadmap is dependency-driven. A phase is complete only when its acceptance criteria are verified and evidence is recorded.

## Phase 0 — Foundation and architecture

**Status: Decisions recorded; environment confirmation pending**

- [x] Establish project purpose and repository boundary.
- [x] Define initial architecture and identity principles.
- [x] Define security baseline.
- [x] Define six-role workflow and evidence rules.
- [x] Confirm shared canonical Supabase project direction; production changes remain gated.
- [x] Select responsive Next.js web stack and document selective use of the Flutter reference.
- [x] Define initial MVP scope: responsive shell, conversation list, direct conversation view, and preview-only mock data.
- [ ] Confirm isolated local/non-production development configuration.

**Exit criteria:** approved scope, stack decision, local development plan, and integration contract draft. Architecture decisions: [ADR 0003](decisions/0003-shared-supabase-project.md) and [ADR 0004](decisions/0004-web-stack-and-reference-scope.md).

## Phase 1 — Repository and application skeleton

**Status: Partially verified — skeleton committed; CI green; local verification pending**

- [x] Inspect repository state before scaffolding.
- [x] Add minimal Next.js App Router + TypeScript application skeleton.
- [x] Add responsive app shell, conversation list, and direct conversation view using clearly marked mock data.
- [x] Add environment variable example with placeholders only; no production values.
- [x] Add GitHub Actions checks for dependency installation, TypeScript type checking, and production build.
- [ ] Add and verify formatting/linting and automated test commands.
- [ ] Generate and commit a reviewed npm lockfile from an authorized development environment.
- [ ] Verify local install and startup.
- [ ] Verify baseline automated tests and responsive behavior.

**Current evidence:** GitHub Actions run [41210449910](https://github.com/rakarakaa775/Vendrith-chat-/actions/runs/41210449910) completed successfully on commit `69f521ff198fecc0f7ff1c64d2e2a6df27cd8f70`. The workflow ran `npm install`, `npm run typecheck`, and `npm run build`. This does not replace local device/browser verification. Desktop Commander was offline during the latest environment check, so no local install, lockfile generation, or browser test is claimed.

**Exit criteria:** reproducible clean install with committed lockfile, local startup, static checks, baseline tests, and responsive UI verification pass. Mock UI must not imply real message delivery or persistence.

## Phase 2 — Identity and authorization foundation

**Status: Planned; implementation plan documented**

- [x] Record the canonical identity rule: verified Supabase Auth `user.id` / JWT `sub`, never a client-supplied ID, username, or email.
- [x] Record production and non-production project boundaries and the no-production-write rule.
- [x] Recheck the World of Vendrith authentication source contract (read-only); runtime/non-production identity verification remains pending.
- [ ] Confirm trusted issuer/project configuration through an isolated non-production runtime test.
- [ ] Implement request-scoped server/browser clients and secure session handling.
- [ ] Implement login, signup, callback, and logout.
- [ ] Protect the chat shell server-side and map identity from verified claims.
- [ ] Add authorization tests for unauthenticated, invalid/expired token, and cross-user access.
- [ ] Verify the flow with test-only identities in the non-production project.

Implementation plan: [AUTH-IMPLEMENTATION-PLAN.md](AUTH-IMPLEMENTATION-PLAN.md). Source audit: [WOV Auth contract recheck](audits/WOV-AUTH-CONTRACT-RECHECK-2026-10-31.md). Implementation brief for Bolt: [BOLT-AI-HANDOFF.md](BOLT-AI-HANDOFF.md).

**Exit criteria:** verified identity can access only its own authorized chat resources; negative tests pass. No production sign-in, Auth settings, SQL, RLS, migrations, or data writes are included without separate approval.

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
