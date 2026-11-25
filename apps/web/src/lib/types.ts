export type UserRole = 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'VIEWER';

export interface SessionUser {
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  has_document: boolean;
  is_anonymized: boolean;
  anonymized_at: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit_cost_cents: number;
  unit_price_cents: number;
  quantity_on_hand: number;
  min_stock_level: number;
  is_low_stock: boolean;
}

export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface WorkOrder {
  id: string;
  order_number: number;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  labor_cost_cents: number;
  total_amount_cents: number;
  created_at: string;
  completed_at: string | null;
  customer_id: string;
  customer_name: string;
  customer_anonymized: boolean;
  technician_name: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
}