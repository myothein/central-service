import { Tenant } from '../tenant.types';

export function mapTenantToDto(tenant: Tenant) {
    return {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        lastHeartbeat: tenant.lastHeartbeat?.toISOString() ?? null,
    };
}
