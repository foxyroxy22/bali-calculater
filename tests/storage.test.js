import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadEntries, saveEntries, loadLastRate, saveLastRate, loadLastTaxRates, saveLastTaxRates
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

test('loadLastRate defaults to 8.03 when unset', () => {
  assert.equal(loadLastRate('shared', new FakeStorage()), 8.03);
});

test('saveLastRate then loadLastRate round-trips per tab', () => {
  const storage = new FakeStorage();
  saveLastRate('shared', 8.5, storage);
  saveLastRate('personal', 9.1, storage);
  assert.equal(loadLastRate('shared', storage), 8.5);
  assert.equal(loadLastRate('personal', storage), 9.1);
});

test('loadLastTaxRates defaults to 10/10 when unset', () => {
  assert.deepEqual(loadLastTaxRates(new FakeStorage()), { tax_rate: 10, service_rate: 10 });
});

test('saveLastTaxRates then loadLastTaxRates round-trips', () => {
  const storage = new FakeStorage();
  saveLastTaxRates(5, 7, storage);
  assert.deepEqual(loadLastTaxRates(storage), { tax_rate: 5, service_rate: 7 });
});
