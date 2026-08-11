const ENTRIES_KEY = 'bali_expense_entries';
const TOPUPS_KEY = 'bali_expense_topups';
const LAST_TAX_RATE_KEY = 'bali_expense_last_tax_rate';
const LAST_SERVICE_RATE_KEY = 'bali_expense_last_service_rate';

function loadArray(key, storage) {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`failed to parse stored ${key}`, err);
    return [];
  }
}

export function loadEntries(storage = window.localStorage) {
  return loadArray(ENTRIES_KEY, storage);
}

export function saveEntries(entries, storage = window.localStorage) {
  storage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function loadTopups(storage = window.localStorage) {
  return loadArray(TOPUPS_KEY, storage);
}

export function saveTopups(topups, storage = window.localStorage) {
  storage.setItem(TOPUPS_KEY, JSON.stringify(topups));
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
