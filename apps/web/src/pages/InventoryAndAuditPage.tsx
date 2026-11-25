import React, { useState } from 'react';
import { apiRequest, formatCurrency } from '../lib/api';
import { AuditLogEntry, InventoryItem } from '../lib/types';

interface Props { inventory: InventoryItem[]; auditLogs: AuditLogEntry[]; onRefresh: () => Promise<void>; }

export function InventoryAndAuditPage({ inventory, auditLogs, onRefresh }: Props) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unitPriceEur, setUnitPriceEur] = useState('45.00');
  const [quantity, setQuantity] = useState('12');
  const [minStock, setMinStock] = useState('3');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const priceCents = Math.round(parseFloat(unitPriceEur || '0') * 100);
      await apiRequest('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          sku: sku.toUpperCase(), name,
          unitCostCents: Math.round(priceCents * 0.6),
          unitPriceCents: priceCents,
          quantityOnHand: parseInt(quantity || '0', 10),
          minStockLevel: parseInt(minStock || '2', 10),
        }),
      });
      setSku(''); setName('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory SKU');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="panel" style={{ padding: 20 }}>
        <h3 className="panel-title" style={{ marginBottom: 14 }}>Register Spare Part SKU</h3>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleAddItem} className="form-grid">
          <div className="field"><label>SKU Code</label><input className="input mono" required value={sku} onChange={(e) => setSku(e.target.value)} placeholder="HVAC-VALVE-09" /></div>
          <div className="field"><label>Component Name</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Danfoss Expansion Valve 3/8" /></div>
          <div className="field"><label>Unit Sale Price (EUR)</label><input className="input mono" type="number" step="0.01" min="0" value={unitPriceEur} onChange={(e) => setUnitPriceEur(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field"><label>Initial Stock</label><input className="input mono" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <div className="field"><label>Reorder Threshold</label><input className="input mono" type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></div>
          </div>
          <div className="field-full"><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving SKU...' : 'Add Inventory SKU'}</button></div>
        </form>
      </div>
      <div className="panel">
        <div className="panel-header"><h3 className="panel-title">Warehouse Stock Levels ({inventory.length})</h3></div>
        <table className="data-table">
          <thead><tr><th>SKU</th><th>Item</th><th>Unit Price</th><th>On Hand</th><th>Threshold</th><th>Stock Health</th></tr></thead>
          <tbody>
            {inventory.length === 0 ? (
              <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No SKUs in inventory.</td></tr>
            ) : inventory.map((item) => (
              <tr key={item.id}>
                <td className="mono">{item.sku}</td>
                <td><strong>{item.name}</strong></td>
                <td className="mono">{formatCurrency(item.unit_price_cents)}</td>
                <td className="mono">{item.quantity_on_hand}</td>
                <td className="mono">{item.min_stock_level}</td>
                <td>{item.is_low_stock ? <span className="badge badge-danger">LOW STOCK ALERT</span> : <span className="badge badge-success">OPTIMAL</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <div className="panel-header"><h3 className="panel-title">Immutable Compliance Audit Trail (Append-Only Ledger)</h3></div>
        <table className="data-table">
          <thead><tr><th>Timestamp (UTC)</th><th>Action</th><th>Resource</th><th>Actor</th><th>IP</th></tr></thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No audit entries recorded yet.</td></tr>
            ) : auditLogs.map((log) => (
              <tr key={log.id}>
                <td className="mono" style={{ fontSize: 12 }}>{new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td><span className="badge badge-info mono">{log.action}</span></td>
                <td className="mono" style={{ fontSize: 12 }}>{log.resource_type}</td>
                <td>{log.actor_name ?? 'System'}</td>
                <td className="mono" style={{ fontSize: 12 }}>{log.ip_address ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}