import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExtra, computeTotals, convertToKrw } from '../js/calc.js';

test('computeExtra returns 0 for none mode', () => {
  assert.equal(computeExtra(100000, 'none', 10, 10), 0);
});

test('computeExtra applies tax only for plus mode', () => {
  assert.equal(computeExtra(100000, 'plus', 10, 10), 10000);
});

test('computeExtra applies tax+service for plusplus mode', () => {
  assert.equal(computeExtra(100000, 'plusplus', 10, 10), 20000);
});

test('computeExtra throws on unknown mode', () => {
  assert.throws(() => computeExtra(100000, 'bogus', 10, 10));
});

test('computeTotals sums items and applies extra', () => {
  const items = [{ name: 'Nasi Goreng', price_idr: 50000 }, { name: 'Es Teh', price_idr: 15000 }];
  const result = computeTotals(items, 'plusplus', 10, 10);
  assert.equal(result.subtotal_idr, 65000);
  assert.equal(result.extra_idr, 13000);
  assert.equal(result.total_idr, 78000);
});

test('computeTotals with empty items returns zeros', () => {
  const result = computeTotals([], 'none', 10, 10);
  assert.deepEqual(result, { subtotal_idr: 0, extra_idr: 0, total_idr: 0 });
});

test('convertToKrw applies 100-IDR-based rate and rounds', () => {
  assert.equal(convertToKrw(78000, 8.03), 6263);
});

test('convertToKrw with zero rate returns 0', () => {
  assert.equal(convertToKrw(78000, 0), 0);
});
