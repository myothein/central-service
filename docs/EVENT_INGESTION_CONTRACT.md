# Central event ingestion contract (development-only)

- POST /api/v1/events, not /tenant/events. Tenant-agent must explicitly configure SYSTEM_API_URL to match this base URL.
- Request: { id: UUID, tenantId: pre-provisioned system tenant ID, agentId, event_type, aggregate_type, aggregate_id, payload: object, occurredAt: UTC ISO string }. Body is limited to 256 KiB; canonical domain data inside event payload is limited to 64 KiB.
- Authorization: Bearer token provisioned in CENTRAL_AGENT_KEYS_JSON mapping tenantId -> unique agent key with at least 32 UTF-8 bytes. Missing/invalid config **503**; mismatched tenant credentials **401**. Never use the request's tenantId alone for authority.
- Response: **201 accepted** only after PostgreSQL insert commits; **200 duplicate** only for same event ID, tenant, agent, type, timestamp and payload; **409** for event ID reuse with different content; **404** for unknown/suspended tenant. All unsuccessful requests MUST remain queued in durable agent outbox.
- PostgreSQL schema source: pinned db-helper system migration. Do not run migrations on startup.
- No production identity/mTLS/secret rotation/rate limits, tenant-agent end-to-end wiring, signed events, data-retention controls, dead-letter handling or robust schema evolution yet. **Production NO-GO.**

## Agent heartbeat (DEV contract)

POST /api/v1/heartbeats: {tenantId, sentAt:<agent Unix milliseconds>}. Requires the same tenant-specific agent Bearer key as event ingestion. The server updates the tenant's lastHeartbeat using **PostgreSQL server time**, never the client-supplied sentAt; returns HTTP 200 {success:true,status:'recorded',tenantId,receivedAt}. Invalid/revoked tenant or key never updates heartbeat. This does not replace a production agent registry, signed device identity, outage alerting, or multi-agent health policy.
