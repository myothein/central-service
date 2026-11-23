# Production readiness gates — central-service

**Status: NO-GO.** This branch proposes *source-control hygiene only*. It is not a security or production certification.

## Non-negotiable before merge/release

- [ ] Review/rotate or revoke all credentials that may ever have been committed. **Deleting a file in a new commit does not erase it from Git history or forks.** Coordinate any history rewrite and backup with repository owners; never paste secrets into issues or logs.
- [ ] Inject environment-specific secrets at deployment time. The .env.example file contains no credentials. Verify no code path can default to a known JWT signing secret.
- [ ] Remove committed dependencies/runtime outputs; commit a pinned lockfile and run a reproducible clean install.
- [ ] Restore/import and compile the currently missing API modules in src/server.ts, or explicitly eliminate unused routes; require TypeScript build PASS.
- [ ] Replace the auth middleware's Authorization-header-presence check with verified identity, role/tenant-scoped authorization, least-privilege CORS and tests for denial cases.
- [ ] Add persistent event outbox, idempotency, restart recovery, retry handling and durable heartbeat monitoring.
- [ ] Complete schema/API contract, database migration checks, backup/restore evidence, integration tests, dependency review and independent release approval.

This project is an infrastructure service. Integrating UIMS V1 is **out of scope until these gates pass**.

## OIDC central admin draft update — 2026-11-23

- Central tenant-management endpoints now default to RS256-verified OIDC JWT authentication with deployment-pinned issuer/JWKS URL, audience, subject, expiry/iat and exact CENTRAL_ADMIN realm role. TENANT_ADMIN alone does not authorize system-wide tenant management.
- Issuer and JWKS are pinned to the same Keycloak realm path and origin; HTTP is permitted only for local QA, never production.
- Old CENTRAL_ADMIN_API_KEY authentication now requires explicit CENTRAL_ADMIN_AUTH_MODE=legacy, CENTRAL_ALLOW_DEV_API_KEY=true and NODE_ENV=test or development. Production always fails closed for legacy auth.
- Added synthetic RSA/JWKS negative tests for invalid signature, issuer, audience, expiry, realm role and production legacy-key rejection.
- Production rollout is NOT authorized: real Keycloak realm mapping, operator login flow and central-cli workload authorization are not verified; agent mTLS/key rotation, PostgreSQL least-privilege grants, restore drills, and six-repository acceptance remain open.
- Existing central-cli integration tests use an isolated QA-only legacy key and do not validate real Keycloak. Production must NOT run with legacy auth.
