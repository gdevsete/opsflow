import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

if (!process.env.DATABASE_ADMIN_URL) {
  throw new Error('DATABASE_ADMIN_URL is required to run migrations.');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const dir = path.resolve('src/database/migrations');

for (const file of fs.readdirSync(dir).sort()) {
  if (file.endsWith('.sql')) {
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
}

await pool.end();
