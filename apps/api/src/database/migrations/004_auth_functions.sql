-- Runtime authentication helpers.
-- These SECURITY DEFINER functions keep registration and login bootstrap work
-- behind a narrow database interface, so the public API does not need a
-- superuser or database-owner credential.

CREATE OR REPLACE FUNCTION register_organization_and_owner(
    p_organization_name TEXT,
    p_slug TEXT,
    p_full_name TEXT,
    p_email TEXT,
    p_password_hash TEXT,
    p_policy_version TEXT,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS TABLE (
    organization_id UUID,
    organization_name VARCHAR(150),
    organization_slug VARCHAR(100),
    user_id UUID,
    full_name VARCHAR(150),
    email VARCHAR(255),
    role user_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    new_organization organizations%ROWTYPE;
    new_user users%ROWTYPE;
BEGIN
    INSERT INTO organizations (name, slug)
    VALUES (p_organization_name, p_slug)
    RETURNING * INTO new_organization;

    INSERT INTO users (organization_id, full_name, email, password_hash, role)
    VALUES (new_organization.id, p_full_name, lower(p_email), p_password_hash, 'OWNER')
    RETURNING * INTO new_user;

    INSERT INTO consent_records (
        organization_id, subject_type, subject_id, purpose, policy_version,
        granted, ip_address, user_agent
    ) VALUES (
        new_organization.id, 'USER', new_user.id,
        'ACCOUNT_PROVISIONING_AND_TERMS', p_policy_version,
        TRUE, p_ip_address, p_user_agent
    );

    INSERT INTO audit_logs (
        organization_id, actor_user_id, action, resource_type, resource_id,
        ip_address, user_agent, metadata
    ) VALUES (
        new_organization.id, new_user.id, 'ORGANIZATION_CREATED',
        'ORGANIZATION', new_organization.id, p_ip_address, p_user_agent,
        jsonb_build_object('slug', new_organization.slug)
    );

    RETURN QUERY SELECT
        new_organization.id,
        new_organization.name,
        new_organization.slug,
        new_user.id,
        new_user.full_name,
        new_user.email,
        new_user.role;
END;
$$;

CREATE OR REPLACE FUNCTION find_user_for_login(p_email TEXT)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    full_name VARCHAR(150),
    email VARCHAR(255),
    password_hash TEXT,
    role user_role,
    is_active BOOLEAN,
    org_name VARCHAR(150)
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT u.id, u.organization_id, u.full_name, u.email, u.password_hash,
           u.role, u.is_active, o.name
    FROM users u
    JOIN organizations o ON o.id = u.organization_id
    WHERE u.email = lower(p_email)
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION record_user_login(
    p_organization_id UUID,
    p_user_id UUID,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE users SET last_login_at = NOW() WHERE id = p_user_id;

    INSERT INTO audit_logs (
        organization_id, actor_user_id, action, resource_type, resource_id,
        ip_address, user_agent
    ) VALUES (
        p_organization_id, p_user_id, 'USER_LOGIN', 'USER', p_user_id,
        p_ip_address, p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION register_organization_and_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INET, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION find_user_for_login(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_user_login(UUID, UUID, INET, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'opsflow_app') THEN
        GRANT EXECUTE ON FUNCTION register_organization_and_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INET, TEXT) TO opsflow_app;
        GRANT EXECUTE ON FUNCTION find_user_for_login(TEXT) TO opsflow_app;
        GRANT EXECUTE ON FUNCTION record_user_login(UUID, UUID, INET, TEXT) TO opsflow_app;
    END IF;
END
$$;
