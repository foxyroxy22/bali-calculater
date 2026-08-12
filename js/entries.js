import { computeTotals, convertToKrw } from './calc.js';

export function createEntry(
  { tab_type, date, items, tax_mode, tax_rate, service_rate, fx_rate_snapshot, memo, payment_method },
  idGenerator = () => crypto.randomUUID()
) {
  const { subtotal_idr, extra_idr, total_idr } = computeTotals(items, tax_mode, tax_rate, service_rate);
  const total_krw = convertToKrw(total_idr, fx_rate_snapshot);
  return {
    id: idGenerator(),
    tab_type,
    date,
    items,
    tax_mode,
    tax_rate,
    service_rate,
    subtotal_idr,
    extra_idr,
    total_idr,
    fx_rate_snapshot,
    total_krw,
    memo: memo || '',
    payment_method: payment_method || 'card'
  };
}

export function addEntry(entries, entry) {
  return [entry, ...entries];
}

export function updateEntry(entries, id, patch) {
  return entries.map((entry) => {
    if (entry.id !== id) return entry;
    const merged = { ...entry, ...patch };
    const { subtotal_idr, extra_idr, total_idr } = computeTotals(
      merged.items, merged.tax_mode, merged.tax_rate, merged.service_rate
    );
    const total_krw = convertToKrw(total_idr, merged.fx_rate_snapshot);
    return { ...merged, subtotal_idr, extra_idr, total_idr, total_krw };
  });
}

export function removeEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}

export function filterByTab(entries, tabType) {
  return entries.filter((entry) => entry.tab_type === tabType);
}

export function sortByDateDesc(entries) {
  return [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function sumTotals(entries) {
  return entries.reduce(
    (sum, entry) => ({
      total_idr: sum.total_idr + entry.total_idr,
      total_krw: sum.total_krw + entry.total_krw
    }),
    { total_idr: 0, total_krw: 0 }
  );
}
