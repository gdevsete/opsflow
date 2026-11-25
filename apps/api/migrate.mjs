import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const dir = path.resolve('src/database/migrations');

for (const file of fs.readdirSync(dir).sort()) {
  if (file.endsWith('.sql')) {
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
}

await pool.end();
