/**
 * The single SQLite connection and its Drizzle wrapper.
 *
 * `openDatabaseSync` at module scope is deliberate on native: expo-sqlite opens
 * the file synchronously, so one connection created once serves every screen.
 *
 * The web build will need a `.web.ts` sibling here — there is no synchronous
 * SQLite in a browser. Reads already go through `live.ts`, which awaits its
 * query, so swapping in an async driver is a change confined to this file.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'coffee-log.db';

export const sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
