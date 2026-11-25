import { FastifyRequest } from 'fastify';
import { withTenantContext } from '../../config/database.js';
import { decryptPii } from '../../utils/crypto.js';
import { recordAuditLog } from '../../middlewares/auditLogger.js';
import { AppError } from '../../utils/appError.js';

/**
 * LGPD Art. 18, V & GDPR Art. 20: Data Portability Export for a Data Subject.
 */
export async function exportCustomerPersonalData(
  tenantId: string,
  actorUserId: string,
  customerId: string,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const customerRes = await client.query<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      document_encrypted: Buffer | null;
      address_line: string | null;
      is_anonymized: boolean;
      created_at: string;
    }>(
      `SELECT id, name, email, phone, document_encrypted, address_line, is_anonymized, created_at
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    const customer = customerRes.rows[0];
    if (!customer) {
      throw new AppError('Customer not found.', 404, 'NOT_FOUND');
    }

    const decryptedDocument =
      customer.document_encrypted && !customer.is_anonymized
        ? decryptPii(customer.document_encrypted)
        : null;

    const consentsRes = await client.query(
      `SELECT purpose, policy_version, granted, recorded_at
       FROM consent_records
       WHERE subject_type = 'CUSTOMER' AND subject_id = $1
       ORDER BY recorded_at DESC`,
      [customerId]
    );

    const workOrdersRes = await client.query(
      `SELECT order_number, title, status, total_amount_cents, created_at, completed_at
       FROM work_orders
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'LGPD_DATA_PORTABILITY_EXPORT',
      resourceType: 'CUSTOMER',
      resourceId: customerId,
      metadata: { decryptedDocumentIncluded: Boolean(decryptedDocument) },
      request,
    });

    return {
      exportedAt: new Date().toISOString(),
      legalBasis: 'LGPD Art. 18, V / GDPR Art. 20 - Data Portability',
      subject: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        taxDocument: decryptedDocument,
        addressLine: customer.address_line,
        isAnonymized: customer.is_anonymized,
        createdAt: customer.created_at,
      },
      consentHistory: consentsRes.rows,
      serviceHistory: workOrdersRes.rows,
    };
  });
}

/**
 * LGPD Art. 18, VI & GDPR Art. 17: Irreversible PII Anonymization while preserving fiscal work order integrity.
 */
export async function anonymizeCustomerData(
  tenantId: string,
  actorUserId: string,
  customerId: string,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const check = await client.query<{ is_anonymized: boolean }>(
      `SELECT is_anonymized FROM customers WHERE id = $1 FOR UPDATE`,
      [customerId]
    );
    const customer = check.rows[0];
    if (!customer) {
      throw new AppError('Customer not found.', 404, 'NOT_FOUND');
    }
    if (customer.is_anonymized) {
      throw new AppError('Customer data has already been anonymized.', 409, 'ALREADY_ANONYMIZED');
    }

    const anonymizedLabel = `ANONYMIZED_SUBJECT_${customerId.slice(0, 8).toUpperCase()}`;

    await client.query(
      `UPDATE customers
       SET name = $2,
           email = NULL,
           phone = NULL,
           document_encrypted = NULL,
           document_hash = NULL,
           address_line = NULL,
           is_anonymized = TRUE,
           anonymized_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [customerId, anonymizedLabel]
    );

    await client.query(
      `INSERT INTO consent_records (
        organization_id, subject_type, subject_id, purpose, policy_version, granted, ip_address, user_agent
      ) VALUES ($1, 'CUSTOMER', $2, 'ERASURE_AND_ANONYMIZATION_REQUEST', '2026.1', FALSE, $3, $4)`,
      [tenantId, customerId, request.ip, request.headers['user-agent'] ?? null]
    );

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'LGPD_CUSTOMER_ANONYMIZED',
      resourceType: 'CUSTOMER',
      resourceId: customerId,
      metadata: { anonymizedLabel },
      request,
    });

    return {
      customerId,
      anonymized: true,
      anonymizedAt: new Date().toISOString(),
    };
  });
}

export async function listAuditLogs(tenantId: string) {
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT al.id, al.action, al.resource_type, al.resource_id,
              al.ip_address, al.metadata, al.created_at,
              u.full_name AS actor_name, u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       ORDER BY al.created_at DESC
       LIMIT 100`
    );
    return result.rows;
  });
}
