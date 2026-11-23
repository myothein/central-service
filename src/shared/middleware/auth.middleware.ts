import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type OidcConfig = { issuer: string; audience: string; jwksUrl: string; requiredRole: string };
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function validatedUrl(value: string, label: string): URL {
    let url: URL;
    try { url = new URL(value); }
    catch { throw new Error(label + ' invalid'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash ||
        (url.protocol === 'http:' &&
            (process.env.NODE_ENV === 'production' ||
                !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
        throw new Error(label + ' must use HTTPS outside local QA');
    }
    return url;
}

function readOidcConfig(): OidcConfig {
    const issuer = process.env.CENTRAL_OIDC_ISSUER;
    const jwksUrl = process.env.CENTRAL_OIDC_JWKS_URL;
    const audience = process.env.CENTRAL_OIDC_AUDIENCE;
    const requiredRole = process.env.CENTRAL_OIDC_REQUIRED_ROLE || 'CENTRAL_ADMIN';
    if (!issuer || !jwksUrl || !audience ||
        !/^[A-Za-z0-9_.:-]{2,100}$/.test(audience) ||
        !/^[A-Za-z0-9_-]{2,64}$/.test(requiredRole)) {
        throw new Error('Central OIDC not configured');
    }
    const iss = validatedUrl(issuer, 'CENTRAL_OIDC_ISSUER');
    const keys = validatedUrl(jwksUrl, 'CENTRAL_OIDC_JWKS_URL');
    const prefix = iss.pathname.endsWith('/') ? iss.pathname : iss.pathname + '/';
    if (iss.origin !== keys.origin || iss.pathname === '/' ||
        !keys.pathname.startsWith(prefix)) {
        throw new Error('JWKS must belong to the configured issuer');
    }
    return {
        issuer: iss.href.replace(/\/$/, ''),
        jwksUrl: keys.href,
        audience,
        requiredRole
    };
}

function legacyAdmin(req: Request, res: Response, next: NextFunction) {
    // Never allow a shared administrator key in a production deployment.
    if (!['test', 'development'].includes(process.env.NODE_ENV || '') ||
        process.env.CENTRAL_ALLOW_DEV_API_KEY !== 'true') {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED' });
    }
    const expected = process.env.CENTRAL_ADMIN_API_KEY;
    if (!expected || Buffer.byteLength(expected, 'utf8') < 32) {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED' });
    }
    const header = req.get('authorization') || '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }
    res.locals.subject = 'development-legacy-admin';
    next();
}

async function verifyOidcAdmin(req: Request, res: Response, next: NextFunction) {
    let config: OidcConfig;
    try { config = readOidcConfig(); }
    catch {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED' });
    }
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token || token.length > 16_384) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }
    try {
        let jwks = jwksCache.get(config.jwksUrl);
        if (!jwks) {
            jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
                timeoutDuration: 3000,
                cooldownDuration: 30_000,
                cacheMaxAge: 5 * 60_000
            });
            jwksCache.set(config.jwksUrl, jwks);
        }
        const { payload } = await jwtVerify(token, jwks, {
            issuer: config.issuer,
            audience: config.audience,
            algorithms: ['RS256'],
            clockTolerance: 5,
            maxTokenAge: '1h'
        });
        if (typeof payload.sub !== 'string' || !payload.sub ||
            typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
            return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
        }

        // Central management is global. Never grant it based on TENANT_ADMIN alone.
        // Only the deployment-pinned, signature-verified realm-wide role can administer tenants.
        const realm = payload.realm_access;
        const realmRoles = realm && typeof realm === 'object' && !Array.isArray(realm) &&
            'roles' in realm ? (realm as { roles: unknown }).roles : undefined;
        if (!Array.isArray(realmRoles) || !realmRoles.includes(config.requiredRole)) {
            return res.status(403).json({ success: false, code: 'ROLE_FORBIDDEN' });
        }
        res.locals.subject = payload.sub;
        res.locals.adminRole = config.requiredRole;
        next();
    } catch {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }
}

/** OIDC/JWKS is the secure default; isolated legacy mode is explicit QA only. */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'no-store');
    const mode = process.env.CENTRAL_ADMIN_AUTH_MODE || 'oidc';
    if (mode === 'legacy') return legacyAdmin(req, res, next);
    if (mode !== 'oidc') {
        return res.status(503).json({ success: false, code: 'AUTH_NOT_CONFIGURED' });
    }
    void verifyOidcAdmin(req, res, next).catch(() => {
        if (!res.headersSent) {
            res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
        }
    });
}
