import express, { Application } from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { loadConfig } from './config/load-config';
import { tenantRoutes } from './api/v1/modules/tenant/routes/tenant.routes';
import { eventRoutes } from './api/v1/modules/event/routes/event.routes';
import { agentRoutes } from './api/v1/modules/agent/routes/agent.routes';
import { projectionRoutes } from './api/v1/modules/projection/routes/projection.routes';
import { heartbeatRoutes } from './api/v1/modules/heartbeat/routes/heartbeat.routes';
import { authRoutes } from './api/v1/modules/auth/routes/auth.routes';
import { errorHandler } from './shared/http/error-handler';

const config = loadConfig();
const app: Application = express();

app.use(cors());
app.use(json());

// Base routes
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/projections', projectionRoutes);
app.use('/api/v1/heartbeats', heartbeatRoutes);
app.use('/api/v1/auth', authRoutes);

// Error handling
app.use(errorHandler);

const PORT = config.port || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Central Service running on port ${PORT}`);
});
