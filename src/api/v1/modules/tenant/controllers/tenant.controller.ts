import { Request, Response } from 'express';
import { tenantService } from '../services/tenant.service';
import { successResponse, errorResponse } from '../../../../../shared/http/api-response';
import { NotFoundError } from '../../../../../shared/http/http-errors';

export class TenantController {
    async list(req: Request, res: Response) {
        const tenants = await tenantService.list();
        res.json(successResponse(tenants));
    }

    async getStatus(req: Request, res: Response) {
        const { tenantId } = req.params;
        const tenant = await tenantService.getById(tenantId);
        if (!tenant) throw new NotFoundError('Tenant not found');
        const online = tenantService.isOnline(tenant);
        res.json(successResponse({ ...tenant, online }));
    }

    async pause(req: Request, res: Response) {
        const { tenantId } = req.params;
        const tenant = await tenantService.pause(tenantId);
        res.json(successResponse(tenant, 'Tenant paused'));
    }

    async resume(req: Request, res: Response) {
        const { tenantId } = req.params;
        const tenant = await tenantService.resume(tenantId);
        res.json(successResponse(tenant, 'Tenant resumed'));
    }
}

export const tenantController = new TenantController();
