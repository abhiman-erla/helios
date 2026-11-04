import { loadConfig } from '../src/config.js';

const base = {
  DATABASE_HOST: 'db.example.test',
  DATABASE_NAME: 'app',
  DATABASE_USER: 'app',
  DATABASE_PASSWORD: 'not-a-secret',
};

describe('database TLS', () => {
  test('DATABASE_SSL=true verifies the server certificate', () => {
    const { db } = loadConfig({ ...base, DATABASE_SSL: 'true' });
    expect(db.ssl).toEqual({ rejectUnauthorized: true });
  });

  test.each([undefined, 'false', ''])('DATABASE_SSL=%j leaves TLS off', (value) => {
    const { db } = loadConfig({ ...base, DATABASE_SSL: value });
    expect(db.ssl).toBeUndefined();
  });
});
