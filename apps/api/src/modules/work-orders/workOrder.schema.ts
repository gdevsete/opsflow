import { z } from 'zod';

export const createWorkOrderSchema = z.object({
  customerId: z.string().uuid(),
  assignedTo: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  laborCostCents: z.number().int().min(0).default(0),
  scheduledFor: z.string().datetime().optional().nullable(),
  parts: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .default([]),
});

export const updateWorkOrderStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED']),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderStatusInput = z.infer<typeof updateWorkOrderStatusSchema>;
