import { computeTotals, convertToKrw } from './calc.js';
import {
  createEntry, addEntry, updateEntry, removeEntry, filterByTab, sortByDateDesc, sumTotals
} from './entries.js';
import {
  loadEntries, saveEntries, loadLastRate, saveLastRate, loadLastTaxRates, saveLastTaxRates
} from './storage.js';

let entries = loadEntries();
let currentTab = 'shared';
let currentView = 'calculator';
let currentItems = [];
let currentTaxMode = 'none';
let { tax_rate: currentTaxRate, service_rate: currentServiceRate } = loadLastTaxRates();
let currentFxRate = loadLastRate(currentTab);
let editingEntryId = null;
let filterStart = '';
let filterEnd = '';

const el = {
  taxModeButtons: document.querySelectorAll('.tax-mode-btn'),
  taxRateInput: document.getElementById('tax-rate-input'),
  serviceRateInput: document.getElementById('service-rate-input'),
  fxRateInput: document.getElementById('fx-rate-input'),
  itemsList: document.getElementById('items-list'),
  addItemBtn: document.getElementById('add-item-btn'),
  memoInput: document.getElementById('memo-input'),
  saveBtn: document.getElementById('save-entry-btn'),
  subtotalDisplay: document.getElementById('subtotal-display'),
  extraDisplay: document.getElementById('extra-display'),
  totalIdrDisplay: document.getElementById('total-idr-display'),
  totalKrwDisplay: document.getElementById('total-krw-display'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  viewButtons: document.querySelectorAll('.view-btn'),
  views: document.querySelectorAll('.view'),
  ledgerList: document.getElementById('ledger-list'),
  ledgerSummaryIdr: document.getElementById('ledger-summary-idr'),
  ledgerSummaryKrw: document.getElementById('ledger-summary-krw'),
  filterStartInput: document.getElementById('filter-start-date'),
  filterEndInput: document.getElementById('filter-end-date'),
  exportBtn: document.getElementById('export-btn')
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatIdr(value) {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatKrw(value) {
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

function renderItemsList() {
  el.itemsList.innerHTML = '';
  currentItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'item-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'item-name';
    nameInput.placeholder = '메뉴 이름';
    nameInput.value = item.name;
    nameInput.addEventListener('input', (e) => {
      currentItems[index].name = e.target.value;
    });

    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.name = 'item-price';
    priceInput.placeholder = 'Rp';
    priceInput.min = '0';
    priceInput.value = item.price_idr;
    priceInput.addEventListener('input', (e) => {
      const parsed = Number(e.target.value);
      currentItems[index].price_idr = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      recalcAndRenderTotals();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      currentItems.splice(index, 1);
      renderItemsList();
      recalcAndRenderTotals();
    });

    row.append(nameInput, priceInput, deleteBtn);
    el.itemsList.appendChild(row);
  });
}

function recalcAndRenderTotals() {
  const { subtotal_idr, extra_idr, total_idr } = computeTotals(
    currentItems, currentTaxMode, currentTaxRate, currentServiceRate
  );
  const total_krw = convertToKrw(total_idr, currentFxRate);
  el.subtotalDisplay.textContent = formatIdr(subtotal_idr);
  el.extraDisplay.textContent = formatIdr(extra_idr);
  el.totalIdrDisplay.textContent = formatIdr(total_idr);
  el.totalKrwDisplay.textContent = formatKrw(total_krw);
  el.saveBtn.disabled = currentItems.length === 0;
}

function resetCalculatorDraft() {
  currentItems = [];
  currentTaxMode = 'none';
  editingEntryId = null;
  el.taxModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === 'none'));
  el.serviceRateInput.disabled = true;
  el.memoInput.value = '';
  el.saveBtn.textContent = '저장하기';
  currentFxRate = loadLastRate(currentTab);
  el.fxRateInput.value = currentFxRate;
  renderItemsList();
  recalcAndRenderTotals();
}

function switchTab(tab) {
  currentTab = tab;
  el.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  resetCalculatorDraft();
  if (currentView === 'ledger') renderLedger();
}

function switchView(view) {
  currentView = view;
  el.viewButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  el.views.forEach((section) => section.classList.toggle('active', section.id === `${view}-view`));
  if (view === 'ledger') renderLedger();
}

function handleTaxModeChange(mode) {
  currentTaxMode = mode;
  el.taxModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
  el.serviceRateInput.disabled = mode !== 'plusplus';
  recalcAndRenderTotals();
}

function renderLedger() {
  const filtered = filterByTab(entries, currentTab).filter((entry) => {
    if (filterStart && entry.date.slice(0, 10) < filterStart) return false;
    if (filterEnd && entry.date.slice(0, 10) > filterEnd) return false;
    return true;
  });
  const sorted = sortByDateDesc(filtered);
  const { total_idr, total_krw } = sumTotals(filtered);
  el.ledgerSummaryIdr.textContent = formatIdr(total_idr);
  el.ledgerSummaryKrw.textContent = formatKrw(total_krw);

  el.ledgerList.innerHTML = '';
  sorted.forEach((entry) => {
    el.ledgerList.appendChild(renderLedgerItem(entry));
  });
}

function renderLedgerItem(entry) {
  const container = document.createElement('div');
  container.className = 'ledger-item';

  const header = document.createElement('div');
  header.className = 'ledger-item-header';
  header.innerHTML = `<span>${entry.date.slice(0, 10)} ${entry.memo ? '· ' + escapeHtml(entry.memo) : ''}</span><span>${formatKrw(entry.total_krw)}</span>`;
  header.addEventListener('click', () => container.classList.toggle('expanded'));

  const detail = document.createElement('div');
  detail.className = 'ledger-item-detail';

  const itemsHtml = entry.items.map((item) => `<div>${escapeHtml(item.name)} — ${formatIdr(item.price_idr)}</div>`).join('');
  const taxLabel = { none: '가격만', plus: '+', plusplus: '++' }[entry.tax_mode];

  const fxLabel = document.createElement('label');
  fxLabel.textContent = '환율 (100Rp=원) ';
  const fxInput = document.createElement('input');
  fxInput.type = 'number';
  fxInput.min = '0';
  fxInput.step = '0.01';
  fxInput.value = entry.fx_rate_snapshot;
  fxInput.addEventListener('change', (e) => {
    const parsed = Number(e.target.value);
    const rate = Number.isFinite(parsed) && parsed >= 0 ? parsed : entry.fx_rate_snapshot;
    entries = updateEntry(entries, entry.id, { fx_rate_snapshot: rate });
    saveEntries(entries);
    renderLedger();
  });
  fxLabel.appendChild(fxInput);

  const actions = document.createElement('div');
  actions.className = 'ledger-item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-outline';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', () => loadEntryIntoCalculator(entry));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-outline';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', () => {
    if (!confirm('이 항목을 삭제할까요?')) return;
    entries = removeEntry(entries, entry.id);
    saveEntries(entries);
    renderLedger();
  });

  actions.append(editBtn, deleteBtn);
  detail.innerHTML = `<div>${itemsHtml}</div><div>세금모드: ${taxLabel} (세금 ${entry.tax_rate}% / 서비스 ${entry.service_rate}%)</div>`;
  detail.append(fxLabel, actions);

  container.append(header, detail);
  return container;
}

function loadEntryIntoCalculator(entry) {
  editingEntryId = entry.id;
  currentTab = entry.tab_type;
  currentItems = entry.items.map((item) => ({ ...item }));
  currentTaxMode = entry.tax_mode;
  currentTaxRate = entry.tax_rate;
  currentServiceRate = entry.service_rate;
  currentFxRate = entry.fx_rate_snapshot;

  el.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === currentTab));
  el.taxModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === currentTaxMode));
  el.serviceRateInput.disabled = currentTaxMode !== 'plusplus';
  el.taxRateInput.value = currentTaxRate;
  el.serviceRateInput.value = currentServiceRate;
  el.fxRateInput.value = currentFxRate;
  el.memoInput.value = entry.memo;
  el.saveBtn.textContent = '수정 저장';

  renderItemsList();
  recalcAndRenderTotals();
  switchView('calculator');
}

function handleSaveEntry() {
  const date = editingEntryId
    ? entries.find((entry) => entry.id === editingEntryId).date
    : new Date().toISOString();

  const payload = {
    tab_type: currentTab,
    date,
    items: currentItems.map((item) => ({ ...item })),
    tax_mode: currentTaxMode,
    tax_rate: currentTaxRate,
    service_rate: currentServiceRate,
    fx_rate_snapshot: currentFxRate,
    memo: el.memoInput.value
  };

  if (editingEntryId) {
    entries = updateEntry(entries, editingEntryId, payload);
  } else {
    entries = addEntry(entries, createEntry(payload));
  }
  saveEntries(entries);
  saveLastRate(currentTab, currentFxRate);
  saveLastTaxRates(currentTaxRate, currentServiceRate);

  resetCalculatorDraft();
  switchView('ledger');
}

function handleExport() {
  const blob = new Blob([JSON.stringify({ entries }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bali-expenses-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

el.tabButtons.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
el.viewButtons.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));
el.taxModeButtons.forEach((btn) => btn.addEventListener('click', () => handleTaxModeChange(btn.dataset.mode)));
el.taxRateInput.addEventListener('input', (e) => {
  currentTaxRate = Number(e.target.value) || 0;
  recalcAndRenderTotals();
});
el.serviceRateInput.addEventListener('input', (e) => {
  currentServiceRate = Number(e.target.value) || 0;
  recalcAndRenderTotals();
});
el.fxRateInput.addEventListener('input', (e) => {
  currentFxRate = Number(e.target.value) || 0;
  saveLastRate(currentTab, currentFxRate);
  recalcAndRenderTotals();
});
el.addItemBtn.addEventListener('click', () => {
  currentItems.push({ name: '', price_idr: 0 });
  renderItemsList();
  recalcAndRenderTotals();
});
el.saveBtn.addEventListener('click', handleSaveEntry);
el.filterStartInput.addEventListener('change', (e) => { filterStart = e.target.value; renderLedger(); });
el.filterEndInput.addEventListener('change', (e) => { filterEnd = e.target.value; renderLedger(); });
el.exportBtn.addEventListener('click', handleExport);

el.taxRateInput.value = currentTaxRate;
el.serviceRateInput.value = currentServiceRate;
el.fxRateInput.value = currentFxRate;
renderItemsList();
recalcAndRenderTotals();
