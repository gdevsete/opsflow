import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError.js';

export function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof ZodError) {
    reply.status(400).send({
      type: 'https://opsflow.dev/errors/validation-error',
      title: 'Request validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      instance: request.url,
      errors: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      type: `https://opsflow.dev/errors/${error.code.toLowerCase()}`,
      title: error.message,
      status: error.statusCode,
      code: error.code,
      instance: request.url,
      details: error.details,
    });
    return;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode === 429) {
    reply.status(429).send({
      type: 'https://opsflow.dev/errors/rate-limit-exceeded',
      title: 'Too many requests. Please try again later.',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      instance: request.url,
    });
    return;
  }

  request.log.error(error);

  reply.status(500).send({
    type: 'https://opsflow.dev/errors/internal-server-error',
    title: 'An unexpected internal error occurred.',
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    instance: request.url,
  });
}
