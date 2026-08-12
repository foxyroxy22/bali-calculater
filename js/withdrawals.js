export function createWithdrawal(
  { tab_type, date, idr_amount, fee_idr },
  idGenerator = () => crypto.randomUUID()
) {
  return { id: idGenerator(), tab_type, date, idr_amount, fee_idr: fee_idr || 0 };
}

export function addWithdrawal(withdrawals, withdrawal) {
  return [withdrawal, ...withdrawals];
}

export function updateWithdrawal(withdrawals, id, patch) {
  return withdrawals.map((withdrawal) => (withdrawal.id === id ? { ...withdrawal, ...patch } : withdrawal));
}

export function removeWithdrawal(withdrawals, id) {
  return withdrawals.filter((withdrawal) => withdrawal.id !== id);
}

export function filterByTab(withdrawals, tabType) {
  return withdrawals.filter((withdrawal) => withdrawal.tab_type === tabType);
}

export function sortByDateDesc(withdrawals) {
  return [...withdrawals].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function sumIdr(withdrawals) {
  return withdrawals.reduce((sum, withdrawal) => sum + withdrawal.idr_amount, 0);
}

export function sumCardDeductionIdr(withdrawals) {
  return withdrawals.reduce((sum, withdrawal) => sum + withdrawal.idr_amount + withdrawal.fee_idr, 0);
}
