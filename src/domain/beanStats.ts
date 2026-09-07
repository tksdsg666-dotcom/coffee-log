/**
 * The analysis behind 豆子详情 — the one screen in the app that does more than
 * record faithfully (SPEC § 已确认的产品决策 10).
 *
 * Two pieces: the three-up summary, and the side-by-side comparison of this
 * bean's 5-star cups. SPEC § 已确认的产品决策 4 rules out picking a single "best
 * cup" in favour of showing the 5-star ones next to each other and letting the
 * differences stand out.
 *
 * Deliberately free of any React Native import so it can be tested directly.
 */
import type { CoffeeRecord } from '@/db/schema';
import { mmss, num, one, ratioOf } from './format.ts';
import { grindText } from './grind.ts';
import { fieldsFor, isMethod, isSpecialBase, type Method, type SpecialBase } from './methods.ts';

export type BeanStats = {
  count: number;
  /** '—' when nothing is rated yet. */
  avg: string;
  /** The ratio that shows up most among 4- and 5-star cups. '—' when none. */
  bestRatio: string;
};

/** A record's 特调 base, narrowed; null for every other method. */
const baseOf = (r: CoffeeRecord): SpecialBase | null =>
  r.base && isSpecialBase(r.base) ? r.base : null;

export const beanStats = (records: CoffeeRecord[]): BeanStats => {
  const rated = records.filter((r) => typeof r.rating === 'number');
  const avg = rated.length
    ? one(rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length)
    : '—';

  const tally = new Map<string, number>();
  for (const r of records) {
    if (r.rating == null || r.rating < 4) continue;
    if (!isMethod(r.method)) continue;
    const q = ratioOf({ ...r, method: r.method, base: baseOf(r) });
    if (!q) continue;
    tally.set(q.value, (tally.get(q.value) ?? 0) + 1);
  }
  // A tie keeps whichever ratio was counted first, which — because records
  // arrive newest-first — means the more recent habit wins.
  let bestRatio = '—';
  let best = 0;
  for (const [value, n] of tally) {
    if (n > best) {
      best = n;
      bestRatio = value;
    }
  }

  return { count: records.length, avg, bestRatio };
};

export type CompareCell = { value: string; diff: boolean };
export type CompareRow = { label: string; diff: boolean; cells: CompareCell[] };

export type Comparison = {
  method: Method;
  columns: { recordId: string; date: string; brandId: string }[];
  rows: CompareRow[];
};

/** Fields whose unit is already implied by the value's own formatting. */
const UNIT_IN_VALUE = new Set(['time', 'g', '秒']);

/**
 * Builds the 5-star comparison table.
 *
 * SPEC § 豆子详情: take every 5-star cup, keep only those brewed the same way as
 * the first one, show at most three, and highlight the rows where they differ.
 * Returns null below two columns — one cup has nothing to compare against.
 *
 * `records` must be newest-first, which is how allRecords orders them: "the
 * first one" is then the most recent 5-star cup, so the comparison follows what
 * the user is drinking now rather than what they drank a year ago.
 */
export const buildComparison = (records: CoffeeRecord[]): Comparison | null => {
  const five = records.filter((r) => r.rating === 5);
  const first = five[0];
  if (!first || !isMethod(first.method)) return null;

  const method = first.method;
  const cols = five.filter((r) => r.method === method).slice(0, 3);
  if (cols.length < 2) return null;

  const rows: CompareRow[] = [];
  const mk = (label: string, values: string[], neverDiff = false): CompareRow => {
    const diff = !neverDiff && new Set(values).size > 1;
    return { label, diff, cells: values.map((value) => ({ value, diff })) };
  };

  /**
   * SPEC: 三杯磨豆机不同时研磨行不判差异 — two numbers on different grinders are
   * not on the same scale, so calling them "different" would be meaningless.
   */
  const mixedGrinders = new Set(cols.map((r) => r.grinder ?? '')).size > 1;

  for (const f of fieldsFor(method, baseOf(first))) {
    if (f.k === 'grind') {
      rows.push(
        mk(
          '研磨',
          cols.map((r) => (r.grind == null ? '—' : grindText(r.grind, r.gunit))),
          mixedGrinders,
        ),
      );
      continue;
    }
    const label = UNIT_IN_VALUE.has(f.unit) ? f.label : `${f.label}（${f.unit}）`;
    rows.push(
      mk(
        label,
        cols.map((r) => {
          const x = r[f.k];
          if (x == null) return '—';
          return f.unit === 'time' ? mmss(x) : num(x);
        }),
      ),
    );
  }

  rows.push(
    mk(
      '比例',
      cols.map((r) => ratioOf({ ...r, method, base: baseOf(r) })?.value ?? '—'),
    ),
  );

  // Gear rows go on top: which grinder produced a number is the context for
  // reading the number, so it has to be visible above it. Driven by whether the
  // records actually carry the field rather than by the method — 研磨 is asked
  // for on every method now, and a 研磨 row whose grinder is invisible cannot be
  // read (worse, the mixed-grinder rule above would silently stop flagging it).
  if (cols.some((r) => r.grinder)) {
    rows.unshift(mk('磨豆机', cols.map((r) => r.grinder ?? '—')));
  }
  if (cols.some((r) => r.gear)) {
    rows.unshift(mk('器具', cols.map((r) => r.gear ?? '—')));
  }

  return {
    method,
    columns: cols.map((r) => ({
      recordId: r.id,
      date: `${r.mon}/${r.day}`,
      brandId: r.brandId,
    })),
    rows,
  };
};
