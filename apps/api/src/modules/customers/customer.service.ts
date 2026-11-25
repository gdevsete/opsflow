import { FastifyRequest } from 'fastify';
import { withTenantContext } from '../../config/database.js';
import { computeBlindIndex, encryptPii } from '../../utils/crypto.js';
import { recordAuditLog } from '../../middlewares/auditLogger.js';
import { AppError } from '../../utils/appError.js';
import { CreateCustomerInput, UpdateCustomerInput } from './customer.schema.js';

export async function listCustomers(tenantId: string) {
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, name, email, phone, address_line,
              (document_encrypted IS NOT NULL) AS has_document,
              is_anonymized, anonymized_at, created_at
       FROM customers
       ORDER BY created_at DESC`
    );
    return result.rows;
  });
}

export async function createCustomer(
  tenantId: string,
  actorUserId: string,
  input: CreateCustomerInput,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const cleanDoc = input.document?.trim() || null;
    const encryptedDoc = cleanDoc ? encryptPii(cleanDoc) : null;
    const docHash = cleanDoc ? computeBlindIndex(cleanDoc) : null;

    if (docHash) {
      const existing = await client.query(
        `SELECT id FROM customers WHERE document_hash = $1 AND is_anonymized = FALSE LIMIT 1`,
        [docHash]
      );
      if (existing.rows.length > 0) {
        throw new AppError('A customer with this tax document already exists.', 409, 'DUPLICATE_CUSTOMER');
      }
    }

    const result = await client.query(
      `INSERT INTO customers (
        organization_id, name, email, phone, document_encrypted, document_hash, address_line
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, phone, address_line, is_anonymized, created_at`,
      [
        tenantId,
        input.name.trim(),
        input.email?.trim() || null,
        input.phone?.trim() || null,
        encryptedDoc,
        docHash,
        input.addressLine?.trim() || null,
      ]
    );
    const customer = result.rows[0]!;

    await client.query(
      `INSERT INTO consent_records (
        organization_id, subject_type, subject_id, purpose, policy_version, granted, ip_address, user_agent
      ) VALUES ($1, 'CUSTOMER', $2, 'SERVICE_DELIVERY_AND_BILLING', '2026.1', $3, $4, $5)`,
      [tenantId, customer.id, input.consentGranted, request.ip, request.headers['user-agent'] ?? null]
    );

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'CUSTOMER_CREATED',
      resourceType: 'CUSTOMER',
      resourceId: customer.id,
      request,
    });

    return customer;
  });
}

export async function updateCustomer(
  tenantId: string,
  actorUserId: string,
  customerId: string,
  input: UpdateCustomerInput,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const current = await client.query<{ is_anonymized: boolean }>(
      `SELECT is_anonymized FROM customers WHERE id = $1`,
      [customerId]
    );
    const row = current.rows[0];
    if (!row) {
      throw new AppError('Customer not found.', 404, 'NOT_FOUND');
    }
    if (row.is_anonymized) {
      throw new AppError(
        'Anonymized customer records cannot be modified (LGPD Art. 18).',
        422,
        'ANONYMIZED_RECORD_LOCKED'
      );
    }

    const cleanDoc = input.document?.trim();
    const encryptedDoc = cleanDoc ? encryptPii(cleanDoc) : undefined;
    const docHash = cleanDoc ? computeBlindIndex(cleanDoc) : undefined;

    const result = await client.query(
      `UPDATE customers
       SET name = COALESCE($2, name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           address_line = COALESCE($5, address_line),
           document_encrypted = COALESCE($6, document_encrypted),
           document_hash = COALESCE($7, document_hash),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, phone, address_line, is_anonymized, updated_at`,
      [
        customerId,
        input.name?.trim() ?? null,
        input.email !== undefined ? input.email.trim() || null : null,
        input.phone !== undefined ? input.phone.trim() || null : null,
        input.addressLine !== undefined ? input.addressLine.trim() || null : null,
        encryptedDoc ?? null,
        docHash ?? null,
      ]
    );

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'CUSTOMER_UPDATED',
      resourceType: 'CUSTOMER',
      resourceId: customerId,
      request,
    });

    return result.rows[0];
  });
}
