CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Dedicated non-superuser role used by the Node.js API. Keep administrative access
-- in a separate local-only connection string used by migration/test tooling.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opsflow_app') THEN
    CREATE ROLE opsflow_app LOGIN PASSWORD 'opsflow_app_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE opsflow_db TO opsflow_app;
