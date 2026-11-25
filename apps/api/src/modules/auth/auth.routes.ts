import { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from './auth.schema.js';
import { authenticateUser, registerOrganizationAndOwner } from './auth.service.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authResponseSchema, errorResponseSchema, jsonSchema, secureOperation } from '../../openapi.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register an organisation and owner account',
      body: jsonSchema(registerSchema, 'RegisterRequest'),
      response: { 201: authResponseSchema, 400: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const created = await registerOrganizationAndOwner(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const token = app.jwt.sign({
      sub: created.user.id,
      orgId: created.organization.id,
      role: created.user.role,
      email: created.user.email,
    });

    return reply.status(201).send({
      token,
      ...created,
    });
  });

  app.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'Authenticate an operator',
      body: jsonSchema(loginSchema, 'LoginRequest'),
      response: { 200: authResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema },
    },
  }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const authResult = await authenticateUser(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const token = app.jwt.sign({
      sub: authResult.user.id,
      orgId: authResult.user.organizationId,
      role: authResult.user.role,
      email: authResult.user.email,
    });

    return reply.send({
      token,
      ...authResult,
    });
  });

  app.get('/me', { preHandler: [authenticate], schema: {
    tags: ['auth'],
    summary: 'Return the current authenticated user',
    security: secureOperation,
    response: { 200: { ...authResponseSchema, properties: { user: authResponseSchema.properties.user }, required: ['user'] }, 401: errorResponseSchema },
  } }, async (request) => {
    return { user: request.user };
  });
}
