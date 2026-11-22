import { Request, Response, NextFunction } from 'express';

/** Never derive tenant identity from a client-controlled header. */
export function tenantContext(req: Request, res: Response, next: NextFunction) {
    if (req.headers['x-tenant-id']) {
        return res.status(403).json({ success: false, code: 'UNTRUSTED_TENANT', message: 'Tenant header not accepted' });
    }
    next();
}
