import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { app } from '../server';
import { getSystemPool, closeSystemPool } from '../infrastructure/db/system-pool';

const tenantA = 'university-ci-a';
const tenantB = 'university-ci-b';
const tokenA = 'ci-only-tenant-a-credential-longer-than-32-bytes';
const tokenB = 'ci-only-tenant-b-credential-longer-than-32-bytes';

async function api(payload: unknown, token: string) {
    const server = app.listen(0, '127.0.0.1');
    try {
        await once(server, 'listening');
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('No test port');
        const r = await fetch('http://127.0.0.1:' + addr.port + '/api/v1/events', {
            method: 'POST',
            headers: {'content-type':'application/json', authorization:'Bearer '+token },
            body:JSON.stringify(payload)
        });
        return { status:r.status, body:await r.json() as {success?:boolean; status?:string; code?:string} };
    } finally {
        await new Promise<void>((resolve,reject) =>
            server.close(e => e ? reject(e) : resolve()));
    }
}

test('PostgreSQL: tenant-scoped durable ingestion, idempotent retry and collision prevention', {
    skip: process.env.RUN_PG_INTEGRATION !== '1'
}, async () => {
    process.env.CENTRAL_AGENT_KEYS_JSON = JSON.stringify({[tenantA]:tokenA,[tenantB]:tokenB});
    const db = getSystemPool();
    for (const id of [tenantA, tenantB]) {
        await db.query('INSERT INTO "tenants" ("id", "name", "databaseUrl") VALUES ($1,$2,$3)', 
            [id, id, 'postgresql://example.invalid/no-real-password']);
    }
    const id = randomUUID();
    const payload = { id, tenantId:tenantA, agentId:'tenant-agent', event_type:'subject.created',
        aggregate_type:'Subject', aggregate_id:'33', payload:{id:33,name:'Physics'},
        occurredAt:'2026-01-01T12:34:56.123Z', createdAt:'2026-01-01T12:34:57.000Z' };
    try {
        const first = await api(payload,tokenA);
        assert.equal(first.status,201,JSON.stringify(first.body));
        assert.equal(first.body.status,'accepted');
        const retry = await api(payload,tokenA);
        assert.equal(retry.status,200,JSON.stringify(retry.body));
        assert.equal(retry.body.status,'duplicate');
        const impersonate = await api({...payload,tenantId:tenantB},tokenA);
        assert.equal(impersonate.status,401);
        const collision = await api({...payload,tenantId:tenantB},tokenB);
        assert.equal(collision.status,409);
        assert.equal(collision.body.code,'EVENT_ID_COLLISION');
        const altered = await api({...payload,payload:{id:33,name:'Changed'}},tokenA);
        assert.equal(altered.status,409);
        const persisted = await db.query(
            'SELECT "tenantId", "type", "payload", "occurredAt" FROM "events" WHERE "id"=$1', [id]);
        assert.equal(persisted.rowCount,1);
        assert.equal(persisted.rows[0].tenantId,tenantA);
        assert.equal(persisted.rows[0].type,'subject.created');
        assert.deepEqual(persisted.rows[0].payload,
            {data:{id:33,name:'Physics'},aggregate_type:'Subject',aggregate_id:'33'});
        await db.query('UPDATE "tenants" SET "status"=\'SUSPENDED\' WHERE "id"=$1', [tenantB]);
        const stopped = await api({...payload,id:randomUUID(),tenantId:tenantB},tokenB);
        assert.equal(stopped.status,404);
        const rowCount=await db.query('SELECT count(*)::int AS n FROM "events" WHERE "id"=$1',[id]);
        assert.equal(rowCount.rows[0].n,1);
    } finally { await closeSystemPool(); }
});
