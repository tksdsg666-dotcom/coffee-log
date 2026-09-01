/**
 * The tolerate-or-throw policy behind the rescue export.
 *
 * It lives in its own module with no imports so it can be exercised directly
 * under Node — `backup.ts` itself pulls in expo-file-system, expo-sharing and
 * the live SQLite connection, none of which exist outside the app.
 */
export const readTable = async <T>(
  name: string,
  read: () => Promise<T[]>,
  /**
   * false — a failing read throws, so a routine export never silently produces
   * a partial file the user would mistake for a whole one.
   * true — a failing read yields [] and pushes `name` onto `unreadable`, which
   * is what the startup-failure escape hatch needs: a half-migrated database
   * should still give up whatever is still readable.
   */
  rescue: boolean,
  unreadable: string[],
): Promise<T[]> => {
  if (!rescue) return read();
  try {
    return await read();
  } catch {
    unreadable.push(name);
    return [];
  }
};
