import { FastifyRequest } from 'fastify';
import { withTenantContext } from '../../config/database.js';
import { recordAuditLog } from '../../middlewares/auditLogger.js';
import { AppError } from '../../utils/appError.js';
import { CreateInventoryItemInput, StockAdjustmentInput } from './inventory.schema.js';

export async function listInventoryItems(tenantId: string) {
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, sku, name, description, unit_cost_cents, unit_price_cents,
              quantity_on_hand, min_stock_level,
              (quantity_on_hand <= min_stock_level) AS is_low_stock,
              updated_at
       FROM inventory_items
       ORDER BY name ASC`
    );
    return result.rows;
  });
}

export async function createInventoryItem(
  tenantId: string,
  actorUserId: string,
  input: CreateInventoryItemInput,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    try {
      const result = await client.query(
        `INSERT INTO inventory_items (
          organization_id, sku, name, description, unit_cost_cents, unit_price_cents, quantity_on_hand, min_stock_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          tenantId,
          input.sku.trim().toUpperCase(),
          input.name.trim(),
          input.description?.trim() ?? null,
          input.unitCostCents,
          input.unitPriceCents,
          input.initialQuantity,
          input.minStockLevel,
        ]
      );
      const item = result.rows[0]!;

      if (input.initialQuantity > 0) {
        await client.query(
          `INSERT INTO stock_movements (
            organization_id, inventory_item_id, performed_by, movement_type, quantity_delta, notes
          ) VALUES ($1, $2, $3, 'INBOUND', $4, 'Initial stock balance')`,
          [tenantId, item.id, actorUserId, input.initialQuantity]
        );
      }

      await recordAuditLog(client, {
        organizationId: tenantId,
        actorUserId,
        action: 'INVENTORY_ITEM_CREATED',
        resourceType: 'INVENTORY_ITEM',
        resourceId: item.id,
        metadata: { sku: item.sku, initialQuantity: input.initialQuantity },
        request,
      });

      return item;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new AppError('An inventory item with this SKU already exists.', 409, 'DUPLICATE_SKU');
      }
      throw error;
    }
  });
}

export async function adjustInventoryStock(
  tenantId: string,
  actorUserId: string,
  itemId: string,
  input: StockAdjustmentInput,
  request: FastifyRequest
) {
  return withTenantContext(tenantId, async (client) => {
    const current = await client.query<{ quantity_on_hand: number }>(
      `SELECT quantity_on_hand FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [itemId]
    );
    const item = current.rows[0];
    if (!item) {
      throw new AppError('Inventory item not found.', 404, 'NOT_FOUND');
    }

    const newQuantity = item.quantity_on_hand + input.quantityDelta;
    if (newQuantity < 0) {
      throw new AppError('Insufficient stock for this outbound movement.', 422, 'INSUFFICIENT_STOCK');
    }

    const updated = await client.query(
      `UPDATE inventory_items
       SET quantity_on_hand = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [itemId, newQuantity]
    );

    await client.query(
      `INSERT INTO stock_movements (
        organization_id, inventory_item_id, performed_by, movement_type, quantity_delta, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, itemId, actorUserId, input.movementType, input.quantityDelta, input.notes ?? null]
    );

    await recordAuditLog(client, {
      organizationId: tenantId,
      actorUserId,
      action: 'INVENTORY_STOCK_ADJUSTED',
      resourceType: 'INVENTORY_ITEM',
      resourceId: itemId,
      metadata: { delta: input.quantityDelta, newQuantity },
      request,
    });

    return updated.rows[0];
  });
}
