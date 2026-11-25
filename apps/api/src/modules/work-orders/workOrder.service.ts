import { FastifyRequest } from 'fastify';
import { withTenantContext } from '../../config/database.js';
import { recordAuditLog } from '../../middlewares/auditLogger.js';
import { AppError } from '../../utils/appError.js';
import { CreateWorkOrderInput, UpdateWorkOrderStatusInput } from './workOrder.schema.js';

export function calculateWorkOrderTotal(
  laborCostCents: number,
  parts: Array<{ quantity: number; unitPriceCents: number }>
): number {
  const partsSubtotal = parts.reduce((acc, item) => acc + item.quantity * item.unitPriceCents, 0);
  return laborCostCents + partsSubtotal;
}

export async function listWorkOrders(tenantId: string) {
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT wo.id, wo.order_number, wo.title, wo.status, wo.priority,
              wo.labor_cost_cents, wo.total_amount_cents, wo.scheduled_for, wo.completed_at, wo.created_at,
              c.id AS customer_id, c.name AS customer_name, c.is_anonymized AS customer_anonymized,
              u.full_name AS technician_name
       FROM work_orders wo
       JOIN customers c ON c.id = wo.customer_id
       LEFT JOIN users u ON u.id = wo.assigned_to
       ORDER BY wo.created_at DESC`
    );
    return result.rows;
  });
}

export async function createWorkOrder(
  tenantId: string,
  actorUserId: string,
  input: CreateWorkOrderInput,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const customerCheck = await client.query<{ is_anonymized: boolean }>(
      `SELECT is_anonymized FROM customers WHERE id = $1`,
      [input.customerId]
    );
    const customer = customerCheck.rows[0];
    if (!customer) {
      throw new AppError('Customer not found in this organization.', 404, 'CUSTOMER_NOT_FOUND');
    }
    if (customer.is_anonymized) {
      throw new AppError('Cannot open a work order for an anonymized customer.', 422, 'CUSTOMER_ANONYMIZED');
    }

    const resolvedParts: Array<{
      inventoryItemId: string;
      quantity: number;
      unitPriceCents: number;
      sku: string;
    }> = [];

    for (const part of input.parts) {
      const stockRes = await client.query<{
        id: string;
        sku: string;
        unit_price_cents: number;
        quantity_on_hand: number;
      }>(
        `SELECT id, sku, unit_price_cents, quantity_on_hand
         FROM inventory_items
         WHERE id = $1
         FOR UPDATE`,
        [part.inventoryItemId]
      );
      const stockItem = stockRes.rows[0];
      if (!stockItem) {
        throw new AppError(`Inventory item ${part.inventoryItemId} not found.`, 404, 'ITEM_NOT_FOUND');
      }
      if (stockItem.quantity_on_hand < part.quantity) {
        throw new AppError(
          `Insufficient stock for SKU ${stockItem.sku}. Available: ${stockItem.quantity_on_hand}`,
          422,
          'INSUFFICIENT_STOCK'
        );
      }

      resolvedParts.push({
        inventoryItemId: stockItem.id,
        quantity: part.quantity,
        unitPriceCents: stockItem.unit_price_cents,
        sku: stockItem.sku,
      });
    }

    const totalAmountCents = calculateWorkOrderTotal(input.laborCostCents, resolvedParts);

    const woResult = await client.query(
      `INSERT INTO work_orders (
        organization_id, customer_id, assigned_to, title, description, priority,
        labor_cost_cents, total_amount_cents, scheduled_for
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId,
        input.customerId,
        input.assignedTo ?? null,
        input.title.trim(),
        input.description?.trim() ?? null,
        input.priority,
        input.laborCostCents,
        totalAmountCents,
        input.scheduledFor ?? null,
      ]
    );
    const workOrder = woResult.rows[0]!;

    for (const part of resolvedParts) {
      await client.query(
        `INSERT INTO work_order_items (
          organization_id, work_order_id, inventory_item_id, quantity, unit_price_cents
        ) VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, workOrder.id, part.inventoryItemId, part.quantity, part.unitPriceCents]
      );

      await client.query(
        `UPDATE inventory_items
         SET quantity_on_hand = quantity_on_hand - $2, updated_at = NOW()
         WHERE id = $1`,
        [part.inventoryItemId, part.quantity]
      );

      await client.query(
        `INSERT INTO stock_movements (
          organization_id, inventory_item_id, work_order_id, performed_by, movement_type, quantity_delta, notes
        ) VALUES ($1, $2, $3, $4, 'WORK_ORDER_USAGE', $5, $6)`,
        [
          tenantId,
          part.inventoryItemId,
          workOrder.id,
          actorUserId,
          -part.quantity,
          `Allocated to Work Order #${workOrder.order_number}`,
        ]
      );
    }

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'WORK_ORDER_CREATED',
      resourceType: 'WORK_ORDER',
      resourceId: workOrder.id,
      metadata: { orderNumber: workOrder.order_number, totalAmountCents },
      request,
    });

    return workOrder;
  });
}

export async function updateWorkOrderStatus(
  tenantId: string,
  actorUserId: string,
  workOrderId: string,
  input: UpdateWorkOrderStatusInput,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const completedAtClause = input.status === 'COMPLETED' ? ', completed_at = NOW()' : '';

    const result = await client.query(
      `UPDATE work_orders
       SET status = $2, updated_at = NOW() ${completedAtClause}
       WHERE id = $1
       RETURNING *`,
      [workOrderId, input.status]
    );

    const updated = result.rows[0];
    if (!updated) {
      throw new AppError('Work order not found.', 404, 'NOT_FOUND');
    }

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'WORK_ORDER_STATUS_UPDATED',
      resourceType: 'WORK_ORDER',
      resourceId: workOrderId,
      metadata: { newStatus: input.status },
      request,
    });

    return updated;
  });
}
