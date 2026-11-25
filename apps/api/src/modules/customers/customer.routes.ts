import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { createCustomerSchema, updateCustomerSchema } from './customer.schema.js';
import { createCustomer, listCustomers, updateCustomer } from './customer.service.js';
import { dataResponseSchema, errorResponseSchema, idParamsSchema, jsonSchema, secureOperation } from '../../openapi.js';

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', { schema: {
    tags: ['customers'],
    summary: 'List customers for the current tenant',
    security: secureOperation,
    response: { 200: dataResponseSchema, 401: errorResponseSchema },
  } }, async (request) => {
    const customers = await listCustomers(request.user.orgId);
    return { data: customers };
  });

  app.post(
    '/',
    { preHandler: [authorize(['OWNER', 'ADMIN', 'TECHNICIAN'])], schema: {
      tags: ['customers'],
      summary: 'Create a customer',
      security: secureOperation,
      body: jsonSchema(createCustomerSchema, 'CreateCustomerRequest'),
      response: { 201: dataResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema },
    } },
    async (request, reply) => {
      const input = createCustomerSchema.parse(request.body);
      const customer = await createCustomer(request.user.orgId, request.user.sub, input, request);
      return reply.status(201).send({ data: customer });
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authorize(['OWNER', 'ADMIN'])], schema: {
      tags: ['customers'],
      summary: 'Update a customer',
      security: secureOperation,
      params: idParamsSchema,
      body: jsonSchema(updateCustomerSchema, 'UpdateCustomerRequest'),
      response: { 200: dataResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema },
    } },
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
