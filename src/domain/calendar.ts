/**
 * The month view behind 统计: a calendar grid plus the totals beside it.
 *
 * SPEC § 统计 asked for dot matrices rather than charts, and this keeps that
 * spirit — one dot per cup for the method breakdown — but lays the month out as
 * a calendar so a streak is visible as a shape rather than as a number.
 *
 * Free of any React Native import, so it can be exercised directly.
 */
import type { CoffeeRecord } from '@/db/schema';
import { METHODS } from './methods.ts';

/** Monday-first, matching how calendars are printed in China. */
export const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

/**
 * The month laid out as weeks of seven, padded with nulls at both ends so every
 * row is full and the columns line up under WEEK_LABELS.
 */
export const monthGrid = (year: number, mon: number): (number | null)[][] => {
  const first = new Date(year, mon - 1, 1);
  // Day 0 of the next month is the last day of this one.
  const days = new Date(year, mon, 0).getDate();
  // getDay() is Sunday-based; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;

  const cells: (number | null)[] = Array<number | null>(lead).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

/** Cups per day for one month, keyed by day-of-month. */
export const cupsByDay = (
  records: CoffeeRecord[],
  year: number,
  mon: number,
): Map<number, number> => {
  const out = new Map<number, number>();
  for (const r of records) {
    if (r.year !== year || r.mon !== mon) continue;
    out.set(r.day, (out.get(r.day) ?? 0) + 1);
  }
  return out;
};

export type MethodTally = { method: string; count: number; pct: number };

/** Position in METHODS; anything unrecognised sorts last. */
const methodRank = (method: string): number => {
  const i = (METHODS as readonly string[]).indexOf(method);
  return i < 0 ? METHODS.length : i;
};

export type MonthSummary = {
  cups: number;
  /** Days with at least one cup — the lit circles on the grid. */
  activeDays: number;
  /** Longest run of consecutive lit days inside this month. */
  bestStreak: number;
  byMethod: MethodTally[];
};

export const monthSummary = (
  records: CoffeeRecord[],
  year: number,
  mon: number,
): MonthSummary => {
  const mine = records.filter((r) => r.year === year && r.mon === mon);
  const perDay = cupsByDay(mine, year, mon);

  const tally = new Map<string, number>();
  for (const r of mine) tally.set(r.method, (tally.get(r.method) ?? 0) + 1);

  const cups = mine.length;
  const byMethod = [...tally.entries()]
    .map(([method, count]) => ({
      method,
      count,
      pct: cups > 0 ? Math.round((count / cups) * 100) : 0,
    }))
    // Ties break by the order METHODS declares, never by locale collation:
    // `localeCompare` on Chinese needs ICU, which Node has and Hermes may not,
    // so the two would disagree about what this list looks like.
    .sort((a, b) => b.count - a.count || methodRank(a.method) - methodRank(b.method));

  const days = new Date(year, mon, 0).getDate();
  let bestStreak = 0;
  let run = 0;
  for (let d = 1; d <= days; d += 1) {
    if (perDay.has(d)) {
      run += 1;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  return { cups, activeDays: perDay.size, bestStreak, byMethod };
};

/** Steps the year/month pair by whole months, rolling the year over. */
export const shiftMonth = (
  year: number,
  mon: number,
  delta: number,
): { year: number; mon: number } => {
  const zero = year * 12 + (mon - 1) + delta;
  return { year: Math.floor(zero / 12), mon: (zero % 12) + 1 };
};

/**
 * How strongly to light a day: 0 for none, then 1–3 by cup count. The caller
 * maps these onto the accent ramp.
 */
export const intensity = (cups: number): 0 | 1 | 2 | 3 => {
  if (cups <= 0) return 0;
  if (cups === 1) return 1;
  if (cups === 2) return 2;
  return 3;
};

/** Months that actually have records, newest first — what the pager can reach. */
export const monthsWithRecords = (records: CoffeeRecord[]): { year: number; mon: number }[] => {
  const seen = new Set<number>();
  const out: { year: number; mon: number }[] = [];
  for (const r of records) {
    const key = r.year * 100 + r.mon;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ year: r.year, mon: r.mon });
  }
  return out.sort((a, b) => b.year * 100 + b.mon - (a.year * 100 + a.mon));
};
