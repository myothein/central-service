import { TenantStatus } from './tenant.constants';

export interface Tenant {
    id: string;
    name: string;
    status: TenantStatus;
    lastHeartbeat: Date | null;
}
