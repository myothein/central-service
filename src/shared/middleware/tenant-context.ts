import { Request, Response, NextFunction } from 'express';

export function tenantContext(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId) {
        (req as any).tenantId = tenantId;
    }
    next();
}
