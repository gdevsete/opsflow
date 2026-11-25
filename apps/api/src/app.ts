import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { globalErrorHandler } from './middlewares/errorHandler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { customerRoutes } from './modules/customers/customer.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { workOrderRoutes } from './modules/work-orders/workOrder.routes.js';
import { privacyRoutes } from './modules/privacy/privacy.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  app.register(helmet);
  app.register(cors, {
    origin: (origin, callback) => {
      const allowedOrigins = env.CORS_ORIGIN.split(',').map((value) => value.trim());
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  });
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });
  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '8h' },
  });

  app.setErrorHandler(globalErrorHandler);

  app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'OpsFlow API',
        description: 'Tenant-scoped field operations and privacy-support API.',
        version: '1.0.0',
      },
      servers: [{ url: '/', description: 'Current deployment' }],
      tags: [
        { name: 'health', description: 'Service health' },
        { name: 'auth', description: 'Registration and authentication' },
        { name: 'customers', description: 'Customer records' },
        { name: 'inventory', description: 'Inventory and stock movements' },
        { name: 'work-orders', description: 'Work-order operations' },
        { name: 'privacy', description: 'Privacy-support workflows and audit logs' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  app.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            service: { type: 'string', example: 'opsflow-api' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['status', 'service', 'timestamp'],
        },
      },
    },
  }, async () => ({
    status: 'ok',
    service: 'opsflow-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/openapi.json', {
    schema: { hide: true },
  }, async () => app.swagger());

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(customerRoutes, { prefix: '/api/v1/customers' });
  app.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  app.register(workOrderRoutes, { prefix: '/api/v1/work-orders' });
  app.register(privacyRoutes, { prefix: '/api/v1/privacy' });

  return app;
}
