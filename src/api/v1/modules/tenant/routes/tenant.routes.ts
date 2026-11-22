import { Router, Request, Response, NextFunction } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authMiddleware } from '../../../../../shared/middleware/auth.middleware';

export const tenantRoutes = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

tenantRoutes.use(authMiddleware);
tenantRoutes.get('/', wrap(tenantController.list.bind(tenantController)));
tenantRoutes.get('/:tenantId/status', wrap(tenantController.getStatus.bind(tenantController)));
tenantRoutes.post('/:tenantId/pause', wrap(tenantController.pause.bind(tenantController)));
tenantRoutes.post('/:tenantId/resume', wrap(tenantController.resume.bind(tenantController)));
