import { randomUUID } from 'node:crypto';
import { getSystemPool } from '../../../../../infrastructure/db/system-pool';
import { NotFoundError, BadRequestError } from '../../../../../shared/http/http-errors';
import type { Tenant } from '../tenant.types';
import { TENANT_STATUS, type TenantStatus } from '../tenant.constants';

const fields = '"id", "name", "status", "lastHeartbeat"';

export class TenantService {
    /** Never return databaseUrl, dbPassword, or other system secrets via the API. */
    async list(): Promise<Tenant[]> {
        const result = await getSystemPool().query<Tenant>(
            'SELECT ' + fields + ' FROM "tenants" ORDER BY "name" ASC'
        );
        return result.rows;
    }

    async getById(id: string): Promise<Tenant | null> {
        if (!id?.trim()) return null;
        const result = await getSystemPool().query<Tenant>(
            'SELECT ' + fields + ' FROM "tenants" WHERE "id" = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /** Currently used internally; provisioning remains subject to central admin review. */
    async create(name: string, databaseUrl: string): Promise<Tenant> {
        if (!name?.trim() || !databaseUrl?.trim()) {
            throw new BadRequestError('Tenant name and database URL are required');
        }
        const result = await getSystemPool().query<Tenant>(
            'INSERT INTO "tenants" ("id", "name", "databaseUrl", "status") VALUES ($1,$2,$3,$4) RETURNING ' + fields,
            [randomUUID(), name.trim(), databaseUrl, TENANT_STATUS.ACTIVE]
        );
        return result.rows[0];
    }

    async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
        const result = await getSystemPool().query<Tenant>(
            'UPDATE "tenants" SET "status"=$2, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING ' + fields,
            [id, status]
        );
        if (!result.rows[0]) throw new NotFoundError('Tenant not found');
        return result.rows[0];
    }

    pause(id: string): Promise<Tenant> {
        return this.updateStatus(id, TENANT_STATUS.SUSPENDED);
    }

    resume(id: string): Promise<Tenant> {
        return this.updateStatus(id, TENANT_STATUS.ACTIVE);
    }

    isOnline(tenant: Tenant, thresholdMinutes = 1): boolean {
        if (!tenant.lastHeartbeat) return false;
        if ([TENANT_STATUS.SUSPENDED, TENANT_STATUS.DROPPED].includes(tenant.status as any)) return false;
        const age = Date.now() - new Date(tenant.lastHeartbeat).getTime();
        return Number.isFinite(age) && age >= 0 && age <= thresholdMinutes * 60000;
    }
}

export const tenantService = new TenantService();
