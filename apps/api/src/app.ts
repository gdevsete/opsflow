import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
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
    origin: env.CORS_ORIGIN,
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

  app.get('/health', async () => ({
    status: 'ok',
    service: 'opsflow-api',
    timestamp: new Date().toISOString(),
  }));

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(customerRoutes, { prefix: '/api/v1/customers' });
  app.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  app.register(workOrderRoutes, { prefix: '/api/v1/work-orders' });
  app.register(privacyRoutes, { prefix: '/api/v1/privacy' });

  return app;
}
