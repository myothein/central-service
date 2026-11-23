import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { app } from '../server';

type CapturedResponse = { status: number; headers: Headers; json: () => Promise<unknown> };
async function request(path: string, options: RequestInit = {}): Promise<CapturedResponse> {
    const server = app.listen(0, '127.0.0.1');
    try {
        await once(server, 'listening');
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('No TCP listener');
        const response = await fetch('http://127.0.0.1:' + address.port + path, options);
        // Read the complete response before closing the listener (no active socket leak).
        const body = await response.text();
        return { status: response.status, headers: response.headers, json: async () => JSON.parse(body) };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
}

test('liveness endpoint is available without leaking system details', async () => {
    const response = await request('/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'alive' });
    assert.equal(response.headers.get('x-powered-by'), null);
});

test('management API fails closed without configured administrator credential', async () => {
    const previous = process.env.CENTRAL_ADMIN_API_KEY;
    delete process.env.CENTRAL_ADMIN_API_KEY;
    try {
        const response = await request('/api/v1/tenants');
        assert.equal(response.status, 503);
        const body = await response.json() as { code: string };
        assert.equal(body.code, 'AUTH_NOT_CONFIGURED');
    } finally {
        if (previous === undefined) delete process.env.CENTRAL_ADMIN_API_KEY;
        else process.env.CENTRAL_ADMIN_API_KEY = previous;
    }
});

test('QA-only shared key rejects invalid bearer token', async () => {
    const previous = {
        key: process.env.CENTRAL_ADMIN_API_KEY,
        mode: process.env.CENTRAL_ADMIN_AUTH_MODE,
        allow: process.env.CENTRAL_ALLOW_DEV_API_KEY,
        node: process.env.NODE_ENV
    };
    process.env.CENTRAL_ADMIN_API_KEY = 'development-test-key-with-at-least-32-characters';
    process.env.CENTRAL_ADMIN_AUTH_MODE = 'legacy';
    process.env.CENTRAL_ALLOW_DEV_API_KEY = 'true';
    process.env.NODE_ENV = 'test';
    try {
        const response = await request('/api/v1/tenants', {
            headers: { authorization: 'Bearer invalid-token' }
        });
        assert.equal(response.status, 401);
        const body = await response.json() as { code: string };
        assert.equal(body.code, 'UNAUTHORIZED');
    } finally {
        for (const [envKey, value] of [
            ['CENTRAL_ADMIN_API_KEY', previous.key], ['CENTRAL_ADMIN_AUTH_MODE', previous.mode],
            ['CENTRAL_ALLOW_DEV_API_KEY', previous.allow], ['NODE_ENV', previous.node]
        ] as Array<[string, string | undefined]>) {
            if (value === undefined) delete process.env[envKey];
            else process.env[envKey] = value;
        }
    }
});

test('event ingestion fails closed without provisioned agent credentials', async () => {
    const response = await request('/api/v1/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'test-event', type: 'example' })
    });
    assert.equal(response.status, 503);
    const body = await response.json() as { code: string };
    assert.equal(body.code, 'AUTH_NOT_CONFIGURED');
});

test('disallowed browser origin does not receive permissive CORS headers', async () => {
    const response = await request('/health', {
        headers: { origin: 'https://not-an-approved-origin.invalid' }
    });
    assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('heartbeat API rejects unauthenticated agents before writing database state', async () => {
    const prior=process.env.CENTRAL_AGENT_KEYS_JSON;
    delete process.env.CENTRAL_AGENT_KEYS_JSON;
    try {
        const response=await request('/api/v1/heartbeats',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({tenantId:'university-ci-a', sentAt:Date.now()})
        });
        assert.equal(response.status,503);
        const body=await response.json() as {code:string};
        assert.equal(body.code,'AUTH_NOT_CONFIGURED');
    } finally {
        if(prior===undefined)delete process.env.CENTRAL_AGENT_KEYS_JSON;
        else process.env.CENTRAL_AGENT_KEYS_JSON=prior;
    }
});
