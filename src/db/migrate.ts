/**
 * The migration runner.
 *
 * Drizzle's `useMigrations` only exists for the synchronous expo-sqlite driver,
 * which the async connection no longer uses. This replaces it, and it is
 * **bookkeeping-compatible on purpose**: same `__drizzle_migrations` table, same
 * columns, same "run everything stamped later than the last applied one" rule.
 * A device that already applied 0000–0002 under the old runner must not replay
 * them — the generated SQL is `CREATE TABLE` without `IF NOT EXISTS`, so a
 * replay would fail and take the app down with real data behind it.
 */
import { connection } from './client';
import migrations from './migrations/migrations';

const TABLE = '__drizzle_migrations';

type Journal = {
  entries: { idx: number; when: number; tag: string }[];
};

type Bundle = {
  journal: Journal;
  migrations: Record<string, string>;
};

/** Statements for one journal entry, in file order. */
const statementsFor = (bundle: Bundle, idx: number): string[] => {
  const key = `m${String(idx).padStart(4, '0')}`;
  const sql = bundle.migrations[key];
  if (sql == null) throw new Error(`迁移文件缺失：${key}`);
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

export const runMigrations = async (): Promise<void> => {
  const bundle = migrations as unknown as Bundle;
  const db = await connection();

  // Same shape drizzle creates, so an existing table is reused as-is.
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )`,
  );

  const [last] = await db.getAllAsync<{ created_at: number | null }>(
    `SELECT created_at FROM \`${TABLE}\` ORDER BY created_at DESC LIMIT 1`,
  );
  const appliedThrough = last?.created_at != null ? Number(last.created_at) : null;

  const pending = [...bundle.journal.entries]
    .sort((a, b) => a.when - b.when)
    .filter((entry) => appliedThrough == null || appliedThrough < entry.when);

  for (const entry of pending) {
    // One transaction per migration: a half-applied schema change is the worst
    // possible outcome, and stopping cleanly lets the rescue export still run.
    await db.withTransactionAsync(async () => {
      for (const statement of statementsFor(bundle, entry.idx)) {
        await db.execAsync(statement);
      }
      await db.runAsync(`INSERT INTO \`${TABLE}\` ("hash", "created_at") VALUES (?, ?)`, [
        '',
        entry.when,
      ]);
    });
  }
};
