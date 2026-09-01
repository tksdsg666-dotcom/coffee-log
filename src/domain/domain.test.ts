/**
 * Smoke tests for the pure domain logic, runnable with `npm test`.
 *
 * These cover the rules that are easy to get subtly wrong and expensive to
 * catch by eye on a phone: the per-method ratios, the fixed order of the
 * timeline parameter string, and the snap-then-clamp behaviour that keeps a
 * grind setting inside its grinder's scale. Everything imported here is free of
 * React Native, which is why the method colours live in the theme instead.
 *
 * Run with: npm test
 *
 * Imports carry an explicit .ts extension because Node's ESM resolver does not
 * guess one; `allowImportingTsExtensions` in tsconfig keeps tsc happy with that.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CoffeeRecord } from '@/db/schema';
import { dayKey, dayLabel, mmss, paramDisplay, paramText, ratioOf } from './format.ts';
import { clampGrind, grindSpecOf, grindText, midpointDefault } from './grind.ts';
import {
  blankParams,
  defaultParams,
  fieldsFor,
  isMethod,
  isSpecialBase,
  METHODS,
  SPECIAL_BASES,
  type Method,
  type SpecialBase,
} from './methods.ts';

// ── ratios ───────────────────────────────────────────────────────────────────

test('ratioOf uses the right formula and label per method', () => {
  assert.deepEqual(ratioOf({ method: '滴滤', dose: 15, water: 240 }), {
    label: '粉水比',
    value: '1:16.0',
  });
  assert.deepEqual(ratioOf({ method: '冷萃', dose: 60, water: 600 }), {
    label: '粉水比',
    value: '1:10.0',
  });
  assert.deepEqual(ratioOf({ method: '美式', dose: 18, yieldG: 36 }), {
    label: '萃取比',
    value: '1:2.0',
  });
  assert.deepEqual(ratioOf({ method: '奶咖', yieldG: 36, milk: 180 }), {
    label: '奶咖比',
    value: '1:5.0',
  });
  // 特调 borrows whatever its base measures.
  assert.deepEqual(ratioOf({ method: '特调', base: '浓缩', dose: 18, yieldG: 36 }), {
    label: '萃取比',
    value: '1:2.0',
  });
  assert.deepEqual(ratioOf({ method: '特调', base: '冷萃', dose: 60, water: 600 }), {
    label: '粉水比',
    value: '1:10.0',
  });
  assert.deepEqual(ratioOf({ method: '特调', base: '滴滤', dose: 15, water: 240 }), {
    label: '粉水比',
    value: '1:16.0',
  });
  assert.equal(ratioOf({ method: '其他', dose: 18, yieldG: 36 }), null, '其他 measures nothing');
});

test('ratioOf returns null when either side is missing or zero', () => {
  assert.equal(ratioOf({ method: '滴滤', dose: 15, water: null }), null);
  assert.equal(ratioOf({ method: '滴滤', dose: null, water: 240 }), null);
  // A zero dose would divide to Infinity rather than reading as "not filled in".
  assert.equal(ratioOf({ method: '美式', dose: 0, yieldG: 36 }), null);
  assert.equal(ratioOf({ method: '奶咖', yieldG: 36, milk: null }), null);
});

test('美式 ratio ignores 加水, which is not part of the extraction', () => {
  const dry = ratioOf({ method: '美式', dose: 18, yieldG: 36, water: 0 });
  const wet = ratioOf({ method: '美式', dose: 18, yieldG: 36, water: 120 });
  assert.deepEqual(dry, wet);
});

// ── grind ────────────────────────────────────────────────────────────────────

const c40 = {
  id: 'd1',
  name: 'Comandante C40',
  kind: '手磨',
  isBrew: false,
  isGrinder: true,
  gstep: 1,
  gmin: 5,
  gmax: 40,
  gdef: 24,
  gunit: '格',
  createdAt: 0,
};

const huanci = { ...c40, name: '幻刺 Pro', gstep: 0.1, gmin: 3, gmax: 12, gdef: 5.6, gunit: '圈' };

test('grindSpecOf derives decimals from the step', () => {
  assert.equal(grindSpecOf(c40)?.dec, 0);
  assert.equal(grindSpecOf(huanci)?.dec, 1);
  assert.equal(grindSpecOf({ ...c40, isGrinder: false }), null);
  assert.equal(grindSpecOf(null), null);
});

test('clampGrind snaps to the step and clamps into range', () => {
  const spec = grindSpecOf(c40)!;
  assert.equal(clampGrind(24.4, spec), 24);
  assert.equal(clampGrind(24.6, spec), 25);
  assert.equal(clampGrind(99, spec), 40, 'above max clamps down');
  assert.equal(clampGrind(1, spec), 5, 'below min clamps up');
  assert.equal(clampGrind(null, spec), null, 'an empty value stays empty');
});

test('clampGrind keeps one decimal without float drift', () => {
  const spec = grindSpecOf(huanci)!;
  assert.equal(clampGrind(5.63, spec), 5.6);
  assert.equal(clampGrind(5.67, spec), 5.7);
  // 0.1 * 57 is 5.700000000000001 in binary floating point.
  assert.equal(clampGrind(5.7, spec), 5.7);
  assert.equal(clampGrind(20, spec), 12);
});

test('grindText carries each grinder its own unit', () => {
  assert.equal(grindText(24, '格'), '24格');
  assert.equal(grindText(5.6, '圈'), '5.6圈');
  assert.equal(grindText(7, '档'), '7档');
  // A whole number on a 圈 grinder still shows the decimal it was dialled at.
  assert.equal(grindText(6, '圈'), '6.0圈');
});

test('an explicit dec beats the unit-name guess', () => {
  // A 0.1-step grinder whose unit is 档, not 圈: without the spec's dec, a whole
  // number rendered as "6档" right next to a sibling "7.9档".
  assert.equal(grindText(6, '档'), '6档', 'the guess alone gets this wrong');
  assert.equal(grindText(6, '档', 1), '6.0档', 'the grinder spec fixes it');
  assert.equal(grindText(7.9, '档', 1), '7.9档');
  assert.equal(grindText(24, '格', 0), '24格', 'an integer grinder stays integer');
});

test('midpointDefault lands on a value the step can actually reach', () => {
  assert.equal(midpointDefault(5, 40, 1), 23);
  assert.equal(midpointDefault(3, 12, 0.1), 7.5);
  assert.equal(midpointDefault(1, 11, 1), 6);
});

// ── parameter string ─────────────────────────────────────────────────────────

const record = (over: Partial<CoffeeRecord>): CoffeeRecord =>
  ({
    id: 'r1',
    year: 2026,
    mon: 8,
    day: 26,
    time: '08:20',
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

test('paramText follows the order SPEC fixes', () => {
  assert.equal(
    paramText(
      record({
        gear: 'Fellow Ode Gen2',
        dose: 15,
        water: 240,
        grind: 7,
        grinder: 'Fellow Ode Gen2',
        gunit: '档',
        tempC: 93,
        sec: 140,
      }),
    ),
    'Fellow Ode Gen2 · 15g 粉 · 240g 水 · Fellow Ode Gen2 7档 · 93°C · 2:20',
  );
});

test('paramText labels 加水 separately and uses seconds for 美式', () => {
  assert.equal(
    paramText(record({ method: '美式', dose: 18, yieldG: 36, water: 120, sec: 27 })),
    '18g 粉 · 加水 120ml · 液重 36g · 27″',
  );
});

test('paramText omits every unfilled field rather than padding it', () => {
  assert.equal(paramText(record({ dose: 15 })), '15g 粉');
  assert.equal(paramText(record({})), '');
});

test('paramText says 液体 for 特调 and 奶 elsewhere', () => {
  assert.match(paramText(record({ method: '奶咖', yieldG: 36, milk: 180 })), /奶 180ml/);
  assert.match(paramText(record({ method: '特调', yieldG: 36, milk: 120 })), /液体 120ml/);
});

test('a grind of 0 still renders — it is a real setting, not an empty one', () => {
  // `if (r.grind)` would drop this; the code tests against null explicitly.
  assert.match(paramText(record({ grind: 0, gunit: '格' })), /研磨 0格/);
});

// ── formatting ───────────────────────────────────────────────────────────────

test('mmss pads the seconds', () => {
  assert.equal(mmss(140), '2:20');
  assert.equal(mmss(125), '2:05');
  assert.equal(mmss(30), '0:30');
});

test('paramDisplay renders an empty value as an em dash', () => {
  assert.equal(paramDisplay(null, 'g'), '—');
  assert.equal(paramDisplay(15, 'g'), '15g');
  assert.equal(paramDisplay(15.5, 'g'), '15.5g');
  assert.equal(paramDisplay(92, '°C'), '92°');
  assert.equal(paramDisplay(140, 'time'), '2:20');
  assert.equal(paramDisplay(27, '秒'), '27″');
  assert.equal(paramDisplay(5.6, '圈', 1), '5.6圈');
});

// ── dates ────────────────────────────────────────────────────────────────────

test('dayLabel names today and yesterday, then the weekday', () => {
  const now = new Date(2026, 7, 26); // Wed 26 Aug 2026
  assert.equal(dayLabel(2026, 8, 26, now), '今天');
  assert.equal(dayLabel(2026, 8, 25, now), '昨天');
  assert.equal(dayLabel(2026, 8, 24, now), '周一');
});

test('dayLabel is not fooled by a time of day', () => {
  const lateEvening = new Date(2026, 7, 26, 23, 55);
  assert.equal(dayLabel(2026, 8, 26, lateEvening), '今天');
});

test('dayKey sorts across a month and a year boundary', () => {
  assert.ok(dayKey(2026, 9, 1) > dayKey(2026, 8, 31));
  assert.ok(dayKey(2027, 1, 1) > dayKey(2026, 12, 31));
});

// ── method config ────────────────────────────────────────────────────────────

/** Every method, and every base for the one method that has bases. */
type Slot = { method: Method; base: SpecialBase | null };
const everySlot = (): Slot[] =>
  METHODS.flatMap((m): Slot[] =>
    m === '特调'
      ? SPECIAL_BASES.map((b) => ({ method: m, base: b }))
      : [{ method: m, base: null }],
  );

test('defaults sit inside their own field bounds', () => {
  for (const { method, base } of everySlot()) {
    const fields = fieldsFor(method, base);
    const blank = blankParams(method, base);
    const filled = defaultParams(method, base);
    for (const f of fields) {
      assert.equal(blank[f.k], null, `${method}.${f.k} should blank to null`);
      const d = filled[f.k];
      if (d != null) {
        assert.ok(d >= f.min, `${method}.${f.k} default ${d} is below its min ${f.min}`);
        if (f.max != null) {
          assert.ok(d <= f.max, `${method}.${f.k} default ${d} is above its max ${f.max}`);
        }
      }
    }
  }
});

test('其他 carries no parameters at all', () => {
  assert.equal(fieldsFor('其他', null).length, 0);
});

test('grind is only asked for on 滴滤', () => {
  for (const { method, base } of everySlot()) {
    const hasGrind = fieldsFor(method, base).some((f) => f.k === 'grind');
    assert.equal(hasGrind, method === '滴滤', `${method} grind field presence is wrong`);
  }
});

test('pressure rides along with the espresso family only', () => {
  const has = (m: Parameters<typeof fieldsFor>[0], b: Parameters<typeof fieldsFor>[1]) =>
    fieldsFor(m, b).some((f) => f.k === 'pressure');
  assert.ok(has('美式', null));
  assert.ok(has('奶咖', null));
  assert.ok(has('特调', '浓缩'));
  assert.ok(!has('滴滤', null), 'no pump behind a pour-over');
  assert.ok(!has('冷萃', null));
  assert.ok(!has('特调', '冷萃'));
  assert.ok(!has('特调', '滴滤'));
});

test('特调 takes its base extraction fields plus the other liquid', () => {
  assert.deepEqual(
    fieldsFor('特调', '浓缩').map((f) => f.k),
    ['dose', 'yieldG', 'sec', 'tempC', 'pressure', 'milk'],
  );
  assert.deepEqual(
    fieldsFor('特调', '冷萃').map((f) => f.k),
    ['dose', 'water', 'hours', 'milk'],
  );
  assert.deepEqual(
    fieldsFor('特调', '滴滤').map((f) => f.k),
    ['dose', 'water', 'tempC', 'sec', 'milk'],
  );
});

test('特调 with no base falls back to 浓缩 rather than breaking', () => {
  assert.deepEqual(fieldsFor('特调', null), fieldsFor('特调', '浓缩'));
});

test('isSpecialBase rejects a method name', () => {
  assert.ok(isSpecialBase('浓缩'));
  assert.ok(!isSpecialBase('美式'));
  assert.ok(!isSpecialBase(''));
});

test('isMethod rejects anything not in the enum', () => {
  assert.ok(isMethod('滴滤'));
  assert.ok(isMethod('特调'));
  assert.ok(isMethod('其他'));
  assert.ok(!isMethod('特调 & 其他'), 'the old combined label is gone');
  assert.ok(!isMethod('意式'));
  assert.ok(!isMethod(''));
});
