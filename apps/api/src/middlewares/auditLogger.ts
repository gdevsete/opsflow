import { FastifyRequest } from 'fastify';
import { PoolClient } from 'pg';

export interface AuditEntryInput {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  request?: FastifyRequest;
}

/**
 * Writes an immutable audit trail entry compliant with LGPD Art. 37 & GDPR Art. 30.
 */
export async function recordAuditLog(client: PoolClient, entry: AuditEntryInput): Promise<void> {
  const ipAddress = entry.request?.ip ?? null;
  const userAgent = entry.request?.headers['user-agent'] ?? null;

  await client.query(
    `INSERT INTO audit_logs (
      organization_id,
      actor_user_id,
      action,
      resource_type,
      resource_id,
      ip_address,
      user_agent,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      entry.organizationId,
      entry.actorUserId,
      entry.action,
      entry.resourceType,
      entry.resourceId ?? null,
      ipAddress,
      userAgent,
      JSON.stringify(entry.metadata ?? {}),
    ]
  );
}
