import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/appError.js';

export type UserRole = 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'VIEWER';

export interface AuthUserPayload {
  sub: string;
  orgId: string;
  role: UserRole;
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError('Authentication required or token expired.', 401, 'UNAUTHORIZED');
  }
}

export function authorize(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      throw new AppError('Insufficient permissions for this operation.', 403, 'FORBIDDEN');
    }
  };
}
