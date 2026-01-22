export const TENANT_STATUS = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    DOWN: 'DOWN',
    DROPPED: 'DROPPED',
} as const;

export type TenantStatus = typeof TENANT_STATUS[keyof typeof TENANT_STATUS];
