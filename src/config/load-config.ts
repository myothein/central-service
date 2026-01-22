import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function loadConfig() {
    return {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
        databaseUrl: process.env.DATABASE_URL || '',
        jwtSecret: process.env.JWT_SECRET || 'changeme',
        logLevel: process.env.LOG_LEVEL || 'info',
    };
}
