import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { createLogger } from '../src/logger.js';
import { runMigrations } from '../src/migrate.js';

// API tests hit a REAL Postgres (a separate `taskops_test` database), because
// mocking the database would hide the bugs that matter most: bad SQL,
// constraint violations, migration mistakes.
// Locally: `docker compose up -d postgres`. In CI: a Postgres service container.
const dbConfig = {
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  database: process.env.DATABASE_NAME ?? 'taskops_test',
  user: process.env.DATABASE_USER ?? 'taskops',
  password: process.env.DATABASE_PASSWORD ?? 'taskops_local',
};

const logger = createLogger('silent');
let pool;
let app;

beforeAll(async () => {
  await runMigrations(dbConfig);
  pool = createPool(dbConfig);
  app = createApp({ pool, logger });
});

beforeEach(async () => {
  await pool.query('TRUNCATE tasks RESTART IDENTITY');
});

afterAll(async () => {
  await pool?.end();
});

describe('health endpoints', () => {
  test('GET /health returns ok without touching the DB', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /ready confirms the database is reachable', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  test('GET /ready returns 503 when the database is down', async () => {
    const badPool = createPool({ ...dbConfig, port: 1, connectionTimeoutMillis: 500 });
    const res = await request(createApp({ pool: badPool, logger })).get('/ready');
    expect(res.status).toBe(503);
    await badPool.end();
  });

  test('GET /api/health returns ok (ALB smoke-test route)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('tasks API', () => {
  test('full lifecycle: create, list, get, update, delete', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Write Dockerfile', description: 'multi-stage, non-root' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 1,
      title: 'Write Dockerfile',
      description: 'multi-stage, non-root',
      status: 'todo',
    });

    const list = await request(app).get('/api/tasks');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const one = await request(app).get('/api/tasks/1');
    expect(one.body.title).toBe('Write Dockerfile');

    const updated = await request(app).patch('/api/tasks/1').send({ status: 'done' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('done');
    expect(updated.body.title).toBe('Write Dockerfile'); // untouched fields kept
    expect(new Date(updated.body.updated_at) >= new Date(created.body.updated_at)).toBe(true);

    const deleted = await request(app).delete('/api/tasks/1');
    expect(deleted.status).toBe(204);

    const gone = await request(app).get('/api/tasks/1');
    expect(gone.status).toBe(404);
  });

  test('lists newest tasks first', async () => {
    await request(app).post('/api/tasks').send({ title: 'first' });
    await request(app).post('/api/tasks').send({ title: 'second' });
    const res = await request(app).get('/api/tasks');
    expect(res.body.map((t) => t.title)).toEqual(['second', 'first']);
  });

  test('rejects invalid input with 400 and a reason', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '', status: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    expect(res.status).toBe(400);
  });

  test('returns 404 for missing or invalid ids', async () => {
    expect((await request(app).get('/api/tasks/999')).status).toBe(404);
    expect((await request(app).get('/api/tasks/abc')).status).toBe(404);
    expect((await request(app).patch('/api/tasks/999').send({ status: 'done' })).status).toBe(404);
    expect((await request(app).delete('/api/tasks/999')).status).toBe(404);
  });

  test('treats SQL-looking input as plain text (no injection)', async () => {
    const title = "x'); DROP TABLE tasks; --";
    const res = await request(app).post('/api/tasks').send({ title });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe(title);
    expect((await request(app).get('/api/tasks')).body).toHaveLength(1);
  });

  test('unknown routes return JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });
});
