/**
 * Tests for the rescue path in the backup builder. Run with `npm test`.
 *
 * The point of `rescue: true` is that it must survive a database that is only
 * partly there — that is the whole situation it exists for. `readTable` is
 * imported from the module the exporter actually calls, so a change to that
 * policy breaks these tests rather than passing against a copy of it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readTable } from './tolerantRead.ts';

const ok = <T>(rows: T[]) => () => Promise.resolve(rows);
const boom = (msg: string) => () => Promise.reject(new Error(msg));

test('a normal export lets a failing table throw', async () => {
  const unreadable: string[] = [];
  await assert.rejects(
    () => readTable('records', boom('no such table: records'), false, unreadable),
    /no such table/,
    'without rescue the caller must see the real failure, not an empty export',
  );
  assert.deepEqual(unreadable, []);
});

test('a rescue export yields an empty table and records the name', async () => {
  const unreadable: string[] = [];
  const rows = await readTable('records', boom('no such table: records'), true, unreadable);
  assert.deepEqual(rows, []);
  assert.deepEqual(unreadable, ['records']);
});

test('a rescue export keeps the tables that still read', async () => {
  const unreadable: string[] = [];
  const beans = await readTable('beans', ok([{ id: 'b1' }]), true, unreadable);
  const records = await readTable('records', boom('malformed'), true, unreadable);
  const devices = await readTable('devices', ok([{ id: 'd1' }]), true, unreadable);

  assert.equal(beans.length, 1, 'a readable table survives a neighbour failing');
  assert.equal(devices.length, 1);
  assert.equal(records.length, 0);
  assert.deepEqual(unreadable, ['records'], 'only the broken table is named');
});

test('a rescue export survives every table being gone', async () => {
  const unreadable: string[] = [];
  for (const name of ['brands', 'beans', 'devices', 'records']) {
    const rows = await readTable(name, boom('no such table'), true, unreadable);
    assert.deepEqual(rows, []);
  }
  assert.deepEqual(unreadable, ['brands', 'beans', 'devices', 'records']);
});
