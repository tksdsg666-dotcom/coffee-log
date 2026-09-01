/**
 * Read queries.
 *
 * Every one is a *function* returning a fresh query, not a pre-built one. The
 * hook in `live.ts` re-runs them on every change, and a builder that has already
 * been awaited is not reliably reusable — building fresh each time costs
 * nothing and removes the question entirely.
 */
import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { db } from './client';
import { beans, brands, devices, records } from './schema';

export const allRecords = () => db.select().from(records).orderBy(desc(records.drankAtMs));

export const allBeans = () => db.select().from(beans).orderBy(desc(beans.createdAt));

export const allBrands = () => db.select().from(brands).orderBy(brands.createdAt);

export const allDevices = () => db.select().from(devices).orderBy(devices.createdAt);

export const recordById = (id: string) =>
  db.select().from(records).where(eq(records.id, id)).limit(1);

export const beanById = (id: string) => db.select().from(beans).where(eq(beans.id, id)).limit(1);

/** 自制 records only, newest first — the source for the 沿用最近 presets. */
export const selfRecords = () =>
  db.select().from(records).where(eq(records.brandId, 'self')).orderBy(desc(records.drankAtMs));

/** Past grind settings for one grinder, newest first — the 常用值 capsules. */
export const grindHistory = (grinder: string) =>
  db
    .select({ grind: records.grind, drankAtMs: records.drankAtMs })
    .from(records)
    .where(and(eq(records.grinder, grinder), isNotNull(records.grind)))
    .orderBy(desc(records.drankAtMs))
    .limit(40);
