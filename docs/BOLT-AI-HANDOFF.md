# Vendrith Chat — Bolt.new Implementation Handoff

**Prepared:** 2026-10-31  
**Repository:** `rakarakaa775/Vendrith-chat-`  
**Target branch:** `main`  
**Purpose:** Give Bolt a bounded, evidence-based implementation brief for completing the web MVP without crossing the World of Vendrith security boundary.

## 1. Current verified baseline

- Next.js App Router + TypeScript + React application skeleton exists.
- A responsive, static chat preview exists in `app/page.tsx`.
- The preview uses illustrative hard-coded conversations and messages. It does not send, persist, or retrieve messages.
- GitHub Actions run [41213379376](https://github.com/rakarakaa775/Vendrith-chat-/actions/runs/41213379376) passed dependency installation, TypeScript typecheck, all five Node.js unit tests, and Next.js production build on commit `98bf460514538a18334a98b6528d7ff0055cba3b` (2026-10-31). This is the latest verified green run at handoff update time.
- Authentication is not implemented in this repository yet.
- No chat database schema, RLS policies, realtime subscriptions, or message APIs are implemented.
- Desktop Commander was offline during the preparation of this handoff. Bolt should independently inspect the repo and run all checks after its changes.

Do not describe the preview as a functioning messenger until end-to-end acceptance tests pass.

## 2. Product objective

Build a responsive web chat for World of Vendrith players. The first deliverable is a secure, usable application shell with authentication and a direct-message foundation. Keep it visually consistent with the current Vendrith fantasy direction, but prioritize clarity, accessibility, and maintainable code over decorative complexity.

### MVP scope

1. Login and account registration screens.
2. Authenticated application shell and logout.
3. Conversation list with loading, empty, error, and selected states.
4. Direct conversation view with message history.
5. Message composer with validation and sending state.
6. Secure server-side authorization and database access.
7. Responsive desktop and mobile layouts.
8. Tests and CI checks.

Friends, groups, media uploads, push notifications, voice/video, AI chat, and game-world actions are not part of this first implementation unless separately approved.

## 3. Non-negotiable architecture

- Framework: Next.js App Router, TypeScript, React.
- Styling: use the existing CSS direction or minimal Tailwind; avoid adding a large UI framework.
- Identity authority: Supabase Auth. Stable principal is the verified Auth UUID `user.id` / JWT `sub`.
- Use `@supabase/ssr` for cookie-based server/browser integration and the currently supported Next.js request proxy/session-refresh pattern. Check current package documentation and installed Next.js version before coding.
- Server components, route handlers, and server actions must verify the authenticated principal using trusted server-side claims/session validation. Never authorize from a browser-provided `user_id`, username, email, editable metadata, or unverified `getSession()` result.
- Every conversation read/write must prove membership on the server/database side.
- Chat owns only chat-domain data. It must not mutate World, Region, Playable, map, character, inventory, progression, or other game-engine data.
- No Firebase, Firestore, Firebase Auth, Cloud Messaging, or Firebase Storage.
- Do not introduce a second player identity table that can become a competing identity authority. A chat profile may reference the Auth UUID as its primary identity.
- Do not add secret/service-role keys to browser code or any `NEXT_PUBLIC_*` variable.
- Do not put access tokens in URLs, logs, analytics, or message content.
- Fail closed when environment configuration is missing. Never silently fall back to production.

## 4. Environment safety

Two Supabase projects are known:

| Purpose | Project ref | Rule |
| --- | --- | --- |
| Canonical World of Vendrith production Auth | `ojtmfokjcirvjvhnbnos` | Do not use for development, tests, schema changes, or experimental writes |
| Vendrith Non-Production E2E | `npvlokuszipgwrdipeoi` | Use only with isolated test accounts and explicit non-production configuration |

Start with local mock mode if no authorized non-production credentials are supplied. The app must remain runnable without credentials and clearly label mock mode. When configuring Supabase, require explicit local environment values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never commit `.env.local`, credentials, tokens, or service-role keys. Do not copy secrets from other projects or repositories. Do not connect to production simply to make login appear to work.

**Production integration is not authorized by this handoff.** Sharing a Supabase project is an architectural direction, not permission to make production changes. No production Auth settings, redirect allow-list changes, SQL, migrations, RLS changes, storage buckets, or data writes.

## 5. Required implementation sequence

### Step A — Inspect before editing

- Inspect all files, scripts, package versions, CI workflow, and current Git status.
- Preserve existing user changes and current `main` branch; do not create or switch branches.
- Keep the existing design preview working as a fallback.
- Identify the exact Next.js version and select compatible Supabase package versions.
- Do not blindly upgrade Next.js or rewrite the project structure.

### Step B — Dependencies and reproducibility

- Add only the required Supabase SSR/client packages and test tooling.
- Generate the package lockfile using the package manager actually selected.
- Commit the lockfile.
- Use reproducible CI installation (`npm ci` when using npm and a committed package-lock).
- Do not invent package versions or fabricate a lockfile.

### Step C — Authentication

Implement:
- Sign-in with email/password.
- Sign-up with email/password.
- Callback route compatible with Supabase PKCE flow.
- Sign-out.
- Server-side protected route/layout.
- Clear loading, invalid credentials, expired session, unconfigured environment, and registration confirmation states.
- No Google/OAuth provider until its project configuration and redirect URLs have been independently verified.

Use a server-side authorization check based on the trusted Supabase project and verified claims. Keep redirects constrained to local application paths to avoid open redirects. Ensure cookie/session refresh follows current Supabase SSR guidance.

### Step D — Chat domain and database

Before writing migrations, provide a schema proposal and RLS policy review in the PR or a design note. Do not apply SQL to either remote project without explicit approval.

Suggested minimal relational model (adapt only with a documented reason):

- `chat_profiles`: `user_id` references `auth.users(id)`; display name/avatar are non-authoritative profile data.
- `conversations`: UUID, type (initially direct only), created_at, updated_at.
- `conversation_members`: conversation_id, user_id, joined_at, last_read_at; unique conversation/user pair.
- `messages`: UUID, conversation_id, sender_id, body, created_at, edited_at, deleted_at, client_message_id.
- Add indexes for membership lookup and chronological message pagination.
- Enforce membership for all conversation/message reads and writes.
- Sender must equal the verified authenticated user.
- Prevent a client from adding arbitrary members or changing ownership via direct table writes.
- Use transaction-safe creation/retrieval of a direct conversation so two concurrent requests cannot create duplicate direct threads.
- Use idempotency key/client_message_id to prevent duplicate sends on retries.
- Validate body length and reject empty/whitespace-only messages.
- Prefer soft-delete or an explicit deletion policy; document the choice.
- Do not expose private storage/media in this phase.

If implementing SQL files, keep them as reviewable migration files only. Do not apply them to a remote Supabase project.

### Step E — API and UI behavior

- Conversation list must be scoped to the authenticated user.
- Message history must be paginated in stable chronological order.
- Composer must have sending, success, retry/error, and disabled states.
- Prevent duplicate submission while a send is pending; use idempotency for retry safety.
- Realtime is optional for this first pass. If added, authorize subscriptions by membership and retain history fetch/recovery; never treat realtime as the source of truth.
- Provide empty states for no conversations and no messages.
- Provide skeleton/loading and recoverable error states.
- Mobile: conversation list and conversation detail should have a clear navigation/back behavior.
- All controls must work or be visibly disabled with an explanation. No decorative dead buttons.
- Preserve accessible labels, keyboard navigation, focus visibility, and sufficient contrast.

## 6. Required tests

At minimum add automated tests for:

### Authentication and authorization
- Missing environment configuration fails closed or displays explicit mock mode.
- Unauthenticated user cannot access protected chat data.
- Valid test user can access only their own conversations.
- Invalid/expired session is rejected.
- A forged `user_id` in request body/query cannot impersonate another user.
- User A cannot read User B's conversation or messages.
- Non-member cannot read, send, or subscribe to a conversation.
- Sender identity is derived from verified auth, not request input.

### Messaging correctness
- Empty message rejected.
- Message length limit enforced.
- Duplicate client_message_id does not create duplicate messages.
- Pagination has no duplicate/omitted records at page boundaries.
- Concurrent direct-conversation creation does not create duplicate threads.
- Failed send shows recoverable error and does not falsely mark message as sent.

### UI and build
- Login/signup form validation and error states.
- Empty/loading/error states.
- Responsive navigation behavior.
- `npm ci`, lint, typecheck, tests, and production build all pass.

Use isolated test identities only. Never create test accounts in production.

## 7. Definition of done

Bolt should not mark the task complete until all are true:

- [ ] Existing project structure and design preview preserved or intentionally improved.
- [ ] Auth flow works end-to-end against the isolated non-production project, or app remains explicitly in mock mode if credentials are unavailable.
- [ ] Protected server routes reject unauthenticated requests.
- [ ] Conversation and message access is membership-scoped.
- [ ] RLS policies and migration files are reviewed, but no remote database migration is applied without approval.
- [ ] Direct-message send/read flow works with two isolated test identities if the non-production schema has been separately approved and provisioned.
- [ ] Automated security and messaging tests pass.
- [ ] Responsive behavior is checked at mobile and desktop widths.
- [ ] Lockfile is committed and clean install is reproducible.
- [ ] CI is green on the final commit.
- [ ] Final report lists changed files, commands run, test results, screenshots/preview URL if available, unresolved blockers, and any manual steps.

If non-production credentials or approved schema are unavailable, stop at the fully tested mock/auth UI boundary and report exactly what remains blocked. Do not bypass the boundary.

## 8. Explicitly prohibited

- No production database writes or migrations.
- No production Auth configuration or redirect changes.
- No service-role key in client bundles.
- No Firebase.
- No trusting client-supplied identity.
- No cross-origin SSO claims based solely on using the same Supabase project. Separate origins do not automatically share browser cookies.
- No WOV repository edits.
- No game-world mutation features.
- No paid services or plan upgrades.
- No claiming local/browser/E2E verification unless actually run and evidence is supplied.

## 9. Final report format requested from Bolt

1. Summary of what was implemented.
2. Exact commit/branch and changed file list.
3. Architecture and security decisions.
4. Environment variables required (names only; never reveal values).
5. Database migrations created (do not claim applied unless explicitly authorized).
6. Commands run and pass/fail output.
7. Automated test coverage and results.
8. Responsive/browser verification and preview URL.
9. Remaining blockers and manual setup steps.
10. Explicit confirmation that production and World of Vendrith game data were not modified.

## 10. Reference documents

- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Authentication implementation plan](AUTH-IMPLEMENTATION-PLAN.md)
- [WOV authentication contract recheck](audits/WOV-AUTH-CONTRACT-RECHECK-2026-10-31.md)
- [ADR 0003 — shared Supabase project](decisions/0003-shared-supabase-project.md)
- [ADR 0004 — web stack and reference scope](decisions/0004-web-stack-and-reference-scope.md)
