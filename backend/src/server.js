import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const pool = createPool(config.db);
const app = createApp({ pool, logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.appEnv }, 'taskops-backend listening');
});

// ECS sends SIGTERM before stopping a task (e.g. during a deploy). Stop taking
// new connections, let in-flight requests finish, close the DB pool, then exit.
// ECS sends SIGKILL after 30s, so give up after 25s.
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 25_000);
  forceExit.unref();

  server.close(async () => {
    await pool.end();
    logger.info('shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
