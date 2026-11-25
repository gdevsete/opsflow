import { z } from 'zod';

export const registerSchema = z.object({
  organizationName: z.string().min(2).max(150),
  fullName: z.string().min(2).max(150),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  acceptedPrivacyPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Privacy policy acceptance is mandatory under LGPD/GDPR.' }),
  }),
  policyVersion: z.string().default('2026.1'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
