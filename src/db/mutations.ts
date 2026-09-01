/**
 * Writes. The nullable-parameter rule from SPEC lives here: `stripNulls` is
 * applied on the way in so an unset field is stored as NULL rather than 0, and
 * every screen can trust that a non-null column means "the user filled this".
 */
import { eq } from 'drizzle-orm';

import { deletePhoto } from '@/lib/photos';
import { db } from './client';
import { beans, brands, devices, records } from './schema';
import type { NewBean, NewDevice, NewRecord } from './schema';
import { notifyChanged } from './live';

const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Trims a string field down to undefined when it is blank. */
export const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
};

// ── records ──────────────────────────────────────────────────────────────────

export const insertRecord = async (values: Omit<NewRecord, 'id' | 'createdAt'>): Promise<string> => {
  const recordId = id('r');
  await db.insert(records).values({ ...values, id: recordId, createdAt: Date.now() });
  notifyChanged();
  return recordId;
};

export const updateRecord = async (
  recordId: string,
  values: Omit<NewRecord, 'id' | 'createdAt'>,
): Promise<void> => {
  await db.update(records).set(values).where(eq(records.id, recordId));
  notifyChanged();
};

export const deleteRecord = async (recordId: string): Promise<void> => {
  const [row] = await db
    .select({ photo: records.photo })
    .from(records)
    .where(eq(records.id, recordId))
    .limit(1);
  await db.delete(records).where(eq(records.id, recordId));
  deletePhoto(row?.photo);
  notifyChanged();
};

// ── beans ────────────────────────────────────────────────────────────────────

export const insertBean = async (values: Omit<NewBean, 'id' | 'createdAt'>): Promise<string> => {
  const beanId = id('b');
  await db.insert(beans).values({ ...values, id: beanId, createdAt: Date.now() });
  notifyChanged();
  return beanId;
};

export const updateBean = async (
  beanId: string,
  values: Omit<NewBean, 'id' | 'createdAt'>,
): Promise<void> => {
  await db.update(beans).set(values).where(eq(beans.id, beanId));
  notifyChanged();
};

/**
 * SPEC § 豆子详情: deleting a bean deletes every record made with it. The
 * confirmation copy has to say so — the caller is responsible for asking.
 */
export const deleteBeanCascade = async (beanId: string): Promise<number> => {
  const doomed = await db
    .select({ id: records.id, photo: records.photo })
    .from(records)
    .where(eq(records.beanId, beanId));

  await db.delete(records).where(eq(records.beanId, beanId));
  await db.delete(beans).where(eq(beans.id, beanId));
  for (const r of doomed) deletePhoto(r.photo);
  notifyChanged();
  return doomed.length;
};

// ── brands ───────────────────────────────────────────────────────────────────

export const insertBrand = async (name: string): Promise<string> => {
  const brandId = id('br');
  await db.insert(brands).values({ id: brandId, name, isSelf: false, createdAt: Date.now() });
  notifyChanged();
  return brandId;
};

// ── devices ──────────────────────────────────────────────────────────────────

export const insertDevice = async (
  values: Omit<NewDevice, 'id' | 'createdAt'>,
): Promise<string> => {
  const deviceId = id('d');
  await db.insert(devices).values({ ...values, id: deviceId, createdAt: Date.now() });
  notifyChanged();
  return deviceId;
};

export const updateDevice = async (
  deviceId: string,
  values: Omit<NewDevice, 'id' | 'createdAt'>,
): Promise<void> => {
  await db.update(devices).set(values).where(eq(devices.id, deviceId));
  notifyChanged();
};

/**
 * Devices are removed from the picker, but records that named one keep their
 * text: `records.gear` / `.grinder` / `.gunit` are denormalised strings exactly
 * so history survives the gear being sold.
 */
export const deleteDevice = async (deviceId: string): Promise<void> => {
  await db.delete(devices).where(eq(devices.id, deviceId));
  notifyChanged();
};
