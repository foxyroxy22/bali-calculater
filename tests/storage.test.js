import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadEntries, saveEntries, loadTopups, saveTopups, loadLastTaxRates, saveLastTaxRates
} from '../js/storage.js';

class FakeStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
}

test('loadEntries returns empty array when nothing stored', () => {
  assert.deepEqual(loadEntries(new FakeStorage()), []);
});

test('saveEntries then loadEntries round-trips data', () => {
  const storage = new FakeStorage();
  saveEntries([{ id: 'a' }], storage);
  assert.deepEqual(loadEntries(storage), [{ id: 'a' }]);
});

test('loadEntries falls back to empty array on corrupt JSON', () => {
  const storage = new FakeStorage();
  storage.setItem('bali_expense_entries', '{not valid json');
  assert.deepEqual(loadEntries(storage), []);
});

test('loadTopups returns empty array when nothing stored', () => {
  assert.deepEqual(loadTopups(new FakeStorage()), []);
});

test('saveTopups then loadTopups round-trips data', () => {
  const storage = new FakeStorage();
  saveTopups([{ id: 'a' }], storage);
  assert.deepEqual(loadTopups(storage), [{ id: 'a' }]);
});

test('loadTopups falls back to empty array on corrupt JSON', () => {
  const storage = new FakeStorage();
  storage.setItem('bali_expense_topups', '{not valid json');
  assert.deepEqual(loadTopups(storage), []);
});

test('loadLastTaxRates defaults to 10/10 when unset', () => {
  assert.deepEqual(loadLastTaxRates(new FakeStorage()), { tax_rate: 10, service_rate: 10 });
});

test('saveLastTaxRates then loadLastTaxRates round-trips', () => {
  const storage = new FakeStorage();
  saveLastTaxRates(5, 7, storage);
  assert.deepEqual(loadLastTaxRates(storage), { tax_rate: 5, service_rate: 7 });
});
