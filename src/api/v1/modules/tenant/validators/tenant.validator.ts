import { body, param } from 'express-validator';

export const tenantIdParam = [
    param('tenantId').isUUID().withMessage('Invalid tenantId'),
];

export const tenantNameBody = [
    body('name').isString().notEmpty().withMessage('Tenant name is required'),
];
