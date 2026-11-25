import { describe, expect, it } from 'vitest';
import { calculateWorkOrderTotal } from '../../src/modules/work-orders/workOrder.service.js';

describe('Work Order Pricing Calculation', () => {
  it('calculates total amount in integer cents accurately', () => {
    const total = calculateWorkOrderTotal(15000, [
      { quantity: 2, unitPriceCents: 4550 },
      { quantity: 1, unitPriceCents: 12000 },
    ]);

    expect(total).toBe(36100);
  });

  it('returns labor cost when no parts are attached', () => {
    expect(calculateWorkOrderTotal(8500, [])).toBe(8500);
  });
});