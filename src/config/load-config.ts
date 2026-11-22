import dotenv from 'dotenv';
import path from 'path';

// Local development only. In deployment, inject secrets via approved secret manager.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function loadConfig() {
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT configuration');
    return {
        port,
        databaseUrl: process.env.SYSTEM_DATABASE_URL || process.env.DATABASE_URL || '',
        logLevel: process.env.LOG_LEVEL || 'info',
    };
}
