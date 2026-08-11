export function createTopup(
  { tab_type, date, krw_amount, idr_amount },
  idGenerator = () => crypto.randomUUID()
) {
  return { id: idGenerator(), tab_type, date, krw_amount, idr_amount };
}

export function addTopup(topups, topup) {
  return [topup, ...topups];
}

export function updateTopup(topups, id, patch) {
  return topups.map((topup) => (topup.id === id ? { ...topup, ...patch } : topup));
}

export function removeTopup(topups, id) {
  return topups.filter((topup) => topup.id !== id);
}

export function filterByTab(topups, tabType) {
  return topups.filter((topup) => topup.tab_type === tabType);
}

export function sortByDateDesc(topups) {
  return [...topups].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function computeAverageRate(topups) {
  const idrTotal = topups.reduce((sum, topup) => sum + topup.idr_amount, 0);
  const krwTotal = topups.reduce((sum, topup) => sum + topup.krw_amount, 0);
  if (idrTotal <= 0) return null;
  return (krwTotal / idrTotal) * 100;
}

export function sumIdr(topups) {
  return topups.reduce((sum, topup) => sum + topup.idr_amount, 0);
}
