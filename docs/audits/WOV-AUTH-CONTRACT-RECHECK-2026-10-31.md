# WOV Authentication Contract Recheck — 2026-10-31

**Status:** READ-ONLY SOURCE AUDIT COMPLETE; live identity verification remains pending  
**Target:** `rakarakaa775/World-of-vendrith`  
**Requested ref:** `feat/vendrith-ecc-v1`  
**Audit boundary:** GitHub source only. No WOV files, Supabase settings, credentials, database rows, sessions, or production resources were changed or accessed.

## 1. Files inspected

The following files were fetched from the requested WOV branch ref. Blob SHAs are recorded so the observations can be reproduced:

| File | Blob SHA |
|---|---|
| `apps/map-editor/editor/auth.ts` | `dae5294f02125295bdc4c13aee64c941c5e2082f` |
| `apps/map-editor/editor/supabase-client.ts` | `bfcfd6c3f202128bc5a2fae620c6cdc568bf1be7` |
| `apps/map-editor/editor/auth-redirect.ts` | `ca5bf75c50fdb9c152ed78d1b3d68c643903840d` |
| `apps/map-editor/components/auth-panel.tsx` | `6e679f70cf52ce3f0bed3e83a7ba9320657a82bf` |
| `apps/map-editor/app/api/vendrith-ai/route.ts` | `ca53ad7cf01f8d04a7983dbf2e43be02f076de0b` |
| `.ai/company/evidence/WOV-AUTH-RESET-20261030-001-IMPLEMENTATION.md` | `566e10287d64f154a17960d2863fc4f2365cb3fd` |

## 2. Confirmed identity contract

1. WOV's browser client uses `@supabase/ssr` `createBrowserClient` and resolves the current authenticated user through `auth.getUser()`.
2. WOV exposes `user.id` as the stable authenticated identifier. Username metadata and email-derived fallback are presentation only; Vendrith Chat must not use them as identity keys.
3. WOV's `/api/vendrith-ai` route extracts a Bearer token, verifies it with Supabase `auth.getUser(token)`, rejects missing/invalid/expired and anonymous users, and derives ownership from the verified `data.user.id`.
4. The route creates a user-scoped Supabase client with the same access token in the Authorization header, so database operations execute in the user's authorization context.
5. WOV's browser Supabase helper references canonical project ref `ojtmfokjcirvjvhnbnos`; environment variables take precedence. The key in browser code is a publishable/public key, not a service-role credential.
6. WOV password recovery uses an explicit HTTPS redirect to the canonical WOV app URL or configured `NEXT_PUBLIC_APP_URL`. This is a password-reset redirect, not an SSO or cross-origin session handoff.
7. The inspected WOV E2E evidence distinguishes the non-production project `npvlokuszipgwrdipeoi` from production. Non-production test accounts are not production player identities.

## 3. Integration consequences for Vendrith Chat

- Keep one canonical Auth authority: Supabase project `ojtmfokjcirvjvhnbnos` for production identity, subject to explicit production-integration approval.
- The stable Chat principal is the verified Supabase Auth UUID (`user.id` / verified JWT subject).
- Chat may have its own login UI and session at its own origin while authenticating against the same Auth project. This produces the same player UUID but is **not** seamless SSO.
- Do not assume cookies or browser storage are shared across different origins.
- Do not put access or refresh tokens in URLs, logs, analytics, or Chat records.
- For protected Chat server actions/API routes, verify the session/token server-side against the explicitly configured trusted project. Never accept a client-supplied `user_id` as proof of identity.
- If the app uses cookie-based SSR, validate server-side claims/session according to current Supabase SSR guidance; a client-side `getSession()` result alone is not server authorization.
- Chat owns only chat-domain data. It must not write WOV world, map, player progression, inventory, or character data.
- Keep local and CI environments fail-closed on missing configuration and explicitly pointed at local/non-production services. No implicit production fallback.

## 4. Separate WOV issue observed during source review

The current `signUpWithEmail()` implementation calls `auth.getUser()` and throws when there is no existing authenticated user before it calls `auth.signUp()`. However, the WOV AuthPanel invokes this function from its logged-out “Buat Akun” registration mode.

This appears inconsistent with a normal logged-out registration flow and should be independently reproduced/reviewed by the WOV team. It is **not** a reason for Chat to create a separate identity system, and this audit does not modify or attempt to fix WOV.

## 5. What is not verified

This source review does not prove:
- A real production JWT's issuer, audience, expiry, or claim contents.
- Successful authentication against production or non-production with a live account.
- Supabase Auth provider, URL allow-list, cookie, or email-template configuration.
- Cross-origin SSO or shared browser session behavior.
- Database RLS behavior or realtime membership isolation.
- The WOV registration anomaly in a running browser.

These require a separately approved non-production test with dedicated test identities. Production sign-in tests, Auth setting changes, SQL, migrations, RLS changes, and data writes remain outside this audit.

## 6. Verdict

**Identity architecture: SUFFICIENT TO PROCEED WITH CHAT AUTH IMPLEMENTATION DESIGN.**  
**Runtime integration: NOT YET VERIFIED.**

The implementation may proceed against the isolated non-production project only after local dependency installation and lockfile generation can be performed in an authorized development environment. Production identity integration remains gated by separate approval and real-token verification.
