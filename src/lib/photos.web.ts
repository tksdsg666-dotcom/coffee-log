/**
 * Photo storage — the web half.
 *
 * IndexedDB rather than OPFS, even though the database itself lives in OPFS:
 * IndexedDB stores a Blob directly and has been available on every iOS Safari
 * for years, while writing to OPFS from the main thread needs
 * `createWritable()`, which Safari only grew in 17.4. Durability is identical —
 * `navigator.storage.persist()` protects the whole origin, both stores at once.
 *
 * Records still hold a bare filename. It is a key here rather than a path, but
 * keeping the same shape means a backup exported on the phone and imported in
 * the browser still lines its photo references up.
 */
const DB_NAME = 'coffee-log-photos';
const STORE = 'photos';

let opening: Promise<IDBDatabase> | null = null;

const open = (): Promise<IDBDatabase> => {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('照片库打不开'));
  });
  return opening;
};

const run = async <T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('照片读写失败'));
  });
};

/**
 * filename → object URL. Never revoked on read: an object URL that is still on
 * screen would turn into a broken image, and a handful of photos costs nothing.
 * Deleting a photo does revoke, since nothing should be showing it by then.
 */
const urls = new Map<string, string>();

const forget = (filename: string) => {
  const url = urls.get(filename);
  if (url) URL.revokeObjectURL(url);
  urls.delete(filename);
};

export const cachedPhotoUri = (filename: string | null | undefined): string | null =>
  (filename ? urls.get(filename) : null) ?? null;

export const resolvePhotoUri = async (
  filename: string | null | undefined,
): Promise<string | null> => {
  if (!filename) return null;
  const known = urls.get(filename);
  if (known) return known;
  try {
    const blob = await run<Blob | undefined>('readonly', (store) => store.get(filename));
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.set(filename, url);
    return url;
  } catch {
    return null;
  }
};

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
};

export const savePhoto = async (sourceUri: string): Promise<string> => {
  // The picker gives back a blob: or data: URL; fetch reads both.
  const blob = await (await fetch(sourceUri)).blob();
  const ext = EXT[blob.type] ?? 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await run('readwrite', (store) => store.put(blob, filename));
  // Seeded now so the preview renders without a round trip.
  urls.set(filename, URL.createObjectURL(blob));
  return filename;
};

export const deletePhoto = async (filename: string | null | undefined): Promise<void> => {
  if (!filename) return;
  try {
    await run('readwrite', (store) => store.delete(filename));
  } catch {
    // The record is already gone; a stranded blob is not worth failing over.
  }
  forget(filename);
};

export const listPhotos = async (): Promise<string[]> => {
  try {
    const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return keys.filter((k): k is string => typeof k === 'string');
  } catch {
    return [];
  }
};

export const clearPhotos = async (): Promise<void> => {
  for (const filename of [...urls.keys()]) forget(filename);
  await run('readwrite', (store) => store.clear());
};
