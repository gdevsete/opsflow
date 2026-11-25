import crypto from 'node:crypto';
import { adminPool } from '../../config/database.js';
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
  const client = await adminPool.connect();
  try {
    await client.query('BEGIN');

    const slug = slugify(input.organizationName);
    const orgResult = await client.query<{ id: string; name: string; slug: string }>(
      `INSERT INTO organizations (name, slug)
       VALUES ($1, $2)
       RETURNING id, name, slug`,
      [input.organizationName, slug]
    );
    const org = orgResult.rows[0]!;

    const passwordHash = await hashPassword(input.password);
    const userResult = await client.query<{
      id: string;
      full_name: string;
      email: string;
      role: UserRole;
    }>(
      `INSERT INTO users (organization_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'OWNER')
       RETURNING id, full_name, email, role`,
      [org.id, input.fullName, input.email.toLowerCase(), passwordHash]
    );
    const user = userResult.rows[0]!;

    await client.query(
      `INSERT INTO consent_records (
        organization_id, subject_type, subject_id, purpose, policy_version, granted, ip_address, user_agent
      ) VALUES ($1, 'USER', $2, 'ACCOUNT_PROVISIONING_AND_TERMS', $3, TRUE, $4, $5)`,
      [org.id, user.id, input.policyVersion, meta.ip ?? null, meta.userAgent ?? null]
    );

    await client.query(
      `INSERT INTO audit_logs (
        organization_id, actor_user_id, action, resource_type, resource_id, ip_address, user_agent, metadata
      ) VALUES ($1, $2, 'ORGANIZATION_CREATED', 'ORGANIZATION', $1, $3, $4, $5::jsonb)`,
      [org.id, user.id, meta.ip ?? null, meta.userAgent ?? null, JSON.stringify({ slug })]
    );

    await client.query('COMMIT');

    return {
      organization: org,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateUser(
  input: LoginInput,
  meta: { ip?: string; userAgent?: string }
) {
  const client = await adminPool.connect();
  try {
    const result = await client.query<{
      id: string;
      organization_id: string;
      full_name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      is_active: boolean;
      org_name: string;
    }>(
      `SELECT u.id, u.organization_id, u.full_name, u.email, u.password_hash, u.role, u.is_active,
              o.name AS org_name
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1
       LIMIT 1`,
      [input.email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(user.password_hash, input.password);
    if (!valid) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    await client.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    await client.query(
      `INSERT INTO audit_logs (
        organization_id, actor_user_id, action, resource_type, resource_id, ip_address, user_agent
      ) VALUES ($1, $2, 'USER_LOGIN', 'USER', $2, $3, $4)`,
      [user.organization_id, user.id, meta.ip ?? null, meta.userAgent ?? null]
    );

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
  } finally {
    client.release();
  }
}
