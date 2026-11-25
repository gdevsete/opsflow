import crypto from 'node:crypto';
import { appPool } from '../../config/database.js';
import { hashPassword, verifyPassword } from '../../utils/crypto.js';
import { AppError } from '../../utils/appError.js';
import { LoginInput, RegisterInput } from './auth.schema.js';
import { UserRole } from '../../middlewares/authenticate.js';

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

export async function registerOrganizationAndOwner(
  input: RegisterInput,
  meta: { ip?: string; userAgent?: string }
) {
  const slug = slugify(input.organizationName);
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await appPool.query<{
      organization_id: string;
      organization_name: string;
      organization_slug: string;
      user_id: string;
      full_name: string;
      email: string;
      role: UserRole;
    }>(
      `SELECT * FROM register_organization_and_owner($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.organizationName,
        slug,
        input.fullName,
        input.email.toLowerCase(),
        passwordHash,
        input.policyVersion,
        meta.ip ?? null,
        meta.userAgent ?? null,
      ]
    );
    const created = result.rows[0]!;

    return {
      organization: {
        id: created.organization_id,
        name: created.organization_name,
        slug: created.organization_slug,
      },
      user: {
        id: created.user_id,
        fullName: created.full_name,
        email: created.email,
        role: created.role,
      },
    };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT');
    }
    throw error;
  }
}

export async function authenticateUser(
  input: LoginInput,
  meta: { ip?: string; userAgent?: string }
) {
  const result = await appPool.query<{
      id: string;
      organization_id: string;
      full_name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      is_active: boolean;
      org_name: string;
    }>(`SELECT * FROM find_user_for_login($1)`, [input.email.toLowerCase()]);

    const user = result.rows[0];
    if (!user || !user.is_active) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(user.password_hash, input.password);
    if (!valid) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    await appPool.query(`SELECT record_user_login($1, $2, $3, $4)`, [
      user.organization_id,
      user.id,
      meta.ip ?? null,
      meta.userAgent ?? null,
    ]);

  return {
    user: {
      id: user.id,
      organizationId: user.organization_id,
      organizationName: user.org_name,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}
