# OpsFlow

**Multi-tenant field operations console with privacy-oriented workflows**

OpsFlow is a local Docker-based portfolio project for technical service and field-maintenance teams. It combines a React/Vite console, a Fastify API, and PostgreSQL to demonstrate tenant-scoped operations, inventory and work-order workflows, encrypted customer document storage, consent records, data export, anonymisation, and audit logging.

This repository is a demonstrable software project, not a claim of legal compliance, production readiness, or security certification. The privacy features are implemented as application capabilities that can support data-subject workflows; legal obligations depend on the organisation, processing context, policies, and operational controls around the software.

## Architecture

- **Web console:** React 18, TypeScript, Vite, and a small custom design system.
- **API:** Node.js 22, TypeScript strict mode, Fastify, Zod, JWT, Pino, and Argon2id password hashing.
- **Database:** PostgreSQL 16 with tenant-scoped tables, Row-Level Security (RLS), and PL/pgSQL triggers for audit-log immutability.
- **Local runtime:** Docker Compose for PostgreSQL; the API and web console run from the workspace during development.

## Implemented capabilities

### Tenant-scoped data access

The migrations enable RLS on `organizations`, `users`, `customers`, `inventory_items`, `work_orders`, `work_order_items`, `stock_movements`, `consent_records`, and `audit_logs`. The API sets `app.current_tenant_id` locally inside tenant transactions, and the policies compare that setting with each row's `organization_id` (or the organisation `id`).

The migrations enable RLS; they do not use PostgreSQL `FORCE ROW LEVEL SECURITY`. The integration suite includes a cross-tenant customer-visibility scenario in [tenantIsolation.test.ts](apps/api/tests/integration/tenantIsolation.test.ts).

### Customer document protection

Customer documents are encrypted before persistence with AES-256-GCM using a 32-byte key from `PII_ENCRYPTION_KEY`. A keyed HMAC-SHA256 blind index supports tenant-local duplicate checks without storing the normalised document value in plaintext. This is an implementation detail of this demo and should be reviewed before any real deployment.

### Privacy-support workflows

The API records consent events, exports a customer's structured data bundle for authorised OWNER and ADMIN users, records the export in `audit_logs`, and anonymises customer identifiers while retaining the related operational records. These are privacy and data-subject workflow features; the project does not make a legal GDPR or LGPD compliance promise.

### Work orders and inventory

Monetary values are represented as integer cents. Work-order creation uses a database transaction and locks inventory rows while validating and deducting parts. The migrations include an immutable-audit-log trigger. They do not include database triggers for work-order status transitions; status validation is implemented in the API service layer.

## Local setup

Prerequisites: Node.js 22+, npm, and Docker Desktop.

1. Start PostgreSQL:

   ```powershell
   docker compose up -d postgres
   ```

   On a new Docker volume, Compose runs the SQL files mounted from `apps/api/src/database/migrations/`. The database role and credentials in `docker-compose.yml` are local development values only.

2. Create the local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

   `.env.example` contains fictional local-only values and matches the variables required by [env.ts](apps/api/src/config/env.ts). Before using the project outside this local setup, replace `JWT_SECRET` with a randomly generated secret of at least 32 characters and generate a fresh 32-byte hexadecimal `PII_ENCRYPTION_KEY`, for example:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Never commit `.env` or real credentials.

3. Install dependencies:

   ```powershell
   npm install
   ```

4. For a separately provisioned database, run the migration script from the API workspace with the administrative connection configured in `DATABASE_ADMIN_URL`:

   ```powershell
   npm --workspace=apps/api run db:migrate
   ```

   The script loads `.env` and applies the SQL files in order. Do not run it against a database that already contains these migrations unless you have a migration/rebuild plan; the current SQL files are initialisation scripts rather than an idempotent migration framework.

5. Start the API and web console in separate terminals:

   ```powershell
   npm run dev:api
   npm run dev:web
   ```

   The API listens on `http://localhost:3333`, the web console on `http://localhost:5173`, and the API health endpoint is `GET /health`.

## API overview

All business routes below include the `/api/v1` prefix. The paths are registered in [app.ts](apps/api/src/app.ts) and the individual route modules.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/v1/auth/register` | Public | Creates an organisation, owner account, and initial consent record |
| POST | `/api/v1/auth/login` | Public | Authenticates an operator and issues a tenant-scoped JWT |
| GET | `/api/v1/auth/me` | Authenticated | Returns the current JWT subject |
| GET, POST | `/api/v1/customers` | Authenticated / OWNER, ADMIN, TECHNICIAN for POST | Lists or creates customers |
| PATCH | `/api/v1/customers/:id` | OWNER, ADMIN | Updates a customer |
| GET, POST | `/api/v1/inventory` | Authenticated / OWNER, ADMIN for POST | Lists or creates inventory items |
| POST | `/api/v1/inventory/:id/movements` | OWNER, ADMIN, TECHNICIAN | Records a stock movement |
| GET, POST | `/api/v1/work-orders` | Authenticated / OWNER, ADMIN, TECHNICIAN for POST | Lists or creates work orders |
| PATCH | `/api/v1/work-orders/:id/status` | OWNER, ADMIN, TECHNICIAN | Updates work-order status through API validation |
| GET | `/api/v1/privacy/customers/:id/export` | OWNER, ADMIN | Exports a customer's data bundle |
| POST | `/api/v1/privacy/customers/:id/anonymize` | OWNER, ADMIN | Anonymises customer identifiers |
| GET | `/api/v1/privacy/audit-logs` | OWNER, ADMIN | Lists tenant audit-log entries |

## Testing and available checks

The API package exposes `npm test --workspace=@opsflow/api`, and both packages expose TypeScript checks through their `lint` scripts. These commands were not run as part of this documentation review. Run them locally after configuring PostgreSQL and `.env`.

There is currently no GitHub Actions workflow in this repository, so CI is intentionally not listed as an implemented project capability.

## Screenshots

The following images are present in `docs/screenshots/` and are referenced with working relative links:

![Work orders dashboard](docs/screenshots/01-work-orders-dashboard.png)
![PII vault and portability](docs/screenshots/02-pii-vault-portability.png)
![Inventory and audit ledger](docs/screenshots/03-inventory-audit-ledger.png)

## Portfolio notes

- **Demo:** No hosted demo is configured. Add a public demo URL here if you deploy one.
- **Professional contact:** Add your preferred LinkedIn, GitHub, email, or portfolio URL here before sharing this repository.
- **Contribution:** This project is presented as a full-stack implementation covering the React console, Fastify API, PostgreSQL schema and RLS policies, encrypted document handling, privacy-support endpoints, and local Docker setup. Adjust this statement if the repository includes work from other contributors.

## Author

**Guilherme Oliveira** - Full Stack Software Engineer

Focused on multi-tenant SaaS architecture, applied cryptography, and privacy-oriented data workflows.
