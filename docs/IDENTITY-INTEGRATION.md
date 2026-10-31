# Vendrith Chat — World of Vendrith Identity Integration Contract

**Status:** Draft based on read-only repository audit  
**Audit date:** 2026-10-31  
**Audited source branch:** `World-of-vendrith:feat/vendrith-ecc-v1`  
**Audited source HEAD:** `8380b90aa1c84b6e68b8f4d2f4f0868dface2e03`

This document records observed behavior and a proposed integration contract. It does not mean Vendrith Chat is already connected to World of Vendrith.

## 1. Audit evidence

The following source files were inspected on the branch and commit above:

- `apps/map-editor/editor/auth.ts`
- `apps/map-editor/editor/supabase-client.ts`
- `apps/map-editor/editor/auth-redirect.ts`
- `apps/map-editor/components/auth-panel.tsx`
- `apps/map-editor/app/reset-password/page.tsx`
- `apps/map-editor/app/api/vendrith-ai/route.ts`
- `apps/map-editor/e2e/authenticated-session.spec.ts`
- `.ai/company/evidence/WOV-AUTH-RESET-20261030-001-IMPLEMENTATION.md`

Observed facts:

1. World of Vendrith uses Supabase Auth through `@supabase/ssr` and `@supabase/supabase-js`.
2. The browser auth helper obtains the authenticated user with `client.auth.getUser()`.
3. The application identity exposed by the helper is `user.id`; the display name is read from `user.user_metadata.username`, with an email-derived fallback.
4. The existing `/api/vendrith-ai` route accepts a Bearer token, verifies it server-side with `auth.getUser(token)`, rejects invalid/expired and anonymous users, and uses the verified `user.id` for ownership.
5. The same route creates a user-scoped Supabase client with the verified access token so database authorization can apply the authenticated user's RLS context.
6. The browser client source contains a fallback reference to the canonical Supabase project `ojtmfokjcirvjvhnbnos`. Environment variables take precedence.
7. The E2E test explicitly targets a separate non-production Supabase project `npvlokuszipgwrdipeoi`. That is a test boundary, not the production identity authority.
8. The existing UI supports email/password login and password recovery. The inspected files do not establish a cross-domain single-sign-on flow.
9. The existing password recovery redirect is constrained to HTTPS and the canonical World of Vendrith application URL unless configured otherwise.

Evidence is source-code inspection only. No production credentials, live sessions, database rows, or Supabase production settings were read or changed during this audit.

## 2. Identity authority

**Proposed decision:** the existing World of Vendrith Supabase Auth project remains the canonical identity authority for player accounts.

Vendrith Chat must not create a second independent player account or password store.

For an authenticated request, the stable player principal is the verified Supabase Auth user UUID (`user.id`, equivalent to the JWT subject claim after verification).

Display names are profile attributes, not identity keys:

- Never authorize by username or email.
- Never accept a client-supplied `user_id` as proof of identity.
- Do not use email local-part as a stable display-name or identity fallback in the chat domain.
- Treat username/display metadata as untrusted, mutable presentation data and validate its length/content before display.

## 3. Proposed request authentication contract

Every protected Chat API request must:

1. Receive an access token over HTTPS in the `Authorization: Bearer <token>` header.
2. Verify the token server-side against the configured trusted Supabase Auth project.
3. Reject missing, malformed, expired, invalid, or anonymous credentials.
4. Derive the principal only from the verified auth response.
5. Apply conversation, membership, friendship, block, and resource authorization using that principal.
6. Never log access tokens, refresh tokens, passwords, or complete authorization headers.

Reference behavior is the existing World of Vendrith `authenticate(request)` implementation in `apps/map-editor/app/api/vendrith-ai/route.ts`.

A decoded JWT payload without cryptographic/provider verification is not sufficient. A user ID supplied in JSON, query parameters, headers other than the verified credential, or local browser state is not sufficient.

## 4. Browser session and cross-origin behavior

A shared Supabase project gives both applications the same user directory and stable user IDs. It does **not** automatically share browser storage or an authenticated session between different origins.

Therefore:

- Vendrith Chat may authenticate against the same trusted Supabase project using its own supported login flow; the resulting verified user ID will identify the same player.
- If seamless handoff from World of Vendrith is required, design a dedicated authorization-code or one-time handoff flow with server-side validation, short expiry, single-use semantics, state/PKCE protections, and an exact redirect allow-list.
- Never put access tokens or refresh tokens in URL query strings, fragments, deep links, analytics events, or logs.
- Do not assume that sharing a browser cookie across unrelated domains is possible or safe.
- Do not build a custom token-minting endpoint or accept unsigned identity assertions.

The seamless handoff flow is a separate design task and is not part of the first direct-message implementation.

## 5. Data ownership boundary

World of Vendrith remains the authority for player identity and game state.

Vendrith Chat owns only chat-domain data, such as:

- Chat profile preferences and display settings
- Conversations and conversation membership
- Messages and message receipts
- Friend requests/relationships and blocks
- Group roles and membership
- Attachment metadata and notification preferences

Chat records should reference the verified player UUID as an external principal. If Chat uses a separate database, do not pretend that a cross-database foreign key exists; enforce identity and authorization at the Chat service boundary.

Chat must not write to World of Vendrith player, character, inventory, progression, world, or map tables.

## 6. Database and RLS requirements

If Chat tables are hosted in the same Supabase project:

- Keep chat tables in a clearly scoped schema or use a consistent `chat_` naming convention.
- Enable RLS on every table exposed through client-accessible APIs.
- Scope reads and writes to `auth.uid()` and validated conversation membership.
- Ensure realtime subscriptions enforce the same membership boundary.
- Keep privileged server credentials server-only and use them only where explicitly justified.
- Add negative tests for cross-user and non-member access.

If Chat uses a separate database or service:

- Verify the canonical Supabase token at the Chat API boundary.
- Derive the principal from the verified token.
- Apply Chat-owned authorization inside that service.
- Do not trust a forwarded user ID without a verified token.

The production database/provider choice remains deferred until local development and cost constraints are reviewed.

## 7. Environment separation

Observed project references:

| Environment | Supabase project reference | Rule |
|---|---|---|
| Existing canonical World of Vendrith app | `ojtmfokjcirvjvhnbnos` | Identity authority candidate; production writes are not authorized by this audit |
| Existing E2E test configuration | `npvlokuszipgwrdipeoi` | Non-production test target only |

These references were read from repository source. Do not copy production credentials into Vendrith Chat or commit any key.

Vendrith Chat must use explicit environment variables and fail closed when required auth configuration is missing. Do not silently fall back from a test environment to production or vice versa.

Suggested variable names (names only; no values committed):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or the supported public/anon equivalent)
- Any server-only secret only if a later design proves it necessary; never expose it through a `NEXT_PUBLIC_` variable.

Local and automated tests must use a dedicated local or non-production project and dedicated test identities.

## 8. Required integration tests

Before calling the identity integration complete, prove:

1. Valid canonical-project user token is accepted.
2. Missing token returns 401.
3. Invalid token returns 401.
4. Expired token returns 401.
5. Anonymous user token is rejected.
6. Request payload cannot impersonate another `user.id`.
7. User A cannot read User B's direct conversation.
8. A non-member cannot read or subscribe to a group.
9. A removed member loses access according to the documented consistency policy.
10. Realtime events are delivered only to authorized members.
11. Username/email changes do not change the canonical principal.
12. Local/test configuration cannot silently target production.
13. No access or refresh token is written to logs or persisted as chat data.

## 9. Open decisions before implementation

- Confirm whether Chat tables should initially live in the existing Supabase project or a local-first separate database.
- Confirm whether MVP requires a separate Chat login screen or seamless handoff from World of Vendrith.
- Confirm whether a dedicated chat domain will exist.
- Inspect the deployed Supabase Auth URL configuration and allowed redirect URLs before implementing cross-origin handoff.
- Confirm the canonical production auth project reference through deployment configuration before any live integration test.

## 10. Audit limitations

This was a read-only source audit. It did not verify:

- Live JWT issuer/audience/claim configuration by obtaining or decoding a real production session.
- Supabase Auth provider settings or email templates.
- Live database RLS policies against a running production service.
- Cross-origin browser session behavior on deployed domains.
- A completed SSO or authorization-code flow.

Do not describe any of these as verified until separately tested in an approved non-production environment.
