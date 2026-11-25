import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import {
  anonymizeCustomerData,
  exportCustomerPersonalData,
  listAuditLogs,
} from './privacy.service.js';
import { dataResponseSchema, errorResponseSchema, idParamsSchema, secureOperation } from '../../openapi.js';

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/audit-logs',
    { preHandler: [authorize(['OWNER', 'ADMIN'])], schema: {
      tags: ['privacy'],
      summary: 'List tenant audit-log entries',
      security: secureOperation,
      response: { 200: dataResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema },
    } },
    async (request) => {
      const logs = await listAuditLogs(request.user.orgId);
      return { data: logs };
    }
  );

  app.get<{ Params: { id: string } }>(
    '/customers/:id/export',
    { preHandler: [authorize(['OWNER', 'ADMIN'])], schema: {
      tags: ['privacy'],
      summary: 'Export a customer data bundle',
      security: secureOperation,
      params: idParamsSchema,
      response: { 200: dataResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema },
    } },
    async (request) => {
      const bundle = await exportCustomerPersonalData(
        request.user.orgId,
        request.user.sub,
        request.params.id,
        request
      );
      return { data: bundle };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/customers/:id/anonymize',
    { preHandler: [authorize(['OWNER', 'ADMIN'])], schema: {
      tags: ['privacy'],
      summary: 'Anonymise customer identifiers',
      security: secureOperation,
      params: idParamsSchema,
      response: { 200: dataResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema },
    } },
    async (request) => {
      const result = await anonymizeCustomerData(
        request.user.orgId,
        request.user.sub,
        request.params.id,
        request
      );
      return { data: result };
    }
  );
}
