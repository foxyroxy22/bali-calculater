export function computeExtra(subtotalIdr, taxMode, taxRatePercent, serviceRatePercent) {
  if (taxMode === 'none') return 0;
  if (taxMode === 'plus') return subtotalIdr * (taxRatePercent / 100);
  if (taxMode === 'plusplus') return subtotalIdr * ((taxRatePercent + serviceRatePercent) / 100);
  throw new Error(`unknown tax_mode: ${taxMode}`);
}

export function computeTotals(items, taxMode, taxRatePercent, serviceRatePercent) {
  const subtotal_idr = items.reduce((sum, item) => sum + item.price_idr, 0);
  const extra_idr = computeExtra(subtotal_idr, taxMode, taxRatePercent, serviceRatePercent);
  const total_idr = subtotal_idr + extra_idr;
  return { subtotal_idr, extra_idr, total_idr };
}

export function convertToKrw(totalIdr, fxRateSnapshot) {
  return Math.round(totalIdr * (fxRateSnapshot / 100));
}
