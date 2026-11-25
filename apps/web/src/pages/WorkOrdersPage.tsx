import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiRequest, formatCurrency } from '../lib/api';
import { Customer, InventoryItem, WorkOrder, WorkOrderPriority, WorkOrderStatus } from '../lib/types';

interface Props {
  workOrders: WorkOrder[];
  customers: Customer[];
  inventory: InventoryItem[];
  onRefresh: () => Promise<void>;
}

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  OPEN: 'badge-info',
  IN_PROGRESS: 'badge-warning',
  WAITING_PARTS: 'badge-neutral',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
};

export function WorkOrdersPage({ workOrders, customers, inventory, onRefresh }: Props) {
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('MEDIUM');
  const [laborEur, setLaborEur] = useState('85.00');
  const [selectedParts, setSelectedParts] = useState<Array<{ inventoryItemId: string; quantity: number }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCustomers = customers.filter((c) => !c.is_anonymized);

  const addPartRow = () => {
    const first = inventory[0];
    if (!first) return;
    setSelectedParts([...selectedParts, { inventoryItemId: first.id, quantity: 1 }]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          title,
          priority,
          laborCostCents: Math.round(parseFloat(laborEur || '0') * 100),
          parts: selectedParts,
        }),
      });
      setTitle('');
      setSelectedParts([]);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: WorkOrderStatus) => {
    try {
      await apiRequest(`/work-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="panel" style={{ padding: 20 }}>
        <h3 className="panel-title" style={{ marginBottom: 14 }}>Dispatch New Work Order</h3>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field">
            <label>Customer</label>
            <select className="select" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select active customer...</option>
              {activeCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Service Summary</label>
            <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="HVAC Compressor Diagnostic & Seal Replacement" />
          </div>
          <div className="field">
            <label>Priority</label>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div className="field">
            <label>Labor Charge (EUR)</label>
            <input className="input mono" type="number" step="0.01" min="0" value={laborEur} onChange={(e) => setLaborEur(e.target.value)} />
          </div>

          <div className="field field-full">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Allocated Spare Parts (Atomic Stock Deduction)</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addPartRow} disabled={inventory.length === 0}>
                <Plus size={14} /> Add Part
              </button>
            </div>
            {selectedParts.map((part, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <select
                  className="select"
                  value={part.inventoryItemId}
                  onChange={(e) => {
                    const copy = [...selectedParts];
                    copy[idx] = { ...part, inventoryItemId: e.target.value };
                    setSelectedParts(copy);
                  }}
                >
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.name} ({item.quantity_on_hand} in stock • {formatCurrency(item.unit_price_cents)})
                    </option>
                  ))}
                </select>
                <input
                  className="input mono"
                  type="number"
                  min={1}
                  style={{ width: 90 }}
                  value={part.quantity}
                  onChange={(e) => {
                    const copy = [...selectedParts];
                    copy[idx] = { ...part, quantity: Math.max(1, parseInt(e.target.value || '1', 10)) };
                    setSelectedParts(copy);
                  }}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedParts(selectedParts.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="field-full">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating Order...' : 'Issue Work Order'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Active &amp; Historical Work Orders ({workOrders.length})</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Title</th>
              <th>Customer</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Total</th>
              <th>Transition</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.length === 0 ? (
              <tr><td colSpan={7} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No work orders registered for this tenant.</td></tr>
            ) : workOrders.map((wo) => (
              <tr key={wo.id}>
                <td className="mono">#{String(wo.order_number).padStart(4, '0')}</td>
                <td><strong>{wo.title}</strong></td>
                <td>{wo.customer_name}</td>
                <td><span className="badge badge-neutral">{wo.priority}</span></td>
                <td><span className={`badge ${STATUS_BADGE[wo.status]}`}>{wo.status}</span></td>
                <td className="mono">{formatCurrency(wo.total_amount_cents)}</td>
                <td>
                  <select
                    className="select"
                    style={{ width: 150, padding: '4px 8px', fontSize: 12.5 }}
                    value={wo.status}
                    onChange={(e) => handleStatusChange(wo.id, e.target.value as WorkOrderStatus)}
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="WAITING_PARTS">WAITING_PARTS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
