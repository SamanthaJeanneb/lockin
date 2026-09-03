import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

/**
 * One pooled connection per process, created lazily.
 *
 * Lazily matters: the setup screen has to render on a fresh clone with no
 * DATABASE_URL, so nothing may connect at import time.
 *
 * Supabase's transaction pooler (port 6543) does not support prepared
 * statements, so they are disabled.
 *
 * Every query in this app filters by user_id in application code; RLS on the
 * database is the second line of defence, not the first. See SETUP.md § Security.
 */
declare global {
  // eslint-disable-next-line no-var
  var __lockin_sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __lockin_db: PostgresJsDatabase<typeof schema> | undefined;
}

function connect() {
  const url = env.databaseUrl;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill in your connection string.',
    );
  }
  return postgres(url, {
    max: env.nodeEnv === 'production' ? 10 : 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export function getSql() {
  globalThis.__lockin_sql ??= connect();
  return globalThis.__lockin_sql;
}

function getDb(): PostgresJsDatabase<typeof schema> {
  globalThis.__lockin_db ??= drizzle(getSql(), { schema });
  return globalThis.__lockin_db;
}

/** Behaves exactly like a Drizzle instance; opens the socket on first use. */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export { schema };
