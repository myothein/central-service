import { prisma } from '../../../../../infrastructure/db/prisma';
import { Tenant, TenantStatus, TENANT_STATUS } from '../tenant.types';
import dayjs from 'dayjs';

export class TenantService {
    async list(): Promise<Tenant[]> {
        return prisma.tenant.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async getById(id: string): Promise<Tenant | null> {
        return prisma.tenant.findUnique({ where: { id } });
    }

    async create(name: string): Promise<Tenant> {
        return prisma.tenant.create({
            data: { name, status: TENANT_STATUS.ACTIVE },
        });
    }

    async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
        return prisma.tenant.update({ where: { id }, data: { status } });
    }

    async pause(id: string): Promise<Tenant> {
        return this.updateStatus(id, TENANT_STATUS.SUSPENDED);
    }

    async resume(id: string): Promise<Tenant> {
        return this.updateStatus(id, TENANT_STATUS.ACTIVE);
    }

    isOnline(tenant: Tenant, thresholdMinutes = 1): boolean {
        if (!tenant.lastHeartbeat) return false;
        if (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.DROPPED) return false;
        return dayjs().diff(dayjs(tenant.lastHeartbeat), 'minute') <= thresholdMinutes;
    }
}

export const tenantService = new TenantService();
