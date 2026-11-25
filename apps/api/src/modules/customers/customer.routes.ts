import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { createCustomerSchema, updateCustomerSchema } from './customer.schema.js';
import { createCustomer, listCustomers, updateCustomer } from './customer.service.js';

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const customers = await listCustomers(request.user.orgId);
    return { data: customers };
  });

  app.post(
    '/',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])] },
    async (request, reply) => {
      const input = createCustomerSchema.parse(request.body);
      const customer = await createCustomer(request.user.orgId, request.user.sub, input, request);
      return reply.status(201).send({ data: customer });
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authorize(['OWNER', 'ADMIN'])] },
    async (request) => {
      const input = updateCustomerSchema.parse(request.body);
      const customer = await updateCustomer(
        request.user.orgId,
        request.user.sub,
        request.params.id,
        input,
        request
      );
      return { data: customer };
    }
  );
}
