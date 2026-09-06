/**
 * Getting the backup JSON out of the app and back in — the native half.
 *
 * Kept apart from `backup.ts` so the part that knows about tables stays
 * platform-free: only the file handoff differs between iOS and the browser.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Writes the file and opens the share sheet.
 * Returns false when the device has no share sheet — the file still exists,
 * but there is no way to hand it to the user, and the caller has to say so.
 */
export const saveBackupFile = async (filename: string, json: string): Promise<boolean> => {
  const dir = new Directory(Paths.cache, 'export');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  const file = new File(dir, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: '导出咖啡记录',
    UTI: 'public.json',
  });
  return true;
};

/** The picked file's text, or null if the user backed out. */
export const pickBackupFile = async (): Promise<string | null> => {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;
  return new File(asset.uri).text();
};
