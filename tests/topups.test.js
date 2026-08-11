import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTopup, addTopup, updateTopup, removeTopup, filterByTab, sortByDateDesc,
  computeAverageRate, sumIdr
} from '../js/topups.js';

let idCounter = 0;
const testIdGen = () => `topup-${++idCounter}`;

test('createTopup assigns id and keeps fields', () => {
  const topup = createTopup({ tab_type: 'shared', date: '2026-08-14', krw_amount: 803000, idr_amount: 10000000 }, testIdGen);
  assert.equal(topup.id, 'topup-1');
  assert.equal(topup.tab_type, 'shared');
  assert.equal(topup.date, '2026-08-14');
  assert.equal(topup.krw_amount, 803000);
  assert.equal(topup.idr_amount, 10000000);
});

test('addTopup prepends new topup', () => {
  const result = addTopup([{ id: 'old' }], { id: 'new' });
  assert.deepEqual(result, [{ id: 'new' }, { id: 'old' }]);
});

test('updateTopup merges patch into matching id only', () => {
  const topups = [{ id: 'a', krw_amount: 100 }, { id: 'b', krw_amount: 200 }];
  const result = updateTopup(topups, 'a', { krw_amount: 150 });
  assert.deepEqual(result, [{ id: 'a', krw_amount: 150 }, { id: 'b', krw_amount: 200 }]);
});

test('removeTopup drops matching id', () => {
  const result = removeTopup([{ id: 'a' }, { id: 'b' }], 'a');
  assert.deepEqual(result, [{ id: 'b' }]);
});

test('filterByTab keeps only matching tab_type', () => {
  const topups = [{ tab_type: 'shared' }, { tab_type: 'personal' }];
  assert.deepEqual(filterByTab(topups, 'personal'), [{ tab_type: 'personal' }]);
});

test('sortByDateDesc orders newest first', () => {
  const topups = [{ date: '2026-08-14' }, { date: '2026-08-16' }, { date: '2026-08-15' }];
  const sorted = sortByDateDesc(topups);
  assert.deepEqual(sorted.map((t) => t.date), ['2026-08-16', '2026-08-15', '2026-08-14']);
});

test('computeAverageRate returns null when no topups', () => {
  assert.equal(computeAverageRate([]), null);
});

test('computeAverageRate returns weighted average across topups', () => {
  const topups = [
    { krw_amount: 803000, idr_amount: 10000000 },
    { krw_amount: 850000, idr_amount: 10000000 }
  ];
  assert.equal(computeAverageRate(topups), 8.265);
});

test('sumIdr adds idr_amount across topups', () => {
  const topups = [{ idr_amount: 100 }, { idr_amount: 200 }];
  assert.equal(sumIdr(topups), 300);
});
