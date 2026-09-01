/**
 * Tests for bean ordering. Run with `npm test`.
 *
 * The ordering must be total — every comparison falls through to a tiebreak —
 * or two beans swap places between renders and the list visibly reshuffles.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Bean, CoffeeRecord } from '@/db/schema';
import { beanUsage, sortByLastDrunk } from './beanOrder.ts';

const NOW = new Date(2026, 7, 31, 12, 0, 0).getTime();
const daysAgo = (n: number) => NOW - n * 86_400_000;

const bean = (id: string, createdAt = 0): Bean =>
  ({ id, name: id, roast: '中浅烘', mine: true, swatch: 'token:accent', createdAt }) as Bean;

let seq = 0;
const cup = (beanId: string | null, drankAtMs: number): CoffeeRecord =>
  ({
    id: `r${(seq += 1)}`,
    year: 2026,
    mon: 8,
    day: 1,
    time: '08:00',
    drankAtMs,
    method: '滴滤',
    brandId: 'self',
    beanId,
    createdAt: 0,
    note: '',
  }) as CoffeeRecord;

test('beanUsage keeps the latest cup per bean', () => {
  const u = beanUsage([cup('a', daysAgo(9)), cup('a', daysAgo(1)), cup('a', daysAgo(30))]);
  assert.equal(u.get('a')?.lastDrankAtMs, daysAgo(1));
});

test('beanUsage ignores cups with no bean', () => {
  const u = beanUsage([cup(null, daysAgo(1)), cup('a', daysAgo(1))]);
  assert.equal(u.size, 1);
});

test('sortByLastDrunk ignores how often, only how recently', () => {
  const beans = [bean('often'), bean('once')];
  const u = beanUsage([
    cup('often', daysAgo(9)),
    cup('often', daysAgo(10)),
    cup('once', daysAgo(1)),
  ]);
  assert.deepEqual(
    sortByLastDrunk(beans, u).map((x) => x.id),
    ['once', 'often'],
  );
});

test('never-drunk beans sort last, newest first', () => {
  const beans = [bean('n1', 10), bean('drunk', 5), bean('n2', 20)];
  const u = beanUsage([cup('drunk', daysAgo(50))]);
  assert.deepEqual(
    sortByLastDrunk(beans, u).map((x) => x.id),
    ['drunk', 'n2', 'n1'],
  );
});

test('a bean drunk long ago still outranks one never drunk', () => {
  const beans = [bean('never', 100), bean('old', 1)];
  const u = beanUsage([cup('old', daysAgo(300))]);
  assert.deepEqual(
    sortByLastDrunk(beans, u).map((x) => x.id),
    ['old', 'never'],
  );
});

test('beans with no history at all fall back to newest first', () => {
  const beans = [bean('older', 10), bean('newer', 20)];
  assert.deepEqual(
    sortByLastDrunk(beans, new Map()).map((x) => x.id),
    ['newer', 'older'],
  );
});

test('sortByLastDrunk does not mutate its input', () => {
  const beans = [bean('a'), bean('b')];
  const u = beanUsage([cup('b', daysAgo(1))]);
  sortByLastDrunk(beans, u);
  assert.deepEqual(
    beans.map((x) => x.id),
    ['a', 'b'],
  );
});
