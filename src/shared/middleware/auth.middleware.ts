import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

/** Temporary machine-to-machine admin gate. Mandatory OIDC + RBAC remains a release blocker. */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'no-store');
    const expected = process.env.CENTRAL_ADMIN_API_KEY;
    if (!expected || Buffer.byteLength(expected, 'utf8') < 32) {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED', message: 'Management API unavailable' });
    }
    const header = req.get('authorization') || '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }
    next();
}
