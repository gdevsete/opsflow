import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { createInventoryItemSchema, stockAdjustmentSchema } from './inventory.schema.js';
import {
  adjustInventoryStock,
  createInventoryItem,
  listInventoryItems,
} from './inventory.service.js';

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const items = await listInventoryItems(request.user.orgId);
    return { data: items };
  });

  app.post(
    '/',
    { preHandler: [authorize(['OWNER', 'ADMIN'])] },
    async (request, reply) => {
      const input = createInventoryItemSchema.parse(request.body);
      const item = await createInventoryItem(request.user.orgId, request.user.sub, input, request);
      return reply.status(201).send({ data: item });
    }
  );

  app.post<{ Params: { id: string } }>(
    '/:id/movements',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])] },
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
