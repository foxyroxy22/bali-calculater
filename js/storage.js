const ENTRIES_KEY = 'bali_expense_entries';
const LAST_TAX_RATE_KEY = 'bali_expense_last_tax_rate';
const LAST_SERVICE_RATE_KEY = 'bali_expense_last_service_rate';

function lastRateKey(tabType) {
  return `bali_expense_last_rate_${tabType}`;
}

export function loadEntries(storage = window.localStorage) {
  const raw = storage.getItem(ENTRIES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('failed to parse stored entries', err);
    return [];
  }
}

export function saveEntries(entries, storage = window.localStorage) {
  storage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function loadLastRate(tabType, storage = window.localStorage) {
  const raw = storage.getItem(lastRateKey(tabType));
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : 8.03;
}

export function saveLastRate(tabType, rate, storage = window.localStorage) {
  storage.setItem(lastRateKey(tabType), String(rate));
}

export function loadLastTaxRates(storage = window.localStorage) {
  const taxRaw = storage.getItem(LAST_TAX_RATE_KEY);
  const serviceRaw = storage.getItem(LAST_SERVICE_RATE_KEY);
  const tax_rate = taxRaw !== null && Number.isFinite(Number(taxRaw)) ? Number(taxRaw) : 10;
  const service_rate = serviceRaw !== null && Number.isFinite(Number(serviceRaw)) ? Number(serviceRaw) : 10;
  return { tax_rate, service_rate };
}

export function saveLastTaxRates(tax_rate, service_rate, storage = window.localStorage) {
  storage.setItem(LAST_TAX_RATE_KEY, String(tax_rate));
  storage.setItem(LAST_SERVICE_RATE_KEY, String(service_rate));
}
