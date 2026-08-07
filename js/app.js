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
let selectedDate = todayDateStr();
let showAllDates = false;

const el = {
  taxModeButtons: document.querySelectorAll('.tax-mode-btn'),
  taxRateInput: document.getElementById('tax-rate-input'),
  serviceRateInput: document.getElementById('service-rate-input'),
  fxRateInput: document.getElementById('fx-rate-input'),
  dateInput: document.getElementById('date-input'),
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
  ledgerCurrentDate: document.getElementById('ledger-current-date'),
  datePrevBtn: document.getElementById('date-prev-btn'),
  dateNextBtn: document.getElementById('date-next-btn'),
  exportBtn: document.getElementById('export-btn'),
  exportPanel: document.getElementById('export-panel'),
  exportDateList: document.getElementById('export-date-list'),
  exportConfirmBtn: document.getElementById('export-confirm-btn'),
  showAllToggle: document.getElementById('show-all-toggle')
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

function todayDateStr() {
  return dateToStr(new Date());
}

function dateToStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return dateToStr(dt);
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
  el.dateInput.value = todayDateStr();
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
  el.datePrevBtn.classList.toggle('hidden', showAllDates);
  el.dateNextBtn.classList.toggle('hidden', showAllDates);

  const tabEntries = filterByTab(entries, currentTab);
  const displayed = showAllDates
    ? tabEntries
    : tabEntries.filter((entry) => entry.date.slice(0, 10) === selectedDate);

  if (showAllDates) {
    const dates = displayed.map((entry) => entry.date.slice(0, 10)).sort();
    el.ledgerCurrentDate.textContent = dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '전체 기간';
  } else {
    el.ledgerCurrentDate.textContent = selectedDate;
  }

  const sorted = sortByDateDesc(displayed);
  el.ledgerList.innerHTML = '';
  sorted.forEach((entry) => {
    el.ledgerList.appendChild(renderLedgerItem(entry, showAllDates));
  });

  const { total_idr, total_krw } = sumTotals(displayed);
  el.ledgerSummaryIdr.textContent = formatIdr(total_idr);
  el.ledgerSummaryKrw.textContent = formatKrw(total_krw);

  el.exportPanel.hidden = true;
}

function renderLedgerItem(entry, showDate) {
  const container = document.createElement('div');
  container.className = 'ledger-item';

  const itemNames = entry.items.length
    ? entry.items.map((item) => escapeHtml(item.name || '(이름 없음)')).join(', ')
    : '메뉴 없음';

  const header = document.createElement('div');
  header.className = 'ledger-item-header';
  header.innerHTML = `
    <div class="ledger-item-title">
      ${showDate ? `<div class="ledger-item-date">${entry.date.slice(0, 10)}</div>` : ''}
      <div class="ledger-item-name">${itemNames}</div>
      ${entry.memo ? `<div class="ledger-item-memo">${escapeHtml(entry.memo)}</div>` : ''}
    </div>
    <div class="ledger-item-amounts">
      <div class="ledger-item-idr">${formatIdr(entry.total_idr)}</div>
      <div class="ledger-item-krw">${formatKrw(entry.total_krw)}</div>
    </div>
  `;
  header.addEventListener('click', () => container.classList.toggle('expanded'));

  const detail = document.createElement('div');
  detail.className = 'ledger-item-detail';

  const taxLabel = { none: '가격만', plus: '+', plusplus: '++' }[entry.tax_mode];
  const itemsHtml = entry.items
    .map((item) => `<div>${escapeHtml(item.name)} — ${formatIdr(item.price_idr)}</div>`)
    .join('');

  const detailRow = document.createElement('div');
  detailRow.className = 'detail-row';

  const tags = document.createElement('div');
  tags.className = 'detail-tags';
  tags.innerHTML = `
    ${entry.memo ? `<span class="tag">${escapeHtml(entry.memo)}</span>` : ''}
    <span class="tag">${taxLabel} (세금 ${entry.tax_rate}% / 서비스 ${entry.service_rate}%)</span>
    <span class="tag tag-fx">환율 100Rp = <input type="number" class="tag-fx-input" min="0" step="0.01" value="${entry.fx_rate_snapshot}">원</span>
  `;
  const fxInput = tags.querySelector('.tag-fx-input');
  fxInput.addEventListener('click', (e) => e.stopPropagation());
  fxInput.addEventListener('change', (e) => {
    const parsed = Number(e.target.value);
    const rate = Number.isFinite(parsed) && parsed >= 0 ? parsed : entry.fx_rate_snapshot;
    entries = updateEntry(entries, entry.id, { fx_rate_snapshot: rate });
    saveEntries(entries);
    renderLedger();
  });

  const items = document.createElement('div');
  items.className = 'detail-items';
  items.innerHTML = itemsHtml;

  detailRow.append(tags, items);

  const actions = document.createElement('div');
  actions.className = 'ledger-item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', () => loadEntryIntoCalculator(entry));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', () => {
    if (!confirm('이 항목을 삭제할까요?')) return;
    entries = removeEntry(entries, entry.id);
    saveEntries(entries);
    renderLedger();
  });

  actions.append(editBtn, deleteBtn);
  detail.append(detailRow, actions);

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
  el.dateInput.value = entry.date.slice(0, 10);
  el.memoInput.value = entry.memo;
  el.saveBtn.textContent = '수정 저장';

  renderItemsList();
  recalcAndRenderTotals();
  switchView('calculator');
}

function handleSaveEntry() {
  const date = el.dateInput.value || todayDateStr();

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

  selectedDate = date;
  resetCalculatorDraft();
  switchView('ledger');
}

function renderExportPanel() {
  const tabEntries = filterByTab(entries, currentTab);
  const dates = [...new Set(tabEntries.map((entry) => entry.date.slice(0, 10)))].sort().reverse();

  el.exportDateList.innerHTML = '';
  dates.forEach((date) => {
    const label = document.createElement('label');
    label.className = 'export-date-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = date;
    checkbox.checked = true;

    label.append(checkbox, document.createTextNode(' ' + date));
    el.exportDateList.appendChild(label);
  });
}

function handleExportConfirm() {
  const checkedDates = [...el.exportDateList.querySelectorAll('input:checked')].map((cb) => cb.value);
  const tabEntries = filterByTab(entries, currentTab);
  const selected = tabEntries.filter((entry) => checkedDates.includes(entry.date.slice(0, 10)));

  const blob = new Blob([JSON.stringify({ entries: selected }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bali-expenses-${currentTab}-${todayDateStr()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  el.exportPanel.hidden = true;
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
el.showAllToggle.addEventListener('change', (e) => {
  showAllDates = e.target.checked;
  renderLedger();
});
el.datePrevBtn.addEventListener('click', () => {
  selectedDate = shiftDateStr(selectedDate, -1);
  renderLedger();
});
el.dateNextBtn.addEventListener('click', () => {
  selectedDate = shiftDateStr(selectedDate, 1);
  renderLedger();
});
el.exportBtn.addEventListener('click', () => {
  const opening = el.exportPanel.hidden;
  if (opening) renderExportPanel();
  el.exportPanel.hidden = !opening;
});
el.exportConfirmBtn.addEventListener('click', handleExportConfirm);

el.taxRateInput.value = currentTaxRate;
el.serviceRateInput.value = currentServiceRate;
el.fxRateInput.value = currentFxRate;
el.dateInput.value = todayDateStr();
renderItemsList();
recalcAndRenderTotals();
