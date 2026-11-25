import { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from './auth.schema.js';
import { authenticateUser, registerOrganizationAndOwner } from './auth.service.js';
import { authenticate } from '../../middlewares/authenticate.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (request, reply) => {
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

  app.post('/login', async (request, reply) => {
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

  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    return { user: request.user };
  });
}
