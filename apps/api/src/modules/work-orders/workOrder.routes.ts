import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { createWorkOrderSchema, updateWorkOrderStatusSchema } from './workOrder.schema.js';
import {
  createWorkOrder,
  listWorkOrders,
  updateWorkOrderStatus,
} from './workOrder.service.js';
import { dataResponseSchema, errorResponseSchema, idParamsSchema, jsonSchema, secureOperation } from '../../openapi.js';

export async function workOrderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', { schema: {
    tags: ['work-orders'],
    summary: 'List work orders for the current tenant',
    security: secureOperation,
    response: { 200: dataResponseSchema, 401: errorResponseSchema },
  } }, async (request) => {
    const orders = await listWorkOrders(request.user.orgId);
    return { data: orders };
  });

  app.post(
    '/',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])], schema: {
      tags: ['work-orders'],
      summary: 'Create a work order and reserve inventory parts',
      security: secureOperation,
      body: jsonSchema(createWorkOrderSchema, 'CreateWorkOrderRequest'),
      response: { 201: dataResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema },
    } },
    async (request, reply) => {
      const input = createWorkOrderSchema.parse(request.body);
      const order = await createWorkOrder(request.user.orgId, request.user.sub, input, request);
      return reply.status(201).send({ data: order });
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/:id/status',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])], schema: {
      tags: ['work-orders'],
      summary: 'Update a work-order status',
      security: secureOperation,
      params: idParamsSchema,
      body: jsonSchema(updateWorkOrderStatusSchema, 'UpdateWorkOrderStatusRequest'),
      response: { 200: dataResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema },
    } },
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
