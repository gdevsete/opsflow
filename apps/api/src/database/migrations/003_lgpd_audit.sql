-- LGPD / GDPR Legal Basis & Consent Tracking (Art. 7 & Art. 8)
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject_type VARCHAR(32) NOT NULL CHECK (subject_type IN ('USER', 'CUSTOMER')),
    subject_id UUID NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    policy_version VARCHAR(20) NOT NULL,
    granted BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable Audit Log for Personal Data Access & Mutations (LGPD Art. 37)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_subject ON consent_records(organization_id, subject_id);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

GRANT SELECT, INSERT ON consent_records TO opsflow_app;
GRANT SELECT, INSERT ON audit_logs TO opsflow_app;

-- Prevent UPDATE or DELETE on audit_logs to guarantee tamper-evidence
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_consent ON consent_records
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);