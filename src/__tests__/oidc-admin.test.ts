import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { once } from 'node:events';
import { generateKeyPairSync } from 'node:crypto';
import express from 'express';
import { exportJWK, SignJWT } from 'jose';
import { authMiddleware } from '../shared/middleware/auth.middleware';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: wrongPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const audience = 'gtsp-central-admin';
const envNames = [
    'CENTRAL_ADMIN_AUTH_MODE', 'CENTRAL_ALLOW_DEV_API_KEY', 'CENTRAL_ADMIN_API_KEY',
    'CENTRAL_OIDC_ISSUER', 'CENTRAL_OIDC_JWKS_URL', 'CENTRAL_OIDC_AUDIENCE',
    'CENTRAL_OIDC_REQUIRED_ROLE', 'NODE_ENV'
];
const prior = new Map<string, string | undefined>();
let issuer = '';
let jwksServer: Server;
let appServer: Server;
let appUrl = '';

before(async () => {
    for (const key of envNames) prior.set(key, process.env[key]);
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'qa-rs256';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    const jwks = JSON.stringify({ keys: [jwk] });
    jwksServer = createServer((req, res) => {
        if (req.url === '/realms/gtsp/protocol/openid-connect/certs') {
            res.setHeader('Content-Type', 'application/json');
            res.end(jwks);
            return;
        }
        res.writeHead(404).end();
    });
    jwksServer.listen(0, '127.0.0.1');
    await once(jwksServer, 'listening');
    const jwksAddress = jwksServer.address();
    if (!jwksAddress || typeof jwksAddress === 'string') throw Error('No JWKS server');
    issuer = 'http://127.0.0.1:' + jwksAddress.port + '/realms/gtsp';

    const app = express();
    app.get('/protected', authMiddleware, (_req, res) =>
        res.json({ success: true, subject: res.locals.subject }));
    appServer = app.listen(0, '127.0.0.1');
    await once(appServer, 'listening');
    const address = appServer.address();
    if (!address || typeof address === 'string') throw Error('No API listener');
    appUrl = 'http://127.0.0.1:' + address.port;
    process.env.NODE_ENV = 'test';
    process.env.CENTRAL_ADMIN_AUTH_MODE = 'oidc';
    process.env.CENTRAL_OIDC_ISSUER = issuer;
    process.env.CENTRAL_OIDC_JWKS_URL = issuer + '/protocol/openid-connect/certs';
    process.env.CENTRAL_OIDC_AUDIENCE = audience;
    process.env.CENTRAL_OIDC_REQUIRED_ROLE = 'CENTRAL_ADMIN';
});

after(async () => {
    for (const key of envNames) {
        const value = prior.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    await Promise.all([appServer, jwksServer].map(server =>
        new Promise<void>((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve()))));
});

async function token(options: {
    roles?: string[]; issuer?: string; audience?: string; wrongKey?: boolean;
    expiry?: string;
} = {}): Promise<string> {
    return new SignJWT({ realm_access: { roles: options.roles ?? ['CENTRAL_ADMIN'] } })
        .setProtectedHeader({ alg: 'RS256', kid: 'qa-rs256' })
        .setSubject('qa-central-admin')
        .setIssuer(options.issuer ?? issuer)
        .setAudience(options.audience ?? audience)
        .setIssuedAt()
        .setExpirationTime(options.expiry ?? '5m')
        .sign(options.wrongKey ? wrongPrivateKey : privateKey);
}
async function call(accessToken?: string) {
    const response = await fetch(appUrl + '/protected', {
        headers: accessToken ? { authorization: 'Bearer ' + accessToken } : {}
    });
    return { status: response.status, body: await response.json() as {
        code?: string; success?: boolean; subject?: string
    }};
}

test('RS256 JWKS token with central realm role authorizes admin', async () => {
    const r = await call(await token());
    assert.equal(r.status, 200);
    assert.equal(r.body.subject, 'qa-central-admin');
});

test('tenant-admin or unrelated role cannot administer central tenants', async () => {
    const r = await call(await token({ roles: ['TENANT_ADMIN'] }));
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'ROLE_FORBIDDEN');
});

test('rejects incorrect signature, issuer, audience and expired credentials', async () => {
    for (const credential of [
        await token({ wrongKey: true }),
        await token({ issuer: issuer + '-wrong' }),
        await token({ audience: 'some-other-client' }),
        await token({ expiry: '-1h' })
    ]) {
        const response = await call(credential);
        assert.equal(response.status, 401);
        assert.equal(response.body.code, 'UNAUTHORIZED');
    }
});

test('missing bearer credentials do not access Central API', async () => {
    const response = await call();
    assert.equal(response.status, 401);
});

test('issuer and JWKS must be pinned to the same realm and origin', async () => {
    const original = process.env.CENTRAL_OIDC_JWKS_URL;
    process.env.CENTRAL_OIDC_JWKS_URL = issuer.replace('/realms/gtsp', '/realms/other') +
        '/protocol/openid-connect/certs';
    try {
        const response = await call(await token());
        assert.equal(response.status, 503);
        assert.equal(response.body.code, 'AUTH_NOT_CONFIGURED');
    } finally {
        if (original === undefined) delete process.env.CENTRAL_OIDC_JWKS_URL;
        else process.env.CENTRAL_OIDC_JWKS_URL = original;
    }
});

test('shared admin API key is rejected in production even if legacy mode is requested', async () => {
    const original = {
        node: process.env.NODE_ENV, mode: process.env.CENTRAL_ADMIN_AUTH_MODE,
        allow: process.env.CENTRAL_ALLOW_DEV_API_KEY, key: process.env.CENTRAL_ADMIN_API_KEY
    };
    process.env.NODE_ENV = 'production';
    process.env.CENTRAL_ADMIN_AUTH_MODE = 'legacy';
    process.env.CENTRAL_ALLOW_DEV_API_KEY = 'true';
    process.env.CENTRAL_ADMIN_API_KEY = 'ci-only-legacy-admin-key-over-32-characters';
    try {
        const response = await call(process.env.CENTRAL_ADMIN_API_KEY);
        assert.equal(response.status, 503);
        assert.equal(response.body.code, 'AUTH_NOT_CONFIGURED');
    } finally {
        for (const [key, value] of [
            ['NODE_ENV', original.node], ['CENTRAL_ADMIN_AUTH_MODE', original.mode],
            ['CENTRAL_ALLOW_DEV_API_KEY', original.allow], ['CENTRAL_ADMIN_API_KEY', original.key]
        ] as Array<[string, string | undefined]>) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
