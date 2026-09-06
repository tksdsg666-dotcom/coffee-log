/**
 * JSON export and import.
 *
 * This is the only route data has out of the app — there is no account and no
 * sync — so the export is a full, restorable dump of all four tables rather
 * than the flat CSV the prototype's settings row named. Photos are referenced
 * by filename, not embedded: base64-ing a month of pictures into one JSON file
 * would push it past what a share sheet will carry.
 */
import { db } from '@/db/client';
import { SELF_BRAND_ID } from '@/db/bootstrap';
import { beans, brands, devices, records, settings } from '@/db/schema';
import type { Bean, Brand, CoffeeRecord, Device, Setting } from '@/db/schema';
import { saveBackupFile } from './backupFile';
import { clearPhotos, listPhotos } from './photos';
import { readTable } from './tolerantRead.ts';
import { notifyChanged } from '@/db/live';

const FORMAT = 'coffee-log-backup';
const VERSION = 1;

export type Backup = {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  counts: { records: number; beans: number; brands: number; devices: number };
  /** Photo filenames referenced by records but not contained in this file. */
  photos: string[];
  /**
   * Tables that could not be read, present only on a rescue export. A backup
   * carrying this field is partial by definition — importing it restores what
   * survived, not the whole database.
   */
  unreadable?: string[];
  data: {
    brands: Brand[];
    beans: Bean[];
    devices: Device[];
    records: CoffeeRecord[];
    /** Optional so a v1 backup written before preferences existed still loads. */
    settings?: Setting[];
  };
};

/**
 * `rescue` is for the migration-failure escape hatch: a half-migrated database
 * can have some tables missing or malformed, and a read that throws would take
 * the whole export down with it. In rescue mode each table is read on its own
 * and a failure yields an empty list plus an entry in `unreadable`, so the user
 * gets out with whatever survived instead of nothing.
 */
export type BackupOptions = { rescue?: boolean };

export const buildBackup = async ({ rescue = false }: BackupOptions = {}): Promise<Backup> => {
  const unreadable: string[] = [];
  // Sequential, not Promise.all: in rescue mode one failing table must not
  // reject the others, and the ordering keeps the failure list readable.
  const brandRows = await readTable('brands', () => db.select().from(brands), rescue, unreadable);
  const beanRows = await readTable('beans', () => db.select().from(beans), rescue, unreadable);
  const deviceRows = await readTable('devices', () => db.select().from(devices), rescue, unreadable);
  const recordRows = await readTable('records', () => db.select().from(records), rescue, unreadable);
  const settingRows = await readTable(
    'settings',
    () => db.select().from(settings),
    rescue,
    unreadable,
  );

  const referenced = new Set(recordRows.map((r) => r.photo).filter((p): p is string => Boolean(p)));
  let onDisk: Set<string>;
  try {
    onDisk = new Set(await listPhotos());
  } catch {
    onDisk = new Set();
  }

  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      records: recordRows.length,
      beans: beanRows.length,
      brands: brandRows.length,
      devices: deviceRows.length,
    },
    photos: [...referenced].filter((p) => onDisk.has(p)),
    ...(unreadable.length > 0 ? { unreadable } : {}),
    data: {
      brands: brandRows,
      beans: beanRows,
      devices: deviceRows,
      records: recordRows,
      settings: settingRows,
    },
  };
};

/**
 * Hands the backup to the user — share sheet on the phone, download or share
 * in the browser. Returns the number of records written, or null when the
 * platform had no way to deliver the file.
 */
export const exportBackup = async (options: BackupOptions = {}): Promise<number | null> => {
  const backup = await buildBackup(options);
  const stamp = backup.exportedAt.slice(0, 10);
  const name = `coffee-log-${stamp}${options.rescue ? '-rescue' : ''}.json`;

  const handed = await saveBackupFile(name, JSON.stringify(backup, null, 2));
  return handed ? backup.counts.records : null;
};

export type ImportResult = {
  inserted: { records: number; beans: number; brands: number; devices: number };
  skipped: { records: number; beans: number; brands: number; devices: number };
  missingPhotos: number;
};

const isBackup = (v: unknown): v is Backup => {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Partial<Backup>;
  return b.format === FORMAT && typeof b.version === 'number' && typeof b.data === 'object';
};

/**
 * Merges a backup into the current database.
 *
 * Rows already present by id are skipped rather than overwritten: an import is
 * a restore or a merge from another device, and silently clobbering an edit the
 * user made since the export would be the worse default. Nothing is deleted.
 */
export const importBackup = async (json: string): Promise<ImportResult> => {
  const parsed: unknown = JSON.parse(json);
  if (!isBackup(parsed)) {
    throw new Error('这个文件不是咖啡记录的备份');
  }
  if (parsed.version > VERSION) {
    throw new Error('这个备份来自更新版本的 App，当前版本读不了');
  }

  const result: ImportResult = {
    inserted: { records: 0, beans: 0, brands: 0, devices: 0 },
    skipped: { records: 0, beans: 0, brands: 0, devices: 0 },
    missingPhotos: 0,
  };

  const existing = {
    brands: new Set((await db.select({ id: brands.id }).from(brands)).map((r) => r.id)),
    beans: new Set((await db.select({ id: beans.id }).from(beans)).map((r) => r.id)),
    devices: new Set((await db.select({ id: devices.id }).from(devices)).map((r) => r.id)),
    records: new Set((await db.select({ id: records.id }).from(records)).map((r) => r.id)),
  };

  const onDisk = new Set(await listPhotos());

  for (const row of parsed.data.brands ?? []) {
    // The reserved 自制 row always exists already.
    if (row.id === SELF_BRAND_ID || existing.brands.has(row.id)) {
      result.skipped.brands += 1;
      continue;
    }
    await db.insert(brands).values(row);
    result.inserted.brands += 1;
  }

  for (const row of parsed.data.beans ?? []) {
    if (existing.beans.has(row.id)) {
      result.skipped.beans += 1;
      continue;
    }
    await db.insert(beans).values(row);
    result.inserted.beans += 1;
  }

  for (const row of parsed.data.devices ?? []) {
    if (existing.devices.has(row.id)) {
      result.skipped.devices += 1;
      continue;
    }
    await db.insert(devices).values(row);
    result.inserted.devices += 1;
  }

  for (const row of parsed.data.records ?? []) {
    if (existing.records.has(row.id)) {
      result.skipped.records += 1;
      continue;
    }
    // Photos travel separately, so a restore on a fresh install has none of
    // them. Dropping the reference keeps the card from rendering a broken box.
    const photo = row.photo && onDisk.has(row.photo) ? row.photo : null;
    if (row.photo && !photo) result.missingPhotos += 1;
    await db.insert(records).values({ ...row, photo });
    result.inserted.records += 1;
  }

  // Preferences are overwritten rather than skipped: a restore should bring
  // back how the app was set up, and there is one row per key either way.
  for (const row of parsed.data.settings ?? []) {
    await db.insert(settings).values(row).onConflictDoUpdate({
      target: settings.key,
      set: { value: row.value },
    });
  }

  notifyChanged();
  return result;
};

/** Wipes every table except the reserved 自制 brand, and every stored photo. */
export const wipeAll = async (): Promise<void> => {
  await db.delete(records);
  await db.delete(beans);
  await db.delete(devices);
  await db.delete(brands);
  await db.delete(settings);

  await clearPhotos();

  await db.insert(brands).values({
    id: SELF_BRAND_ID,
    name: '自制',
    isSelf: true,
    createdAt: Date.now(),
  });
  notifyChanged();
};
