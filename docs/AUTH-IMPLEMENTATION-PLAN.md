# Authentication Implementation Plan

- Status: Non-production Auth foundation implemented in code; live test-account verification and server-backed chat persistence remain open.
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

1. [x] Pin exact versions of `@supabase/ssr` and `@supabase/supabase-js`; npm generated and updated the lockfile.
2. [x] Implement request-scoped browser and server Supabase clients using cookie-based SSR.
3. [x] Use `middleware.ts` for this Next.js 15.x application; the current Next.js 16 `proxy.ts` convention is not used.
4. [x] Verify sessions with `auth.getClaims()` in middleware and protected server rendering.
5. [x] Add email/password sign-in, test-account registration, PKCE callback exchange, and sign-out.
6. [x] Hard-restrict configured Auth to project ref `npvlokuszipgwrdipeoi`; partial, malformed, or other-project configuration fails closed.
7. [ ] Add automated live-session tests for valid, invalid/expired, anonymous, and identity-spoofed requests.
8. [ ] Verify the flow against the non-production project using dedicated test-only accounts.
9. [ ] Add chat-domain tables and membership-scoped persistence only after schema/RLS review. No production sign-in, Auth settings, SQL, RLS, migrations, or data writes are part of this milestone.

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
- Exact `@supabase/ssr` and `@supabase/supabase-js` packages are now pinned and committed with `package-lock.json`. Auth source code is restricted to the non-production project ref. No credentials are committed.
- The `.env.example` file contains blank variable names only. Keep all keys out of Git; use only the non-production project in local or Preview configuration. The application validates the Supabase hostname against `npvlokuszipgwrdipeoi` and returns HTTP 503 if another project is configured.

## Implementation evidence — 2026-11-01

- Installed exact `@supabase/ssr` and `@supabase/supabase-js` versions with `npm install --save-exact`; `package-lock.json` updated.
- Added browser/server Supabase clients, Next.js 15 `middleware.ts`, server-side `getClaims()` verification, email/password sign-in and test-account signup, PKCE callback exchange, and sign-out.
- The auth boundary is hard-coded to the non-production project ref `npvlokuszipgwrdipeoi`. It accepts only `sb_publishable_` keys. It cannot be configured to the production project through environment variables.
- Playwright with the real non-production URL and publishable key confirmed unauthenticated `/` redirects to `/login` and shows the non-production test environment label.
- A separate HTTP smoke check with the canonical production hostname intentionally configured returned `503` and `This deployment is not allowed to connect to that Supabase project.` No request was sent to the production project.
- Local verification: TypeScript passed; 19 unit tests passed; 3 existing Playwright chat tests passed; dependency audit found 0 vulnerabilities; production build completed.
- Live password sign-in/signup, session refresh, and logout are not yet verified because no dedicated test account has been used. The Auth foundation is code-complete but not runtime-accepted yet.
- The `chat_messaging_core_v1` migration is applied to non-production only. A protected `/test-chat` console exercises the authenticated RPCs; it still needs two real non-production test accounts before end-to-end acceptance.

## Framework-specific implementation note

The app currently declares Next.js `^15.5.0`. Supabase's current Next.js SSR guide explicitly states that Next.js 15 and earlier use `middleware.ts`; `proxy.ts` is the renamed convention for Next.js 16. The implementation must follow the installed major version rather than copy the newest filename blindly. Use the current Supabase SSR cookie pattern and `auth.getClaims()` for server-side identity verification. References: [Supabase Next.js SSR client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework&router=app) and [@supabase/ssr changelog](https://github.com/supabase/ssr/blob/main/CHANGELOG.md).
