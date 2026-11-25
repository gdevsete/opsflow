CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Dedicated non-superuser role used by the Node.js API so Row Level Security (RLS) is strictly enforced
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opsflow_app') THEN
    CREATE ROLE opsflow_app LOGIN PASSWORD 'opsflow_app_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE opsflow_db TO opsflow_app;