import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

/** Connects with the given URL. Use DATABASE_URL (role soltex_app) for the application. */
export function connect(url: string, max = 5) {
  if (!url) throw new Error('database URL is not set');
  const pool = new pg.Pool({ connectionString: url, max });
  const db = drizzle(pool, { schema });
  return { pool, db, close: () => pool.end() };
}

export type Db = ReturnType<typeof connect>['db'];
/** A database handle or an open transaction. */
export type Queryable = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
