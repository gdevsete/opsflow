-- Grant schema and table privileges to application role
GRANT USAGE ON SCHEMA public TO opsflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opsflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO opsflow_app;

-- Enable Row Level Security on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners if needed, ensuring strict session isolation
-- Session variable 'app.current_tenant_id' is set per transaction by the API middleware

CREATE POLICY tenant_isolation_organizations ON organizations
    USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_users ON users
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_customers ON customers
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_inventory ON inventory_items
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_work_orders ON work_orders
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_work_order_items ON work_order_items
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_stock_movements ON stock_movements
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);