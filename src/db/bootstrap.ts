/**
 * One-time setup that runs after migrations: the reserved 自制 brand.
 *
 * SPEC reserves `brands.id = 'self'` as the "not from a shop" source. It is not
 * seed data the user can decline — the record form's source segment is built on
 * it — so it is created here rather than in any seeding step.
 */
import { eq } from 'drizzle-orm';

import { db } from './client';
import { brands } from './schema';

export const SELF_BRAND_ID = 'self';

export const bootstrap = async (): Promise<void> => {
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.id, SELF_BRAND_ID))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(brands).values({
      id: SELF_BRAND_ID,
      name: '自制',
      isSelf: true,
      createdAt: Date.now(),
    });
  }
};
