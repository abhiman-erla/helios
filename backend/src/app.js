import express from 'express';
import { pinoHttp } from 'pino-http';
import { tasksRouter } from './routes/tasks.js';

// Building the app separately from server.js lets tests call routes
// in-process with Supertest, without opening a network port.
export function createApp({ pool, logger }) {
  const app = express();
  app.disable('x-powered-by'); // don't advertise the framework to attackers
  app.use(express.json({ limit: '100kb' }));

  // Liveness: "is the process up?" No DB call, so a slow database doesn't make
  // the ALB kill healthy containers. This is what the ALB health check hits.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Readiness: "can I actually serve requests?" Checks the database.
  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch (err) {
      logger.warn({ err }, 'readiness check failed');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // Request logs after the health routes, so health-check noise isn't logged.
  app.use(pinoHttp({ logger }));

  // Behind the ALB, /api/health lets the smoke test reach the backend's liveness route.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/tasks', tasksRouter(pool));

  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  // Express 5 forwards errors from async handlers here automatically.
  // Express recognises an error handler by its 4 arguments, so `_next` must stay.
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ errors: ['request body is not valid JSON'] });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ errors: ['request body is too large'] });
    }
    (req.log ?? logger).error({ err }, 'unhandled error');
    // Don't leak internals (stack traces, SQL) to clients.
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
