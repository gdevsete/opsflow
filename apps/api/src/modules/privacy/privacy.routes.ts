import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import {
  anonymizeCustomerData,
  exportCustomerPersonalData,
  listAuditLogs,
} from './privacy.service.js';

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/audit-logs',
    { preHandler: [authorize(['OWNER', 'ADMIN'])] },
    async (request) => {
      const logs = await listAuditLogs(request.user.orgId);
      return { data: logs };
    }
  );

  app.get<{ Params: { id: string } }>(
    '/customers/:id/export',
    { preHandler: [authorize(['OWNER', 'ADMIN'])] },
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
    { preHandler: [authorize(['OWNER', 'ADMIN'])] },
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
