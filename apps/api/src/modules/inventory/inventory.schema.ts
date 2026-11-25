import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  sku: z.string().min(2).max(64),
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional(),
  unitCostCents: z.number().int().min(0),
  unitPriceCents: z.number().int().min(0),
  initialQuantity: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(5),
});

export const stockAdjustmentSchema = z.object({
  movementType: z.enum(['INBOUND', 'OUTBOUND', 'ADJUSTMENT']),
  quantityDelta: z.number().int().refine((v) => v !== 0, 'Quantity delta cannot be zero'),
  notes: z.string().max(500).optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
