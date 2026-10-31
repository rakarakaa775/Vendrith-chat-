# Authentication Implementation Plan

- Status: Ready for implementation; dependency installation is blocked until an authorized development terminal is online.
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

1. Pin `@supabase/ssr` and `@supabase/supabase-js` to reviewed exact versions and commit the generated npm lockfile.
2. Implement request-scoped browser and server Supabase clients using cookie-based SSR.
3. Implement the current Next.js request proxy/session refresh using the supported `auth.getClaims()` validation path.
4. Add login, signup, callback, and logout routes with PKCE-compatible callback handling.
5. Protect the chat shell server-side. Resolve the principal from verified claims; do not trust `getSession()` alone in server code or client-supplied identity fields.
6. Add a clear unconfigured state when environment variables are absent; do not silently fall back to production.
7. Add automated tests for missing configuration, unauthenticated requests, valid session, invalid/expired token, and identity spoofing.
8. Verify the flow against the non-production project using test-only accounts. No production sign-in, Auth settings, SQL, RLS, migrations, or data writes are part of this milestone.

## Security notes

- A browser publishable key is expected to be public; it is not an authorization credential.
- Never expose Supabase secret/service-role keys through `NEXT_PUBLIC_*`.
- Server-side page/API authorization must verify the signed claims with the trusted project configuration.
- Username and email are profile/display attributes, not authorization identifiers.
- Do not use editable user metadata as an authorization claim.
- Cross-origin session sharing is not assumed. A future unified-domain session handoff needs a separate reviewed design.

## Implementation blocker

The connected Desktop Commander device was offline at the time of this plan. GitHub source editing is available, but it cannot safely generate and verify an npm lockfile or run a local build. Do not add Supabase dependencies without a generated lockfile and executable verification. Resume implementation when a trusted development terminal is online.
