import { Router, Request, Response, NextFunction } from 'express';
import { getSystemPool } from '../../../../infrastructure/db/system-pool';
import { requireTenantAgent } from './event-auth';

export const eventRoutes = Router();
const eventIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const identifier = /^[A-Za-z0-9_.-]{1,100}$/;
const eventType = /^[A-Za-z][A-Za-z0-9_.-]{1,79}$/;
type RecordBody = { id: string; tenantId: string; agentId: string; event_type: string;
    aggregate_type: string; aggregate_id: string; occurredAt: string; payload: unknown };

function validate(value: unknown): { body: RecordBody; canonicalPayload: string; occurredAt: string } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Partial<RecordBody>;
    if (typeof v.id !== 'string' || !eventIdPattern.test(v.id) ||
        typeof v.tenantId !== 'string' || typeof v.agentId !== 'string' ||
        !identifier.test(v.agentId) ||
        typeof v.event_type !== 'string' || !eventType.test(v.event_type) ||
        typeof v.aggregate_type !== 'string' || !identifier.test(v.aggregate_type) ||
        typeof v.aggregate_id !== 'string' || !identifier.test(v.aggregate_id) ||
        typeof v.occurredAt !== 'string' ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v.occurredAt) ||
        !Number.isFinite(Date.parse(v.occurredAt)) ||
        !v.payload || typeof v.payload !== 'object' || Array.isArray(v.payload)) return null;
    const canonicalPayload = JSON.stringify({
        data: v.payload, aggregate_type: v.aggregate_type, aggregate_id: v.aggregate_id
    });
    if (Buffer.byteLength(canonicalPayload, 'utf8') > 64 * 1024) return null;
    return { body: v as RecordBody, canonicalPayload,
        occurredAt: new Date(v.occurredAt).toISOString() };
}

eventRoutes.post('/', requireTenantAgent, (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
        const parsed = validate(req.body);
        if (!parsed || parsed.body.tenantId !== res.locals.authorizedTenantId) {
            res.status(400).json({ success: false, code: 'INVALID_EVENT' });
            return;
        }
        const { body, canonicalPayload, occurredAt } = parsed;
        const params = [body.id, body.tenantId, body.agentId, body.event_type, canonicalPayload, occurredAt];
        const db = getSystemPool();
        // Acknowledgment occurs only AFTER PostgreSQL has persisted the event.
        const created = await db.query<{id:string}>(`
            INSERT INTO "events" ("id", "tenantId", "agentId", "type", "payload", "occurredAt")
            SELECT $1, $2, $3, $4, $5::jsonb, $6::timestamp
            WHERE EXISTS (SELECT 1 FROM "tenants" WHERE "id"=$2 AND "isActive"=true AND "status"='ACTIVE')
            ON CONFLICT ("id") DO NOTHING
            RETURNING "id"`, params);
        if (created.rows[0]) {
            res.status(201).json({ success: true, status: 'accepted', eventId: body.id });
            return;
        }
        const matched = await db.query<{id:string}>(`
            SELECT "id" FROM "events" WHERE "id"=$1 AND "tenantId"=$2
            AND "agentId" IS NOT DISTINCT FROM $3 AND "type"=$4
            AND "payload"=$5::jsonb AND "occurredAt"=$6::timestamp`, params);
        if (matched.rows[0]) {
            res.status(200).json({ success: true, status: 'duplicate', eventId: body.id });
            return;
        }
        const exists = await db.query<{id:string}>(
            'SELECT "id" FROM "tenants" WHERE "id"=$1 AND "isActive"=true AND "status"=\'ACTIVE\'',
            [body.tenantId]
        );
        if (!exists.rows[0]) {
            res.status(404).json({ success: false, code: 'TENANT_NOT_ACTIVE' });
            return;
        }
        res.status(409).json({ success: false, code: 'EVENT_ID_COLLISION' });
    })().catch(next);
});
