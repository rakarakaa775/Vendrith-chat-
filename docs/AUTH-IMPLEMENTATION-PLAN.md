# Authentication Implementation Plan

- Status: Planned; implementation remains gated on an explicitly approved non-production integration task and completion of the identity/session contract review.
- Date: 2026-10-31

## Objective

Allow Vendrith Chat to use the same canonical Supabase Auth player identity as World of Vendrith. The stable identity is the verified Auth `user.id` (JWT `sub`), never a client-supplied ID, username, or email.

## Environment boundary

Known Supabase projects:

| Purpose | Project ref | Use |
| --- | --- | --- |
| Canonical World of Vendrith | `ojtmfokjcirvjvhnbnos` | Production identity authority; do not use for development writes or experiments |
| Vendrith Non-Production E2E | `npvlokuszipgwrdipeoi` | Isolated integration and test environment |

The non-production project is a test identity environment, not a source of production player accounts. It must not be confused with or silently substituted for the canonical production project.

Local development must fail closed unless an explicit local/non-production URL and publishable key are configured. Never add real credentials to Git. Never add a service-role or secret key to browser-exposed variables.

Suggested local-only environment names:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Values are intentionally blank. Use the non-production project only for isolated test accounts until a separate approval authorizes production identity integration.

## Planned implementation

1. Pin reviewed exact versions of `@supabase/ssr` and `@supabase/supabase-js`, generate the npm lockfile in an authorized Node environment, and commit both together. Do not guess or hand-author lockfile contents.
3. Implement request-scoped browser and server Supabase clients using cookie-based SSR.
4. This repository currently uses Next.js 15.x. Use `middleware.ts` with `export async function middleware` for session refresh; Supabase's current guide uses `proxy.ts` only for Next.js 16 and later. Revisit this filename only as part of an explicit Next.js major upgrade.
5. In middleware and protected server entry points, validate with `auth.getClaims()`; use `getUser()` when a fresh Auth user record is specifically needed. Never authorize from the user object returned by `getSession()` alone.
6. Add login, signup, callback, and logout routes with PKCE-compatible callback handling.
7. Protect the chat shell server-side. Resolve the principal from verified claims; do not trust `getSession()` alone in server code or client-supplied identity fields.
8. Add a clear unconfigured state when environment variables are absent; do not silently fall back to production.
9. Add automated tests for missing configuration, unauthenticated requests, valid session, invalid/expired token, and identity spoofing.
10. Verify the flow against the non-production project using test-only accounts. No production sign-in, Auth settings, SQL, RLS, migrations, or data writes are part of this milestone.

## Security notes

- A browser publishable key is expected to be public; it is not an authorization credential.
- Never expose Supabase secret/service-role keys through `NEXT_PUBLIC_*`.
- Server-side page/API authorization must verify the signed claims with the trusted project configuration.
- Username and email are profile/display attributes, not authorization identifiers.
- Do not use editable user metadata as an authorization claim.
- Cross-origin session sharing is not assumed. A future unified-domain session handoff needs a separate reviewed design.

## Current implementation gate

- GitHub Actions run `41213379376` passed dependency installation, TypeScript, all five unit tests, and the production build on commit `98bf460514538a18334a98b6528d7ff0055cba3b` (2026-10-31). The preceding code baseline run `41213215264` also passed.
- `package-lock.json` is now committed and CI uses `npm ci`, so dependency resolution is reproducible for the current dependency set.
- No Supabase packages or authentication source imports have been added. Before introducing them, select exact compatible versions, generate the lockfile with npm, and verify the non-production-only environment boundary.
- The `.env.example` file intentionally contains no credentials. Keep both production and non-production values out of Git.

## Framework-specific implementation note

The app currently declares Next.js `^15.5.0`. Supabase's current Next.js SSR guide explicitly states that Next.js 15 and earlier use `middleware.ts`; `proxy.ts` is the renamed convention for Next.js 16. The implementation must follow the installed major version rather than copy the newest filename blindly. Use the current Supabase SSR cookie pattern and `auth.getClaims()` for server-side identity verification. References: [Supabase Next.js SSR client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework&router=app) and [@supabase/ssr changelog](https://github.com/supabase/ssr/blob/main/CHANGELOG.md).
