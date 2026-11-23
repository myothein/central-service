import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { app } from '../server';

async function request(payload: unknown, token?: string) {
    const server = app.listen(0, '127.0.0.1');
    try {
        await once(server, 'listening');
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('No test listener');
        const response = await fetch('http://127.0.0.1:' + addr.port + '/api/v1/events', {
            method: 'POST', headers: { 'content-type': 'application/json',
                ...(token ? { authorization: 'Bearer ' + token } : {}) },
            body: JSON.stringify(payload)
        });
        return { status: response.status, body: await response.json() as {code?:string} };
    } finally {
        await new Promise<void>((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve()));
    }
}
const tenantId = 'university-ci';
const message = { id: '123e4567-e89b-42d3-a456-426614174000', tenantId,
    agentId: 'tenant-agent', event_type: 'subject.created',
    aggregate_type: 'Subject', aggregate_id: '101',
    occurredAt: '2026-01-01T00:00:00.000Z', payload: {name:'Physics'} };

test('ingestion never acknowledges events without scoped credentials', async () => {
    const prior = process.env.CENTRAL_AGENT_KEYS_JSON;
    delete process.env.CENTRAL_AGENT_KEYS_JSON;
    try { const r = await request(message); assert.equal(r.status, 503);
        assert.equal(r.body.code, 'AUTH_NOT_CONFIGURED'); }
    finally { if (prior === undefined) delete process.env.CENTRAL_AGENT_KEYS_JSON;
        else process.env.CENTRAL_AGENT_KEYS_JSON = prior; }
});
test('ingestion rejects token for different tenant before DB access', async () => {
    const prior = process.env.CENTRAL_AGENT_KEYS_JSON;
    process.env.CENTRAL_AGENT_KEYS_JSON = JSON.stringify({
        [tenantId]: 'integration-test-key-that-is-at-least-32-bytes',
        'another-university': 'a-different-integration-test-key-at-least-32-bytes'
    });
    try {
        const r = await request({...message, tenantId:'another-university'},
            'integration-test-key-that-is-at-least-32-bytes');
        assert.equal(r.status, 401);
        assert.equal(r.body.code,'UNAUTHORIZED');
    } finally { if (prior === undefined) delete process.env.CENTRAL_AGENT_KEYS_JSON;
        else process.env.CENTRAL_AGENT_KEYS_JSON = prior; }
});
test('tenant agent credential reused as Central admin key fails closed', async () => {
    const previous = {
        agent: process.env.CENTRAL_AGENT_KEYS_JSON,
        admin: process.env.CENTRAL_ADMIN_API_KEY
    };
    const shared = 'ci-synthetic-shared-role-key-longer-than-32-bytes';
    process.env.CENTRAL_AGENT_KEYS_JSON = JSON.stringify({ [tenantId]: shared });
    process.env.CENTRAL_ADMIN_API_KEY = shared;
    try {
        const response = await request(message, shared);
        assert.equal(response.status, 503);
        assert.equal(response.body.code, 'AUTH_NOT_CONFIGURED');
    } finally {
        if (previous.agent === undefined) delete process.env.CENTRAL_AGENT_KEYS_JSON;
        else process.env.CENTRAL_AGENT_KEYS_JSON = previous.agent;
        if (previous.admin === undefined) delete process.env.CENTRAL_ADMIN_API_KEY;
        else process.env.CENTRAL_ADMIN_API_KEY = previous.admin;
    }
});

test('invalid event is rejected before DB access, even with valid tenant key', async () => {
    const prior = process.env.CENTRAL_AGENT_KEYS_JSON;
    const key = 'integration-test-key-that-is-at-least-32-bytes';
    process.env.CENTRAL_AGENT_KEYS_JSON = JSON.stringify({[tenantId]:key});
    try {const r = await request({...message, id:'not-an-uuid'}, key);
        assert.equal(r.status, 400); assert.equal(r.body.code,'INVALID_EVENT');}
    finally {if(prior===undefined)delete process.env.CENTRAL_AGENT_KEYS_JSON;
        else process.env.CENTRAL_AGENT_KEYS_JSON=prior;}
});
