import express, { Application } from 'express';
import cors from 'cors';
import { loadConfig } from './config/load-config';
import { tenantRoutes } from './api/v1/modules/tenant/routes/tenant.routes';
import { eventRoutes } from './api/v1/modules/event/event.routes';
import { errorHandler } from './shared/http/error-handler';

loadConfig();
export const app: Application = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.CENTRAL_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json({ limit: '256kb' }));

// Liveness only. This does not certify DB readiness or integration health.
app.get('/health', (_req, res) => res.json({ status: 'alive' }));

app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/events', eventRoutes);

// Fail closed until these APIs are implemented, authenticated and integration tested.
// In particular, tenant-agent must retry on 501, never mark events as delivered.
for (const path of ['/api/v1/agents', '/api/v1/projections', '/api/v1/heartbeats', '/api/v1/auth']) {
    app.use(path, (_req, res) => res.status(501).json({
        success: false, code: 'NOT_IMPLEMENTED', message: 'Endpoint is not yet available'
    }));
}

app.use(errorHandler);
