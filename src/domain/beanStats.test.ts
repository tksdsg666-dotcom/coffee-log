/**
 * Tests for 豆子详情's analysis. Run with `npm test`.
 *
 * The comparison table is the one place the app draws a conclusion for the
 * user, so its filtering and its diff highlighting are worth pinning down —
 * especially the rule that suppresses the grind diff across mixed grinders.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CoffeeRecord } from '@/db/schema';
import { beanStats, buildComparison } from './beanStats.ts';

let seq = 0;
const rec = (over: Partial<CoffeeRecord>): CoffeeRecord =>
  ({
    id: `r${(seq += 1)}`,
    year: 2026,
    mon: 8,
    day: 26,
    time: '08:20',
    drankAtMs: 0,
    method: '滴滤',
    brandId: 'self',
    beanId: 'b1',
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

// ── summary ──────────────────────────────────────────────────────────────────

test('beanStats averages only the rated cups', () => {
  const s = beanStats([rec({ rating: 5 }), rec({ rating: 4 }), rec({ rating: null })]);
  assert.equal(s.count, 3, 'the count is every cup, rated or not');
  assert.equal(s.avg, '4.5', 'the average skips the unrated one');
});

test('beanStats reports an em dash when nothing is rated', () => {
  const s = beanStats([rec({}), rec({})]);
  assert.equal(s.avg, '—');
  assert.equal(s.bestRatio, '—');
});

test('beanStats is safe on an empty list', () => {
  assert.deepEqual(beanStats([]), { count: 0, avg: '—', bestRatio: '—' });
});

test('bestRatio takes the most common ratio among 4- and 5-star cups', () => {
  const s = beanStats([
    rec({ rating: 5, dose: 15, water: 240 }), // 1:16.0
    rec({ rating: 4, dose: 15, water: 240 }), // 1:16.0
    rec({ rating: 4, dose: 15, water: 225 }), // 1:15.0
  ]);
  assert.equal(s.bestRatio, '1:16.0');
});

test('bestRatio ignores cups rated below 4', () => {
  const s = beanStats([
    rec({ rating: 3, dose: 15, water: 225 }),
    rec({ rating: 3, dose: 15, water: 225 }),
    rec({ rating: 5, dose: 15, water: 240 }),
  ]);
  assert.equal(s.bestRatio, '1:16.0', 'two 3-star cups do not outvote one 5-star');
});

test('bestRatio breaks a tie toward the more recent habit', () => {
  // Records arrive newest-first, so the first ratio counted wins a tie.
  const s = beanStats([
    rec({ rating: 5, dose: 15, water: 240 }), // 1:16.0, newer
    rec({ rating: 5, dose: 15, water: 225 }), // 1:15.0, older
  ]);
  assert.equal(s.bestRatio, '1:16.0');
});

// ── comparison ───────────────────────────────────────────────────────────────

const pour = (over: Partial<CoffeeRecord>) =>
  rec({
    rating: 5,
    method: '滴滤',
    dose: 15,
    water: 240,
    tempC: 92,
    sec: 140,
    grind: 24,
    gunit: '格',
    grinder: 'Comandante C40',
    gear: 'Hario V60 02',
    ...over,
  });

test('buildComparison needs at least two 5-star cups', () => {
  assert.equal(buildComparison([]), null);
  assert.equal(buildComparison([pour({})]), null, 'one cup has nothing to compare to');
  assert.equal(
    buildComparison([rec({ rating: 4 }), rec({ rating: 4 })]),
    null,
    'only 5-star cups qualify',
  );
});

test('buildComparison keeps only the first cup’s method and caps at three', () => {
  const c = buildComparison([
    pour({ day: 26 }),
    rec({ rating: 5, method: '美式', dose: 18, yieldG: 36 }),
    pour({ day: 24 }),
    pour({ day: 23 }),
    pour({ day: 22 }),
  ]);
  assert.ok(c);
  assert.equal(c.method, '滴滤');
  assert.equal(c.columns.length, 3, 'at most three columns');
  assert.deepEqual(
    c.columns.map((x) => x.date),
    ['8/26', '8/24', '8/23'],
    'the 美式 cup is filtered out, not just skipped in the header',
  );
});

test('buildComparison flags only the rows that actually differ', () => {
  const c = buildComparison([pour({ day: 26, water: 240 }), pour({ day: 24, water: 255 })]);
  assert.ok(c);
  const byLabel = new Map(c.rows.map((r) => [r.label, r]));

  assert.equal(byLabel.get('水量')?.diff, true, '240 vs 255 differs');
  assert.equal(byLabel.get('粉量')?.diff, false, 'both 15g');
  assert.equal(byLabel.get('水温（°C）')?.diff, false, 'both 92');
  assert.equal(byLabel.get('比例')?.diff, true, 'the ratio moves with the water');
});

test('buildComparison suppresses the grind diff when the grinders differ', () => {
  const c = buildComparison([
    pour({ day: 26, grinder: 'Comandante C40', grind: 24, gunit: '格' }),
    pour({ day: 24, grinder: '幻刺 Pro', grind: 5.6, gunit: '圈' }),
  ]);
  assert.ok(c);
  const grind = c.rows.find((r) => r.label === '研磨');
  assert.equal(
    grind?.diff,
    false,
    '24格 and 5.6圈 are not on one scale, so the difference is meaningless',
  );
  assert.deepEqual(grind?.cells.map((x) => x.value), ['24格', '5.6圈']);
  assert.equal(
    c.rows.find((r) => r.label === '磨豆机')?.diff,
    true,
    'the grinder row itself still shows they differ',
  );
});

test('buildComparison does flag the grind when the grinder is the same', () => {
  const c = buildComparison([pour({ day: 26, grind: 24 }), pour({ day: 24, grind: 26 })]);
  assert.equal(c?.rows.find((r) => r.label === '研磨')?.diff, true);
});

test('gear rows sit above the parameters they explain', () => {
  const c = buildComparison([pour({ day: 26 }), pour({ day: 24 })]);
  assert.ok(c);
  assert.deepEqual(
    c.rows.map((r) => r.label),
    ['器具', '磨豆机', '粉量', '水量', '研磨', '水温（°C）', '时间', '比例'],
  );
});

test('non-滴滤 comparisons carry no gear rows', () => {
  const milk = (over: Partial<CoffeeRecord>) =>
    rec({ rating: 5, method: '奶咖', dose: 18, yieldG: 36, milk: 180, ...over });
  const c = buildComparison([milk({ day: 26 }), milk({ day: 24, milk: 200 })]);
  assert.ok(c);
  assert.deepEqual(
    c.rows.map((r) => r.label),
    ['浓缩粉量', '浓缩液重', '奶量（ml）', '水温（°C）', '压强（bar）', '比例'],
  );
  assert.equal(c.rows.find((r) => r.label === '奶量（ml）')?.diff, true);
});

test('an unfilled parameter shows as an em dash and counts as a difference', () => {
  const c = buildComparison([pour({ day: 26, tempC: 92 }), pour({ day: 24, tempC: null })]);
  assert.ok(c);
  const temp = c.rows.find((r) => r.label === '水温（°C）');
  assert.deepEqual(temp?.cells.map((x) => x.value), ['92', '—']);
  assert.equal(temp?.diff, true);
});

test('时间 renders as mm:ss, matching the timeline', () => {
  const c = buildComparison([pour({ day: 26, sec: 140 }), pour({ day: 24, sec: 125 })]);
  assert.deepEqual(
    c?.rows.find((r) => r.label === '时间')?.cells.map((x) => x.value),
    ['2:20', '2:05'],
  );
});
