import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEntry, addEntry, updateEntry, removeEntry, filterByTab, sortByDateDesc, sumTotals
} from '../js/entries.js';

const sampleItems = [{ name: 'Nasi Goreng', price_idr: 50000 }];
let idCounter = 0;
const testIdGen = () => `id-${++idCounter}`;

test('createEntry computes totals and assigns id', () => {
  const entry = createEntry({
    tab_type: 'shared',
    date: '2026-08-01T10:00:00.000Z',
    items: sampleItems,
    tax_mode: 'plus',
    tax_rate: 10,
    service_rate: 10,
    fx_rate_snapshot: 8.03,
    memo: '우붓 맛집'
  }, testIdGen);
  assert.equal(entry.id, 'id-1');
  assert.equal(entry.subtotal_idr, 50000);
  assert.equal(entry.extra_idr, 5000);
  assert.equal(entry.total_idr, 55000);
  assert.equal(entry.total_krw, 4417);
  assert.equal(entry.memo, '우붓 맛집');
});

test('createEntry defaults memo to empty string', () => {
  const entry = createEntry({
    tab_type: 'personal', date: '2026-08-01T10:00:00.000Z', items: sampleItems,
    tax_mode: 'none', tax_rate: 0, service_rate: 0, fx_rate_snapshot: 8.03
  }, testIdGen);
  assert.equal(entry.memo, '');
});

test('addEntry prepends new entry', () => {
  const existing = [{ id: 'old' }];
  const result = addEntry(existing, { id: 'new' });
  assert.deepEqual(result, [{ id: 'new' }, { id: 'old' }]);
});

test('updateEntry recomputes totals when items change', () => {
  const entry = createEntry({
    tab_type: 'shared', date: '2026-08-01T10:00:00.000Z', items: sampleItems,
    tax_mode: 'none', tax_rate: 0, service_rate: 0, fx_rate_snapshot: 8.03
  }, testIdGen);
  const updated = updateEntry([entry], entry.id, { items: [{ name: 'Nasi Goreng', price_idr: 100000 }] });
  assert.equal(updated[0].subtotal_idr, 100000);
  assert.equal(updated[0].total_idr, 100000);
});

test('updateEntry recomputes total_krw when fx_rate_snapshot changes', () => {
  const entry = createEntry({
    tab_type: 'shared', date: '2026-08-01T10:00:00.000Z', items: sampleItems,
    tax_mode: 'none', tax_rate: 0, service_rate: 0, fx_rate_snapshot: 8.03
  }, testIdGen);
  const updated = updateEntry([entry], entry.id, { fx_rate_snapshot: 9 });
  assert.equal(updated[0].total_krw, 4500);
});

test('removeEntry drops matching id', () => {
  const result = removeEntry([{ id: 'a' }, { id: 'b' }], 'a');
  assert.deepEqual(result, [{ id: 'b' }]);
});

test('filterByTab keeps only matching tab_type', () => {
  const entries = [{ tab_type: 'shared' }, { tab_type: 'personal' }];
  assert.deepEqual(filterByTab(entries, 'personal'), [{ tab_type: 'personal' }]);
});

test('sortByDateDesc orders newest first', () => {
  const entries = [{ date: '2026-08-01' }, { date: '2026-08-03' }, { date: '2026-08-02' }];
  const sorted = sortByDateDesc(entries);
  assert.deepEqual(sorted.map((e) => e.date), ['2026-08-03', '2026-08-02', '2026-08-01']);
});

test('sumTotals adds idr and krw across entries', () => {
  const entries = [{ total_idr: 100, total_krw: 8 }, { total_idr: 200, total_krw: 16 }];
  assert.deepEqual(sumTotals(entries), { total_idr: 300, total_krw: 24 });
});
