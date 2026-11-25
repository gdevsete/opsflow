import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { adminPool, closeDatabasePools } from '../../src/config/database.js';

describe('LGPD & GDPR Compliance Controls', () => {
  const app = buildApp();
  let token = '';
  let orgId = '';

  beforeAll(async () => {
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        organizationName: 'Galway Tech Services',
        fullName: 'Liam Byrne',
        email: `liam_${Date.now()}@galwaytech.ie`,
        password: 'Password123',
        acceptedPrivacyPolicy: true,
      },
    });
    const body = res.json();
    token = body.token;
    orgId = body.organization.id;
  });

  afterAll(async () => {
    if (orgId) {
      await adminPool.query('ALTER TABLE audit_logs DISABLE TRIGGER trg_immutable_audit_logs');
      await adminPool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
      await adminPool.query('ALTER TABLE audit_logs ENABLE TRIGGER trg_immutable_audit_logs');
    }
    await app.close();
    await closeDatabasePools();
  });

  it('exports decrypted PII and irreversibly anonymizes on erasure request', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Maria Silva',
        email: 'maria.silva@example.com',
        phone: '+353 87 000 1122',
        document: '98765432100',
        addressLine: '14 Grand Canal Dock, Dublin',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const customerId = createRes.json().data.id;

    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/privacy/customers/${customerId}/export`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.json().data.subject.taxDocument).toBe('98765432100');

    const anonRes = await app.inject({
      method: 'POST',
      url: `/api/v1/privacy/customers/${customerId}/anonymize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(anonRes.statusCode).toBe(200);
    expect(anonRes.json().data.anonymized).toBe(true);

    const exportAfterAnon = await app.inject({
      method: 'GET',
      url: `/api/v1/privacy/customers/${customerId}/export`,
      headers: { authorization: `Bearer ${token}` },
    });
    const subjectAfter = exportAfterAnon.json().data.subject;
    expect(subjectAfter.taxDocument).toBeNull();
    expect(subjectAfter.email).toBeNull();
    expect(subjectAfter.name).toContain('ANONYMIZED_SUBJECT_');

    await expect(
      adminPool.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId])
    ).rejects.toThrow(/immutable/i);
  });
});