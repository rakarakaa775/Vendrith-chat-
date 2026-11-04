# Vendrith Chat — Deployment & Environment Separation

**Status:** Non-Production deployment guidance only  
**Approved backend target:** Vendrith Non-Production E2E — `npvlokuszipgwrdipeoi`

## Current environment guard

`lib/supabase/config.ts` enforces all of the following:
- URL must be HTTPS.
- Host must be exactly `npvlokuszipgwrdipeoi.supabase.co`.
- URL path must be `/`.
- Browser key must use the Supabase publishable-key prefix.
- Partial configuration throws an explicit error.
- Missing configuration selects local preview mode; it must never silently connect to another project.

Do not weaken or remove this guard as part of routine deployment work.

## Environment variables

Required for authenticated Non-Production deployments:

| Variable | Exposure | Value source |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public browser configuration | Non-Production project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser configuration | Active publishable key for Non-Production |
| `E2E_ACCOUNT_1_EMAIL` | CI secret only | Dedicated Non-Production test account |
| `E2E_ACCOUNT_1_PASSWORD` | CI secret only | Dedicated Non-Production test account |

The current CI workflow uses the first E2E account for authenticated browser tests. Add additional test-account variables only when the test suite explicitly consumes them. GitHub Actions secrets and Codespaces secrets are separate stores.

Never put passwords, service-role keys, Supabase access tokens, database passwords, or refresh tokens in source files, screenshots, build arguments, or public environment variables.

## GitHub Actions

The `Vendrith Chat CI` workflow is intended to run on pushes and pull requests to `main`, and can be manually dispatched. It installs the lockfile, audits dependencies, type-checks, runs unit tests, installs Playwright Chromium, runs browser interaction tests, and builds the app.

A green workflow is not sufficient evidence of authenticated E2E unless:
- `E2E_SUPABASE_AUTH` is enabled by the workflow's configured public project URL and publishable key.
- The authenticated E2E cases execute rather than skip.
- The workflow logs/artifacts show the expected test counts without exposing secret values.

## Vercel deployment

For a Non-Production preview/deployment:
1. Link the intended Vendrith Chat repository and the intended branch.
2. Configure the two public Supabase variables using the Non-Production project only.
3. Keep test-account credentials out of Vercel production/browser variables; they belong only in GitHub Actions secrets.
4. Confirm the deployed build is still protected by the exact project-reference guard.
5. Confirm Auth redirect URLs are limited to the intended Non-Production deployment and local development URLs.
6. Inspect deployment logs for configuration errors; do not paste secrets into support conversations.

The current application guard deliberately prevents connecting this deployment to the canonical World of Vendrith production project. A future production integration requires a separately approved architecture change, environment-specific configuration design, dedicated migration review, and rollback plan. Do not work around the guard with aliases, proxy URLs, or hardcoded credentials.

## Domain and Auth callbacks

- Use HTTPS for deployed callbacks.
- Allow only exact callback URLs required by the Non-Production deployment.
- Keep local callback URLs limited to local development.
- Do not use wildcard redirects.
- Do not place tokens in query strings or fragments.
- Cross-origin identity handoff to World of Vendrith is not implemented by merely sharing a Supabase project.

## Rollback

- Roll back application code through the deployment platform's known-good deployment controls.
- Do not automatically roll back database migrations; schema rollback may be destructive or incompatible with already-written data.
- For database changes, prepare a forward-fix or a reviewed migration-specific rollback plan before applying anything.
- Preserve the Non-Production test data and migration history during recovery.
