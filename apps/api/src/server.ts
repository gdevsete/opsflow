import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabasePools } from './config/database.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const shutdown = async () => {
  await app.close();
  await closeDatabasePools();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
