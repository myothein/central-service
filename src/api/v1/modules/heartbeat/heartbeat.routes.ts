import { Router, Request, Response, NextFunction } from 'express';
import { requireTenantAgent } from '../event/event-auth';
import { getSystemPool } from '../../../../infrastructure/db/system-pool';

export const heartbeatRoutes = Router();

heartbeatRoutes.post('/', requireTenantAgent, (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
        const tenantId = res.locals.authorizedTenantId as string;
        const sentAt: unknown = req.body?.sentAt;
        if (typeof sentAt !== 'number' || !Number.isSafeInteger(sentAt) ||
            sentAt <= 0 || sentAt > 253402300799999 ||
            tenantId !== req.body?.tenantId) {
            res.status(400).json({ success: false, code: 'INVALID_HEARTBEAT' });
            return;
        }

        // DB server time, never the untrusted agent wall clock.
        const result = await getSystemPool().query<{id:string;lastHeartbeat:Date}>(
            'UPDATE "tenants" SET "lastHeartbeat"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP ' +
            'WHERE "id"=$1 AND "isActive"=true AND "status"=\'ACTIVE\' ' +
            'RETURNING "id", "lastHeartbeat"',
            [tenantId]
        );
        if (!result.rows[0]) {
            res.status(404).json({ success: false, code: 'TENANT_NOT_ACTIVE' });
            return;
        }
        res.status(200).json({
            success: true, status: 'recorded',
            tenantId:result.rows[0].id,
            receivedAt:new Date(result.rows[0].lastHeartbeat).toISOString()
        });
    })().catch(next);
});
