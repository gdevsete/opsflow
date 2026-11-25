# OpsFlow Enterprise

**Multi-Tenant Field Operations & LGPD/GDPR Compliance Platform**

OpsFlow is a production-grade B2B SaaS platform engineered for technical service and field-maintenance organizations. It enforces tenant isolation at the database kernel level via PostgreSQL Row-Level Security (RLS), protects Personally Identifiable Information (PII) with envelope AES-256-GCM encryption and HMAC-SHA256 blind indexing, and implements verifiable Data Subject Rights (Art. 18 LGPD / Arts. 15-20 GDPR) backed by an immutable append-only audit ledger.

---

## Architectural Highlights

### 1. Defense-in-Depth Multi-Tenancy (PostgreSQL RLS)
- Every tenant-scoped table (users, customers, inventory_items, work_orders, work_order_parts, consent_records, udit_logs) enforces FORCE ROW LEVEL SECURITY.
- On every authenticated HTTP request, the API executes inside a scoped transaction (SET LOCAL app.current_tenant_id = ), preventing cross-tenant data leakage even in the event of an application-layer query flaw.
- Integration tests explicitly assert cross-tenant read/write rejection and privilege boundary enforcement.

### 2. Cryptographic PII Vault & Blind Indexing
- Sensitive customer identifiers (Tax ID / PPSN / CPF) are encrypted before persistence using **AES-256-GCM** with unique 96-bit random IVs and 128-bit authentication tags (pps/api/src/lib/crypto.ts).
- Deterministic uniqueness checks within a tenant are performed via keyed **HMAC-SHA256 blind hashes** (document_hash), eliminating plaintext storage while preserving O(1) lookup performance.
### 3. LGPD & GDPR Data Subject Rights Engine
- **Consent Ledger (consent_records)**: Immutable proof of lawful basis, policy version, timestamp, and IP metadata upon tenant provisioning and customer onboarding.
- **Data Portability (LGPD Art. 18, V / GDPR Art. 20)**: Structured JSON export of customer profile, decrypted PII (restricted to OWNER/ADMIN), consent history, and work order records, generating a mandatory audit event on every export.
- **Crypto-Shredding & Anonymization (LGPD Art. 18, VI / GDPR Art. 17)**: Irreversibly scrubs personal identifiers and destroys encrypted document payloads while preserving anonymized fiscal work order totals for statutory tax retention.

### 4. Transactional Inventory & Financial Integrity
- All monetary values are stored as integer cents (BIGINT / INTEGER) to eliminate IEEE-754 floating-point drift.
- Work order creation atomically locks inventory rows (SELECT ... FOR UPDATE), validates available stock, deducts spare parts, and computes line-item and labor totals inside a single ACID transaction.
- Database triggers enforce state-machine transitions (OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED), automatically stamp completed_at, and prevent mutations on immutable audit logs.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Node.js 22, TypeScript (Strict), Fastify, Zod, JWT (@fastify/jwt), Pino |
| **Database & Security** | PostgreSQL 16, Row-Level Security (RLS), PL/pgSQL Triggers, AES-256-GCM, HMAC-SHA256, Argon2id |
| **Frontend Console** | React 18, TypeScript, Vite, Lucide Icons, Custom Industrial Design System |
| **Testing & DevOps** | Vitest (Unit & Integration Suites), Docker Compose, GitHub Actions CI |

---

## Local Setup & Verification

1. Start PostgreSQL & configure environment:
   - docker compose up -d
   - cp .env.example .env
2. Install dependencies & run SQL migrations:
   - npm install
   - npm run db:migrate --workspace=@opsflow/api
3. Run security, RLS & compliance integration tests:
   - npm test --workspace=@opsflow/api
4. Start API (:3001) and Web Console (:5173):
   - npm run dev --workspace=@opsflow/api
   - npm run dev --workspace=@opsflow/web

---

## API Overview (/api/v1)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| POST | /auth/register | Public | Provisions tenant organization, owner account, and initial privacy consent |
| POST | /auth/login | Public | Authenticates operator and issues tenant-scoped JWT |
| GET / POST | /customers | Authenticated | Lists customers or registers customer with AES-256-GCM PII encryption |
| GET / POST | /inventory | Authenticated | Manages spare-part SKUs, pricing, and low-stock thresholds |
| GET / POST | /work-orders | Authenticated | Dispatches work orders with atomic multi-part inventory deduction |
| PATCH | /work-orders/:id/status | Authenticated | Advances work order lifecycle with state-machine validation |
| GET | /privacy/customers/:id/export | OWNER, ADMIN | Exports portable JSON data bundle (LGPD Art. 18 / GDPR Art. 20) |
| POST | /privacy/customers/:id/anonymize | OWNER, ADMIN | Irreversibly anonymizes customer PII while retaining fiscal records |
| GET | /privacy/audit-logs | OWNER, ADMIN | Queries the tenant immutable append-only compliance audit ledger |

---

## Author

**Guilherme Oliveira** — Full Stack Software Engineer  
Focused on multi-tenant SaaS architecture, applied cryptography, and regulatory data engineering (GDPR/LGPD).