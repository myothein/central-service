import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

// Temporary per-tenant agent credentials; final production requires workload identity and rotation.
const tenantCodePattern = /^[A-Za-z0-9_-]{1,64}$/;

export function requireTenantAgent(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'no-store');
    const raw = process.env.CENTRAL_AGENT_KEYS_JSON;
    if (!raw) {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED' });
    }
    let credentials: Record<string, string>;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
        credentials = parsed as Record<string, string>;
        const values = Object.values(credentials);
        if (values.length === 0 || values.length > 1000 || values.some(value =>
            typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 32) ||
            new Set(values).size !== values.length ||
            Object.keys(credentials).some(code => !tenantCodePattern.test(code))) {
            throw new Error('invalid');
        }
    } catch {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED' });
    }
    const tenantId: unknown = req.body?.tenantId;
    if (typeof tenantId !== 'string' || !tenantCodePattern.test(tenantId)) {
        return res.status(400).json({ success: false, code: 'INVALID_TENANT' });
    }
    const expected = credentials[tenantId];
    const header = req.get('authorization') || '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    // A tenant identifier in an HTTP request is never proof of authorization.
    const presented = Buffer.from(provided, 'utf8');
    const authorized = expected && presented.length === Buffer.byteLength(expected,'utf8') &&
        timingSafeEqual(presented, Buffer.from(expected, 'utf8'));
    if (!authorized) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }
    res.locals.authorizedTenantId = tenantId;
    next();
}
