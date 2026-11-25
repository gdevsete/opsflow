import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { createInventoryItemSchema, stockAdjustmentSchema } from './inventory.schema.js';
import {
  adjustInventoryStock,
  createInventoryItem,
  listInventoryItems,
} from './inventory.service.js';
import { dataResponseSchema, errorResponseSchema, idParamsSchema, jsonSchema, secureOperation } from '../../openapi.js';

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', { schema: {
    tags: ['inventory'],
    summary: 'List inventory items for the current tenant',
    security: secureOperation,
    response: { 200: dataResponseSchema, 401: errorResponseSchema },
  } }, async (request) => {
    const items = await listInventoryItems(request.user.orgId);
    return { data: items };
  });

  app.post(
    '/',
    { preHandler: [authorize(['OWNER', 'ADMIN'])], schema: {
      tags: ['inventory'],
      summary: 'Create an inventory item',
      security: secureOperation,
      body: jsonSchema(createInventoryItemSchema, 'CreateInventoryItemRequest'),
      response: { 201: dataResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema },
    } },
    async (request, reply) => {
      const input = createInventoryItemSchema.parse(request.body);
      const item = await createInventoryItem(request.user.orgId, request.user.sub, input, request);
      return reply.status(201).send({ data: item });
    }
  );

  app.post<{ Params: { id: string } }>(
    '/:id/movements',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])], schema: {
      tags: ['inventory'],
      summary: 'Record an inventory stock movement',
      security: secureOperation,
      params: idParamsSchema,
      body: jsonSchema(stockAdjustmentSchema, 'StockAdjustmentRequest'),
      response: { 200: dataResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema },
    } },
    async (request) => {
      const input = stockAdjustmentSchema.parse(request.body);
      const item = await adjustInventoryStock(
        request.user.orgId,
        request.user.sub,
        request.params.id,
        input,
        request
      );
      return { data: item };
    }
  );
}
