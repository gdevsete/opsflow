import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { adminPool, closeDatabasePools } from '../../src/config/database.js';

describe('Multi-Tenant Row Level Security (RLS) Isolation', () => {
  const app = buildApp();
  let tokenTenantA = '';
  let tokenTenantB = '';
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    await app.ready();

    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        organizationName: 'Dublin Precision Engineering Ltd',
        fullName: 'Connor Murphy',
        email: `connor_${Date.now()}@dublinprecision.ie`,
        password: 'Password123',
        acceptedPrivacyPolicy: true,
      },
    });
    const bodyA = resA.json();
    tokenTenantA = bodyA.token;
    createdOrgIds.push(bodyA.organization.id);

    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        organizationName: 'Cork Industrial Maintenance',
        fullName: 'Aoife Kelly',
        email: `aoife_${Date.now()}@corkmaint.ie`,
        password: 'Password123',
        acceptedPrivacyPolicy: true,
      },
    });
    const bodyB = resB.json();
    tokenTenantB = bodyB.token;
    createdOrgIds.push(bodyB.organization.id);
  });

  afterAll(async () => {
    await adminPool.query('ALTER TABLE audit_logs DISABLE TRIGGER trg_immutable_audit_logs');
    for (const orgId of createdOrgIds) {
      await adminPool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
    await adminPool.query('ALTER TABLE audit_logs ENABLE TRIGGER trg_immutable_audit_logs');
    await app.close();
    await closeDatabasePools();
  });

  it('prevents Tenant B from reading customers created by Tenant A', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Confidential Client A',
        email: 'clienta@example.ie',
        document: '12345678901',
      },
    });
    expect(createRes.statusCode).toBe(201);

    const listTenantB = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: { authorization: `Bearer ${tokenTenantB}` },
    });

    expect(listTenantB.statusCode).toBe(200);
    expect(listTenantB.json().data).toHaveLength(0);
  });
});