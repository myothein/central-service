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
