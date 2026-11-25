import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, LogOut, PackageCheck, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { apiRequest, formatCurrency } from './lib/api';
import { AuditLogEntry, Customer, InventoryItem, WorkOrder } from './lib/types';
import { AuthPage } from './pages/AuthPage';
import { CustomersPage } from './pages/CustomersPage';
import { InventoryAndAuditPage } from './pages/InventoryAndAuditPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';

type Tab = 'orders' | 'customers' | 'inventory';

export function App() {
  const { user, token, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    const [woRes, custRes, invRes, auditRes] = await Promise.all([
      apiRequest<{ data: WorkOrder[] }>('/work-orders'),
      apiRequest<{ data: Customer[] }>('/customers'),
      apiRequest<{ data: InventoryItem[] }>('/inventory'),
      apiRequest<{ data: AuditLogEntry[] }>('/privacy/audit-logs'),
    ]);
    setWorkOrders(woRes.data);
    setCustomers(custRes.data);
    setInventory(invRes.data);
    setAuditLogs(auditRes.data);
  }, [token]);

  useEffect(() => { refreshAll().catch(() => {}); }, [refreshAll]);

  if (!user || !token) return <AuthPage />;

  const completedRevenueCents = workOrders.filter((w) => w.status === 'COMPLETED').reduce((acc, w) => acc + w.total_amount_cents, 0);
  const openOrdersCount = workOrders.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED').length;
  const lowStockCount = inventory.filter((i) => i.is_low_stock).length;
  const activeCustomersCount = customers.filter((c) => !c.is_anonymized).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <div className="brand-title"><ShieldCheck size={18} color="#3b82f6" /><span>OpsFlow</span></div>
          <div className="brand-tenant" title={user.organizationName}>{user.organizationName}</div>
        </div>
        <nav className="nav-list">
          <button type="button" className={`nav-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}><ClipboardList size={16} /> Work Orders</button>
          <button type="button" className={`nav-btn ${tab === 'customers' ? 'active' : ''}`} onClick={() => setTab('customers')}><Users size={16} /> Customers &amp; PII Vault</button>
          <button type="button" className={`nav-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}><PackageCheck size={16} /> Inventory &amp; Audit</button>
        </nav>
        <button type="button" className="nav-btn" onClick={logout}><LogOut size={16} /> Sign Out</button>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-info mono">RLS TENANT ISOLATED</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Operator: {user.fullName} ({user.role})</span>
          </div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>AES-256-GCM | LGPD/GDPR</span>
        </header>
        <main className="page-content">
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-label">Completed Revenue</div><div className="kpi-value mono">{formatCurrency(completedRevenueCents)}</div></div>
            <div className="kpi-card"><div className="kpi-label">Active Work Orders</div><div className="kpi-value mono">{openOrdersCount}</div></div>
            <div className="kpi-card"><div className="kpi-label">Active Customers</div><div className="kpi-value mono">{activeCustomersCount}</div></div>
            <div className="kpi-card"><div className="kpi-label">Low Stock Alerts</div><div className="kpi-value mono" style={{ color: lowStockCount > 0 ? '#dc2626' : 'inherit' }}>{lowStockCount}</div></div>
          </div>
          {tab === 'orders' && <WorkOrdersPage workOrders={workOrders} customers={customers} inventory={inventory} onRefresh={refreshAll} />}
          {tab === 'customers' && <CustomersPage customers={customers} onRefresh={refreshAll} />}
          {tab === 'inventory' && <InventoryAndAuditPage inventory={inventory} auditLogs={auditLogs} onRefresh={refreshAll} />}
        </main>
      </div>
    </div>
  );
}