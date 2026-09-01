/**
 * Preferences, stored as rows so they travel with the JSON backup.
 *
 * Only one so far, and it is a bigger lever than it looks: whether a cup is
 * bought or made at home is the first branch in the record form, and it also
 * decides which half of the bean lists leads. Defaulting to 自制 was wrong for
 * anyone who mostly buys their coffee.
 */
import { eq } from 'drizzle-orm';

import { db } from './client';
import { settings } from './schema';
import { notifyChanged } from './live';

export type Source = 'shop' | 'self';

export const DEFAULT_SOURCE_KEY = 'defaultSource';
export const DEFAULT_ICE_KEY = 'defaultIce';

/** What a fresh record form starts on when nothing has been chosen yet. */
export const FALLBACK_SOURCE: Source = 'shop';

export const isSource = (v: string): v is Source => v === 'shop' || v === 'self';

/** All settings as a plain map — one query, read once per screen. */
export const allSettings = () => db.select().from(settings);

export const readSource = (rows: { key: string; value: string }[] | undefined): Source => {
  const row = rows?.find((r) => r.key === DEFAULT_SOURCE_KEY);
  return row && isSource(row.value) ? row.value : FALLBACK_SOURCE;
};

/** Hot or iced, whichever the user drinks more of. */
export type Temp = 'hot' | 'ice';
export const FALLBACK_TEMP: Temp = 'hot';
export const isTemp = (v: string): v is Temp => v === 'hot' || v === 'ice';

export const readTemp = (rows: { key: string; value: string }[] | undefined): Temp => {
  const row = rows?.find((r) => r.key === DEFAULT_ICE_KEY);
  return row && isTemp(row.value) ? row.value : FALLBACK_TEMP;
};

/** Upsert, written by hand because SQLite's ON CONFLICT needs the target. */
const put = async (key: string, value: string): Promise<void> => {
  const existing = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
    notifyChanged();
    return;
  }
  await db.insert(settings).values({ key, value });
  notifyChanged();
};

export const setDefaultSource = (source: Source) => put(DEFAULT_SOURCE_KEY, source);
export const setDefaultTemp = (temp: Temp) => put(DEFAULT_ICE_KEY, temp);
