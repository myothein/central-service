import { Router } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authMiddleware } from '../../../../../shared/middleware/auth.middleware';

export const tenantRoutes = Router();

tenantRoutes.use(authMiddleware);

tenantRoutes.get('/', tenantController.list.bind(tenantController));
tenantRoutes.get('/:tenantId/status', tenantController.getStatus.bind(tenantController));
tenantRoutes.post('/:tenantId/pause', tenantController.pause.bind(tenantController));
tenantRoutes.post('/:tenantId/resume', tenantController.resume.bind(tenantController));
