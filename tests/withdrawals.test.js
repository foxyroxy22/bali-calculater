import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWithdrawal, addWithdrawal, updateWithdrawal, removeWithdrawal,
  filterByTab, sortByDateDesc, sumIdr, sumCardDeductionIdr
} from '../js/withdrawals.js';

let idCounter = 0;
const testIdGen = () => `withdrawal-${++idCounter}`;

test('createWithdrawal assigns id and keeps fields', () => {
  const withdrawal = createWithdrawal(
    { tab_type: 'shared', date: '2026-08-15', idr_amount: 500000, fee_idr: 25000 },
    testIdGen
  );
  assert.equal(withdrawal.id, 'withdrawal-1');
  assert.equal(withdrawal.tab_type, 'shared');
  assert.equal(withdrawal.date, '2026-08-15');
  assert.equal(withdrawal.idr_amount, 500000);
  assert.equal(withdrawal.fee_idr, 25000);
});

test('createWithdrawal defaults fee_idr to 0 when omitted', () => {
  const withdrawal = createWithdrawal({ tab_type: 'shared', date: '2026-08-15', idr_amount: 500000 }, testIdGen);
  assert.equal(withdrawal.fee_idr, 0);
});

test('addWithdrawal prepends new withdrawal', () => {
  const result = addWithdrawal([{ id: 'old' }], { id: 'new' });
  assert.deepEqual(result, [{ id: 'new' }, { id: 'old' }]);
});

test('updateWithdrawal merges patch into matching id only', () => {
  const withdrawals = [{ id: 'a', idr_amount: 100 }, { id: 'b', idr_amount: 200 }];
  const result = updateWithdrawal(withdrawals, 'a', { idr_amount: 150 });
  assert.deepEqual(result, [{ id: 'a', idr_amount: 150 }, { id: 'b', idr_amount: 200 }]);
});

test('removeWithdrawal drops matching id', () => {
  const result = removeWithdrawal([{ id: 'a' }, { id: 'b' }], 'a');
  assert.deepEqual(result, [{ id: 'b' }]);
});

test('filterByTab keeps only matching tab_type', () => {
  const withdrawals = [{ tab_type: 'shared' }, { tab_type: 'personal' }];
  assert.deepEqual(filterByTab(withdrawals, 'personal'), [{ tab_type: 'personal' }]);
});

test('sortByDateDesc orders newest first', () => {
  const withdrawals = [{ date: '2026-08-14' }, { date: '2026-08-16' }, { date: '2026-08-15' }];
  const sorted = sortByDateDesc(withdrawals);
  assert.deepEqual(sorted.map((w) => w.date), ['2026-08-16', '2026-08-15', '2026-08-14']);
});

test('sumIdr adds idr_amount across withdrawals (excludes fee)', () => {
  const withdrawals = [{ idr_amount: 100, fee_idr: 10 }, { idr_amount: 200, fee_idr: 20 }];
  assert.equal(sumIdr(withdrawals), 300);
});

test('sumCardDeductionIdr adds idr_amount plus fee_idr across withdrawals', () => {
  const withdrawals = [{ idr_amount: 100, fee_idr: 10 }, { idr_amount: 200, fee_idr: 20 }];
  assert.equal(sumCardDeductionIdr(withdrawals), 330);
});
