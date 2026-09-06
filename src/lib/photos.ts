/**
 * Photo storage — the native half.
 *
 * expo-image-picker hands back a URI in the cache directory, which the system
 * is free to purge. Records therefore store only a bare filename, and the file
 * itself is copied into a `photos/` folder under the document directory, which
 * is not purged and survives reinstall-free upgrades. Resolving a filename to a
 * URI at render time also means the app's sandbox path can change between
 * launches (it does on iOS) without orphaning every photo.
 *
 * Everything a caller needs is exposed as a promise even where this platform
 * could answer synchronously, because `photos.web.ts` genuinely cannot — its
 * store is IndexedDB. `cachedPhotoUri` is the one sync escape hatch, used by
 * `usePhotoUri` to render without a flash when the answer is already known.
 */
import { Directory, File, Paths } from 'expo-file-system';

const FOLDER = 'photos';

const photoDir = () => new Directory(Paths.document, FOLDER);

const ensureDir = (): Directory => {
  const dir = photoDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/** Absolute `file://` URI for a stored photo filename. Always immediate here. */
export const cachedPhotoUri = (filename: string | null | undefined): string | null =>
  filename ? new File(photoDir(), filename).uri : null;

export const resolvePhotoUri = async (
  filename: string | null | undefined,
): Promise<string | null> => cachedPhotoUri(filename);

/**
 * Copies a picked image into permanent storage.
 * Returns the filename to write onto the record.
 */
export const savePhoto = async (sourceUri: string): Promise<string> => {
  const dir = ensureDir();
  const ext = sourceUri.split('?')[0]?.split('.').pop()?.toLowerCase();
  const safeExt = ext && /^[a-z0-9]{2,4}$/.test(ext) ? ext : 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const dest = new File(dir, filename);
  await new File(sourceUri).copy(dest);
  return filename;
};

/** Best-effort delete; a missing file is not an error worth surfacing. */
export const deletePhoto = async (filename: string | null | undefined): Promise<void> => {
  if (!filename) return;
  try {
    const file = new File(photoDir(), filename);
    if (file.exists) file.delete();
  } catch {
    // The record is already gone; a stranded file is not worth failing over.
  }
};

/** Filenames currently stored — used by the export/import housekeeping. */
export const listPhotos = async (): Promise<string[]> => {
  const dir = photoDir();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((f) => f.name);
};

/** Drops every stored photo. Only 清空所有数据 calls this. */
export const clearPhotos = async (): Promise<void> => {
  const dir = photoDir();
  if (dir.exists) dir.delete();
};
