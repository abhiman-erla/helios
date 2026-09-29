import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function runMigrations(dbConfig, logger) {
  return runner({
    databaseUrl: dbConfig,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: (msg) => logger?.info(msg),
  });
}

// Run directly (`node src/migrate.js`): used by Compose on startup and, in AWS,
// as a one-off ECS task before each deploy. Migrations that already ran are
// recorded in the pgmigrations table and skipped.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  try {
    const applied = await runMigrations(config.db, logger);
    logger.info({ applied: applied.map((m) => m.name) }, 'migrations complete');
  } catch (err) {
    logger.error({ err }, 'migrations failed');
    process.exit(1);
  }
}
