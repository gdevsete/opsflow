import { zodToJsonSchema } from 'zod-to-json-schema';
import { z, ZodTypeAny } from 'zod';

export function jsonSchema(schema: ZodTypeAny, name: string): Record<string, unknown> {
  const converted = zodToJsonSchema(schema, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;

  delete converted.$schema;
  converted.title = name;
  return converted;
}

export const idParamsSchema = jsonSchema(
  z.object({ id: z.string().uuid().describe('Resource UUID') }),
  'ResourceIdParams'
);

export const errorResponseSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', example: 'https://opsflow.dev/errors/validation-error' },
    title: { type: 'string', example: 'Request validation failed' },
    status: { type: 'integer', example: 400 },
    code: { type: 'string', example: 'VALIDATION_ERROR' },
    instance: { type: 'string', example: '/api/v1/customers' },
    errors: { type: 'object', additionalProperties: true },
  },
  required: ['title', 'status', 'code', 'instance'],
} as const;

export const dataResponseSchema = {
  type: 'object',
  properties: { data: {} },
  required: ['data'],
} as const;

export const authResponseSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example' },
    organization: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', example: '11111111-1111-4111-8111-111111111111' },
        name: { type: 'string', example: 'Example Field Services' },
        slug: { type: 'string', example: 'example-field-services-a1b2c3' },
      },
      required: ['id', 'name', 'slug'],
    },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', example: '22222222-2222-4222-8222-222222222222' },
        fullName: { type: 'string', example: 'Example Operator' },
        email: { type: 'string', format: 'email', example: 'operator@example.ie' },
        role: { type: 'string', enum: ['OWNER', 'ADMIN', 'TECHNICIAN', 'VIEWER'], example: 'OWNER' },
      },
      required: ['id', 'fullName', 'email', 'role'],
    },
  },
  required: ['token', 'user'],
} as const;

export const secureOperation = [{ bearerAuth: [] }];
