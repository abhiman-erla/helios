import pg from 'pg';

// A pool reuses a few open connections instead of opening one per request,
// which keeps RDS connection counts low (one of the Phase 5 alarms).
export function createPool(dbConfig) {
  return new pg.Pool({
    ...dbConfig,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
