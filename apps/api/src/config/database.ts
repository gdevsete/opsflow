import { Pool, PoolClient } from 'pg';
import { env } from './env.js';

export const appPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

export const adminPool = new Pool({
  connectionString: env.DATABASE_ADMIN_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Executes queries inside a transaction scoped strictly to a single tenant via PostgreSQL RLS.
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!UUID_REGEX.test(tenantId)) {
    throw new Error('Invalid tenant identifier format');
  }

  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabasePools(): Promise<void> {
  await Promise.all([appPool.end(), adminPool.end()]);
}
