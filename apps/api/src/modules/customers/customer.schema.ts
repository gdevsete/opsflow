import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  document: z.string().min(5).max(32).optional().or(z.literal('')),
  addressLine: z.string().max(500).optional().or(z.literal('')),
  consentGranted: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
