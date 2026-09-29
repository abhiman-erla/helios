import pino from 'pino';

// JSON logs (one object per line) are searchable in CloudWatch Logs Insights,
// e.g. `filter level >= 50` to find errors.
export function createLogger(level = 'info') {
  return pino({
    level,
    base: { service: 'taskops-backend' },
    // Never log secrets, even by accident.
    redact: ['req.headers.authorization', 'req.headers.cookie', '*.password'],
  });
}
