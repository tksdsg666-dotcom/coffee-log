/**
 * Tests for the 统计 month view. Run with `npm test`.
 *
 * Calendar maths is where off-by-one errors hide: month lengths, leap years,
 * the Sunday-to-Monday shift, and the year rollover all have to be right or the
 * grid silently misaligns by a column.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CoffeeRecord } from '@/db/schema';
import {
  cupsByDay,
  intensity,
  monthGrid,
  monthSummary,
  monthsWithRecords,
  shiftMonth,
} from './calendar.ts';

let seq = 0;
const cup = (over: Partial<CoffeeRecord>): CoffeeRecord =>
  ({
    id: `r${(seq += 1)}`,
    year: 2026,
    mon: 8,
    day: 1,
    time: '08:00',
    drankAtMs: 0,
    method: '滴滤',
    brandId: 'self',
    beanId: null,
    ice: null,
    rating: null,
    note: '',
    photo: null,
    gear: null,
    grinder: null,
    gunit: null,
    dose: null,
    water: null,
    yieldG: null,
    milk: null,
    grind: null,
    tempC: null,
    sec: null,
    hours: null,
    createdAt: 0,
    ...over,
  }) as CoffeeRecord;

// ── grid ─────────────────────────────────────────────────────────────────────

test('monthGrid pads to whole weeks and keeps every day exactly once', () => {
  const weeks = monthGrid(2026, 8); // Aug 2026 starts on a Saturday
  assert.ok(weeks.every((w) => w.length === 7), 'every row holds seven cells');

  const days = weeks.flat().filter((d): d is number => d != null);
  assert.equal(days.length, 31);
  assert.deepEqual(days, Array.from({ length: 31 }, (_, i) => i + 1));
});

test('monthGrid puts the 1st under the right weekday, Monday-first', () => {
  // 1 Aug 2026 is a Saturday, so it belongs in the sixth column.
  assert.equal(monthGrid(2026, 8)[0]?.indexOf(1), 5);
  // 1 Jun 2026 is a Monday: first column, no padding at all.
  assert.equal(monthGrid(2026, 6)[0]?.indexOf(1), 0);
  // 1 Nov 2026 is a Sunday: last column.
  assert.equal(monthGrid(2026, 11)[0]?.indexOf(1), 6);
});

test('monthGrid handles February, leap and common', () => {
  assert.equal(monthGrid(2024, 2).flat().filter(Boolean).length, 29);
  assert.equal(monthGrid(2026, 2).flat().filter(Boolean).length, 28);
});

// ── counting ─────────────────────────────────────────────────────────────────

test('cupsByDay tallies only the month asked for', () => {
  const counts = cupsByDay(
    [
      cup({ day: 3 }),
      cup({ day: 3 }),
      cup({ day: 5 }),
      cup({ mon: 7, day: 3 }),
      cup({ year: 2025, day: 3 }),
    ],
    2026,
    8,
  );
  assert.equal(counts.get(3), 2, 'July and last year are excluded');
  assert.equal(counts.get(5), 1);
  assert.equal(counts.size, 2);
});

test('intensity saturates at three cups', () => {
  assert.equal(intensity(0), 0);
  assert.equal(intensity(1), 1);
  assert.equal(intensity(2), 2);
  assert.equal(intensity(3), 3);
  assert.equal(intensity(9), 3);
});

// ── summary ──────────────────────────────────────────────────────────────────

test('monthSummary counts cups, days and methods', () => {
  const s = monthSummary(
    [
      cup({ day: 1, method: '美式' }),
      cup({ day: 1, method: '奶咖' }),
      cup({ day: 2, method: '美式' }),
      cup({ day: 9, method: '滴滤' }),
      cup({ mon: 7, day: 9, method: '滴滤' }),
    ],
    2026,
    8,
  );
  assert.equal(s.cups, 4, 'the July cup is not counted');
  assert.equal(s.activeDays, 3);
  assert.deepEqual(
    s.byMethod.map((m) => [m.method, m.count]),
    [
      ['美式', 2],
      ['滴滤', 1],
      ['奶咖', 1],
    ],
    // 滴滤 precedes 奶咖 in METHODS, so the tie resolves the same way on every
    // engine — locale collation would not.
    'sorted by count, then by the order METHODS declares',
  );
  assert.equal(s.byMethod[0]?.pct, 50);
});

test('monthSummary finds the longest run of consecutive days', () => {
  const s = monthSummary(
    [cup({ day: 4 }), cup({ day: 5 }), cup({ day: 6 }), cup({ day: 20 })],
    2026,
    8,
  );
  assert.equal(s.bestStreak, 3);
});

test('a streak does not wrap across the gap at the end of the month', () => {
  const s = monthSummary([cup({ day: 31 }), cup({ mon: 9, day: 1 })], 2026, 8);
  assert.equal(s.bestStreak, 1);
});

test('monthSummary is safe on an empty month', () => {
  const s = monthSummary([], 2026, 8);
  assert.deepEqual(s, { cups: 0, activeDays: 0, bestStreak: 0, byMethod: [] });
});

// ── navigation ───────────────────────────────────────────────────────────────

test('shiftMonth rolls the year over in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, mon: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, mon: 12 });
  assert.deepEqual(shiftMonth(2026, 8, 0), { year: 2026, mon: 8 });
  assert.deepEqual(shiftMonth(2026, 3, -14), { year: 2025, mon: 1 });
});

test('monthsWithRecords lists each month once, newest first', () => {
  const months = monthsWithRecords([
    cup({ year: 2026, mon: 8 }),
    cup({ year: 2026, mon: 8 }),
    cup({ year: 2025, mon: 12 }),
    cup({ year: 2026, mon: 1 }),
  ]);
  assert.deepEqual(months, [
    { year: 2026, mon: 8 },
    { year: 2026, mon: 1 },
    { year: 2025, mon: 12 },
  ]);
});
