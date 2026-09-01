/**
 * The SQLite connection and its Drizzle wrapper.
 *
 * Everything here is **asynchronous**, on every platform. That is not a style
 * preference — there is no synchronous SQLite in a browser. expo-sqlite does
 * expose a sync API on the web, but it is the main thread spinning on a
 * SharedArrayBuffer waiting for a worker, and it times out long before the
 * 600KB WASM build has finished compiling. Going async is what makes a PWA
 * possible at all, and the async API works just as well natively, so there is
 * one driver rather than a platform split that could drift.
 *
 * `drizzle-orm/expo-sqlite` only wraps the sync API, hence `sqlite-proxy`: it
 * takes a plain callback and gives back the same query builder.
 */
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'coffee-log.db';

/**
 * One connection, opened once and shared. The promise itself is the cache, so
 * concurrent callers during startup all await the same open rather than racing
 * to open the file several times.
 */
let opening: Promise<SQLiteDatabase> | null = null;

export const connection = (): Promise<SQLiteDatabase> => {
  opening ??= openDatabaseAsync(DB_NAME);
  return opening;
};

/**
 * Runs one statement for Drizzle.
 *
 * `sqlite-proxy` wants rows as arrays of values in column order, which is why
 * this reaches for `executeForRawResultAsync` rather than the friendlier
 * `getAllAsync` — mapping row objects back into column order by hand would be
 * guessing at an ordering the driver already knows.
 */
const runStatement = async (
  sql: string,
  params: unknown[],
  method: 'run' | 'all' | 'values' | 'get',
): Promise<{ rows: unknown[] }> => {
  const db = await connection();

  if (method === 'run') {
    await db.runAsync(sql, params as never);
    return { rows: [] };
  }

  const statement = await db.prepareAsync(sql);
  try {
    const result = await statement.executeForRawResultAsync<Record<string, unknown>>(
      params as never,
    );
    const rows = await result.getAllAsync();
    // 'get' wants the single row itself, not a list holding it.
    return { rows: method === 'get' ? ((rows[0] as unknown[]) ?? []) : (rows as unknown[]) };
  } finally {
    await statement.finalizeAsync();
  }
};

export const db = drizzle(runStatement);

export type DB = typeof db;
