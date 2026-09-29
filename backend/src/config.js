// All configuration comes from environment variables so the same image runs
// locally (Compose) and in AWS (ECS injects values, the password from SSM).
const REQUIRED = [
  'DATABASE_HOST',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
];

export function loadConfig(env = process.env) {
  // Fail fast: a container that starts with missing config should crash
  // immediately and loudly, not serve errors later.
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    appEnv: env.APP_ENV ?? 'local',
    port: Number(env.PORT ?? 3000),
    logLevel: env.LOG_LEVEL ?? 'info',
    db: {
      host: env.DATABASE_HOST,
      port: Number(env.DATABASE_PORT ?? 5432),
      database: env.DATABASE_NAME,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      // RDS supports TLS; turn it on in AWS with DATABASE_SSL=true.
      ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    },
  };
}
