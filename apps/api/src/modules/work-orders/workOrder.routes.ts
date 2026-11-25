import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { createWorkOrderSchema, updateWorkOrderStatusSchema } from './workOrder.schema.js';
import {
  createWorkOrder,
  listWorkOrders,
  updateWorkOrderStatus,
} from './workOrder.service.js';

export async function workOrderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const orders = await listWorkOrders(request.user.orgId);
    return { data: orders };
  });

  app.post(
    '/',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])] },
    async (request, reply) => {
      const input = createWorkOrderSchema.parse(request.body);
      const order = await createWorkOrder(request.user.orgId, request.user.sub, input, request);
      return reply.status(201).send({ data: order });
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/:id/status',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])] },
    async (request) => {
      const input = updateWorkOrderStatusSchema.parse(request.body);
      const order = await updateWorkOrderStatus(
        request.user.orgId,
        request.user.sub,
        request.params.id,
        input,
        request
      );
      return { data: order };
    }
  );
}
