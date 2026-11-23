import { Pool } from 'pg';

let pool: Pool | undefined;

/** A lazily constructed central PostgreSQL pool. The db-helper system schema owns the migrations. */
export function getSystemPool(): Pool {
    if (pool) return pool;
    const connectionString = process.env.SYSTEM_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('System database connection is not configured');
    const parsed = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
        throw new Error('System database URL must use PostgreSQL');
    }
    pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
    pool.on('error', (error: Error) => {
        // Never print error details that could include credentials or connection strings.
        console.error('[system-db] idle connection error: ' + error.name);
    });
    return pool;
}

export async function closeSystemPool(): Promise<void> {
    if (pool) {
        const current = pool;
        pool = undefined;
        await current.end();
    }
}
