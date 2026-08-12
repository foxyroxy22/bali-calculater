import { computeTotals, convertToKrw } from './calc.js';
import {
  createEntry, addEntry, updateEntry, removeEntry,
  filterByTab as filterEntriesByTab, sortByDateDesc as sortEntriesByDateDesc, sumTotals
} from './entries.js';
import {
  createTopup, addTopup, updateTopup, removeTopup,
  filterByTab as filterTopupsByTab, sortByDateDesc as sortTopupsByDateDesc,
  computeAverageRate, sumIdr as sumTopupIdr
} from './topups.js';
import {
  createWithdrawal, addWithdrawal, updateWithdrawal, removeWithdrawal,
  filterByTab as filterWithdrawalsByTab, sortByDateDesc as sortWithdrawalsByDateDesc,
  sumIdr as sumWithdrawalIdr, sumCardDeductionIdr as sumWithdrawalCardDeductionIdr
} from './withdrawals.js';
import {
  loadEntries, saveEntries, loadTopups, saveTopups, loadWithdrawals, saveWithdrawals,
  loadLastTaxRates, saveLastTaxRates
} from './storage.js';

let entries = loadEntries();
let topups = loadTopups();
let withdrawals = loadWithdrawals();
let currentTab = 'shared';
let currentView = 'calculator';
let currentItems = [];
let currentTaxMode = 'none';
let currentPaymentMethod = 'card';
let { tax_rate: currentTaxRate, service_rate: currentServiceRate } = loadLastTaxRates();
let editingEntryId = null;
let editingTopupId = null;
let editingWithdrawalId = null;
let selectedDate = todayDateStr();
let showAllDates = false;

const el = {
  appRoot: document.querySelector('.app'),
  taxModeButtons: document.querySelectorAll('.tax-mode-btn'),
  taxRateInput: document.getElementById('tax-rate-input'),
  serviceRateInput: document.getElementById('service-rate-input'),
  appliedRateDisplay: document.getElementById('applied-rate-display'),
  appliedBalanceDisplay: document.getElementById('applied-balance-display'),
  addTopupBtn: document.getElementById('add-topup-btn'),
  addWithdrawalBtn: document.getElementById('add-withdrawal-btn'),
  paymentMethodButtons: document.querySelectorAll('.payment-method-btn'),
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
  walletBalanceCardIdr: document.getElementById('wallet-balance-card-idr'),
  walletBalanceCardKrw: document.getElementById('wallet-balance-card-krw'),
  walletBalanceCashIdr: document.getElementById('wallet-balance-cash-idr'),
  walletBalanceCashKrw: document.getElementById('wallet-balance-cash-krw'),
  datePrevBtn: document.getElementById('date-prev-btn'),
  dateNextBtn: document.getElementById('date-next-btn'),
  showAllToggle: document.getElementById('show-all-toggle'),
  topupOverlay: document.getElementById('topup-overlay'),
  topupDateInput: document.getElementById('topup-date-input'),
  topupKrwInput: document.getElementById('topup-krw-input'),
  topupIdrInput: document.getElementById('topup-idr-input'),
  topupRatePreview: document.getElementById('topup-rate-preview'),
  topupConfirmBtn: document.getElementById('topup-confirm-btn'),
  withdrawalOverlay: document.getElementById('withdrawal-overlay'),
  withdrawalDateInput: document.getElementById('withdrawal-date-input'),
  withdrawalIdrInput: document.getElementById('withdrawal-idr-input'),
  withdrawalFeeInput: document.getElementById('withdrawal-fee-input'),
  withdrawalConfirmBtn: document.getElementById('withdrawal-confirm-btn'),
  exportBtn: document.getElementById('export-btn'),
  exportOverlay: document.getElementById('export-overlay'),
  exportDateList: document.getElementById('export-date-list'),
  exportConfirmBtn: document.getElementById('export-confirm-btn'),
  exportSelectAllBtn: document.getElementById('export-select-all-btn')
};

const TRIP_START_DATE = '2026-08-14';
const TRIP_END_DATE = '2026-08-22';

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

function formatRate(rate) {
  return rate.toFixed(2);
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

function appliedRateForDate(tab, date) {
  const relevantTopups = filterTopupsByTab(topups, tab).filter((t) => t.date <= date);
  return computeAverageRate(relevantTopups);
}

function computeCardBalanceIdr(tab) {
  const topupIdr = sumTopupIdr(filterTopupsByTab(topups, tab));
  const withdrawalIdr = sumWithdrawalCardDeductionIdr(filterWithdrawalsByTab(withdrawals, tab));
  const cardSpentIdr = filterEntriesByTab(entries, tab)
    .filter((entry) => entry.payment_method !== 'cash')
    .reduce((sum, entry) => sum + entry.total_idr, 0);
  return topupIdr - withdrawalIdr - cardSpentIdr;
}

function computeCashBalanceIdr(tab) {
  const withdrawalIdr = sumWithdrawalIdr(filterWithdrawalsByTab(withdrawals, tab));
  const cashSpentIdr = filterEntriesByTab(entries, tab)
    .filter((entry) => entry.payment_method === 'cash')
    .reduce((sum, entry) => sum + entry.total_idr, 0);
  return withdrawalIdr - cashSpentIdr;
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
  const date = el.dateInput.value || todayDateStr();
  const appliedRate = appliedRateForDate(currentTab, date);
  const total_krw = appliedRate != null ? convertToKrw(total_idr, appliedRate) : 0;

  el.subtotalDisplay.textContent = formatIdr(subtotal_idr);
  el.extraDisplay.textContent = formatIdr(extra_idr);
  el.totalIdrDisplay.textContent = formatIdr(total_idr);
  el.totalKrwDisplay.textContent = formatKrw(total_krw);

  el.appliedRateDisplay.textContent = appliedRate != null ? `100Rp = ${formatRate(appliedRate)}원` : '충전 필요';

  const balanceIdr = currentPaymentMethod === 'cash'
    ? computeCashBalanceIdr(currentTab)
    : computeCardBalanceIdr(currentTab);
  const balanceLabel = currentPaymentMethod === 'cash' ? '현금 잔액' : '카드 잔액';
  el.appliedBalanceDisplay.textContent = appliedRate != null
    ? `${balanceLabel} ${formatIdr(balanceIdr)} (${formatKrw(convertToKrw(balanceIdr, appliedRate))})`
    : '충전 내역이 없습니다';

  el.saveBtn.disabled = currentItems.length === 0 || appliedRate === null;
}

function resetCalculatorDraft() {
  currentItems = [];
  currentTaxMode = 'none';
  currentPaymentMethod = 'card';
  editingEntryId = null;
  el.taxModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === 'none'));
  el.paymentMethodButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.method === 'card'));
  el.taxRateInput.disabled = true;
  el.serviceRateInput.disabled = true;
  el.memoInput.value = '';
  el.dateInput.value = todayDateStr();
  el.saveBtn.textContent = '저장하기';
  renderItemsList();
  recalcAndRenderTotals();
}

function handlePaymentMethodChange(method) {
  currentPaymentMethod = method;
  el.paymentMethodButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.method === method));
  recalcAndRenderTotals();
}

function applyTabTheme(tab) {
  el.appRoot.classList.toggle('theme-personal', tab === 'personal');
}

function switchTab(tab) {
  currentTab = tab;
  el.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  applyTabTheme(tab);
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
  el.taxRateInput.disabled = mode === 'none';
  el.serviceRateInput.disabled = mode !== 'plusplus';
  recalcAndRenderTotals();
}

function renderLedger() {
  el.datePrevBtn.classList.toggle('hidden', showAllDates);
  el.dateNextBtn.classList.toggle('hidden', showAllDates);

  const tabEntries = filterEntriesByTab(entries, currentTab);
  const tabTopups = filterTopupsByTab(topups, currentTab);
  const tabWithdrawals = filterWithdrawalsByTab(withdrawals, currentTab);

  const displayedEntries = showAllDates
    ? tabEntries
    : tabEntries.filter((entry) => entry.date.slice(0, 10) === selectedDate);
  const displayedTopups = showAllDates
    ? tabTopups
    : tabTopups.filter((topup) => topup.date.slice(0, 10) === selectedDate);
  const displayedWithdrawals = showAllDates
    ? tabWithdrawals
    : tabWithdrawals.filter((withdrawal) => withdrawal.date.slice(0, 10) === selectedDate);

  if (showAllDates) {
    const dates = [
      ...displayedEntries.map((entry) => entry.date.slice(0, 10)),
      ...displayedTopups.map((topup) => topup.date.slice(0, 10)),
      ...displayedWithdrawals.map((withdrawal) => withdrawal.date.slice(0, 10))
    ].sort();
    el.ledgerCurrentDate.textContent = dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '전체 기간';
  } else {
    el.ledgerCurrentDate.textContent = selectedDate;
  }

  const combined = [
    ...sortTopupsByDateDesc(displayedTopups).map((topup) => ({ type: 'topup', date: topup.date, data: topup })),
    ...sortWithdrawalsByDateDesc(displayedWithdrawals).map((withdrawal) => ({ type: 'withdrawal', date: withdrawal.date, data: withdrawal })),
    ...sortEntriesByDateDesc(displayedEntries).map((entry) => ({ type: 'entry', date: entry.date, data: entry }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  el.ledgerList.innerHTML = '';
  combined.forEach((item) => {
    let node;
    if (item.type === 'topup') node = renderTopupItem(item.data, showAllDates);
    else if (item.type === 'withdrawal') node = renderWithdrawalItem(item.data, showAllDates);
    else node = renderLedgerItem(item.data, showAllDates);
    el.ledgerList.appendChild(node);
  });

  const { total_idr, total_krw } = sumTotals(displayedEntries);
  el.ledgerSummaryIdr.textContent = formatIdr(total_idr);
  el.ledgerSummaryKrw.textContent = formatKrw(total_krw);

  const overallRate = computeAverageRate(tabTopups);
  const cardBalanceIdr = computeCardBalanceIdr(currentTab);
  const cashBalanceIdr = computeCashBalanceIdr(currentTab);
  el.walletBalanceCardIdr.textContent = formatIdr(cardBalanceIdr);
  el.walletBalanceCardKrw.textContent = overallRate != null ? formatKrw(convertToKrw(cardBalanceIdr, overallRate)) : '₩0';
  el.walletBalanceCashIdr.textContent = formatIdr(cashBalanceIdr);
  el.walletBalanceCashKrw.textContent = overallRate != null ? formatKrw(convertToKrw(cashBalanceIdr, overallRate)) : '₩0';

  el.exportOverlay.hidden = true;
  el.topupOverlay.hidden = true;
  el.withdrawalOverlay.hidden = true;
}

function renderTopupItem(topup, showDate) {
  const container = document.createElement('div');
  container.className = 'topup-item';

  const rate = (topup.krw_amount / topup.idr_amount) * 100;
  const dateLabel = showDate ? `${topup.date.slice(0, 10)} · 충전` : '충전';

  const header = document.createElement('div');
  header.className = 'topup-item-header';
  header.innerHTML = `
    <div class="topup-item-icon">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5" />
        <path d="M6 11l6-6 6 6" />
      </svg>
    </div>
    <div class="topup-item-info">
      <div class="topup-item-label">${escapeHtml(dateLabel)}</div>
      <div class="topup-item-amount">${formatIdr(topup.idr_amount)}</div>
    </div>
    <div class="topup-item-side">
      <div class="topup-item-amount">${formatKrw(topup.krw_amount)}</div>
      <div class="topup-item-label">100Rp = ${formatRate(rate)}원</div>
    </div>
  `;
  header.addEventListener('click', () => container.classList.toggle('expanded'));

  const detail = document.createElement('div');
  detail.className = 'topup-item-detail';

  const actions = document.createElement('div');
  actions.className = 'ledger-item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', () => openTopupModal(topup));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', () => {
    if (!confirm('이 충전 내역을 삭제할까요?')) return;
    topups = removeTopup(topups, topup.id);
    saveTopups(topups);
    renderLedger();
  });

  actions.append(editBtn, deleteBtn);
  detail.append(actions);

  container.append(header, detail);
  return container;
}

function renderWithdrawalItem(withdrawal, showDate) {
  const container = document.createElement('div');
  container.className = 'withdrawal-item';

  const dateLabel = showDate ? `${withdrawal.date.slice(0, 10)} · 현금 인출` : '현금 인출';
  const feeLabel = withdrawal.fee_idr > 0 ? `수수료 ${formatIdr(withdrawal.fee_idr)}` : '수수료 없음';

  const header = document.createElement('div');
  header.className = 'topup-item-header';
  header.innerHTML = `
    <div class="topup-item-icon">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14" />
        <path d="M18 13l-6 6-6-6" />
      </svg>
    </div>
    <div class="topup-item-info">
      <div class="topup-item-label">${escapeHtml(dateLabel)}</div>
      <div class="topup-item-amount">${formatIdr(withdrawal.idr_amount)}</div>
    </div>
    <div class="topup-item-side">
      <div class="topup-item-label">${escapeHtml(feeLabel)}</div>
    </div>
  `;
  header.addEventListener('click', () => container.classList.toggle('expanded'));

  const detail = document.createElement('div');
  detail.className = 'topup-item-detail';

  const actions = document.createElement('div');
  actions.className = 'ledger-item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', () => openWithdrawalModal(withdrawal));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', () => {
    if (!confirm('이 인출 내역을 삭제할까요?')) return;
    withdrawals = removeWithdrawal(withdrawals, withdrawal.id);
    saveWithdrawals(withdrawals);
    renderLedger();
  });

  actions.append(editBtn, deleteBtn);
  detail.append(actions);

  container.append(header, detail);
  return container;
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
    <span class="tag">환율 100Rp = ${formatRate(entry.fx_rate_snapshot)}원</span>
  `;

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
  currentPaymentMethod = entry.payment_method || 'card';

  el.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === currentTab));
  applyTabTheme(currentTab);
  el.taxModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === currentTaxMode));
  el.paymentMethodButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.method === currentPaymentMethod));
  el.taxRateInput.disabled = currentTaxMode === 'none';
  el.serviceRateInput.disabled = currentTaxMode !== 'plusplus';
  el.taxRateInput.value = currentTaxRate;
  el.serviceRateInput.value = currentServiceRate;
  el.dateInput.value = entry.date.slice(0, 10);
  el.memoInput.value = entry.memo;
  el.saveBtn.textContent = '수정 저장';

  renderItemsList();
  recalcAndRenderTotals();
  switchView('calculator');
}

function handleSaveEntry() {
  const date = el.dateInput.value || todayDateStr();
  const appliedRate = appliedRateForDate(currentTab, date);
  if (appliedRate == null) return;

  const payload = {
    tab_type: currentTab,
    date,
    items: currentItems.map((item) => ({ ...item })),
    tax_mode: currentTaxMode,
    tax_rate: currentTaxRate,
    service_rate: currentServiceRate,
    fx_rate_snapshot: appliedRate,
    memo: el.memoInput.value,
    payment_method: currentPaymentMethod
  };

  if (editingEntryId) {
    entries = updateEntry(entries, editingEntryId, payload);
  } else {
    entries = addEntry(entries, createEntry(payload));
  }
  saveEntries(entries);
  saveLastTaxRates(currentTaxRate, currentServiceRate);

  selectedDate = date;
  resetCalculatorDraft();
  switchView('ledger');
}

function openTopupModal(topup) {
  editingTopupId = topup ? topup.id : null;
  el.topupDateInput.value = topup ? topup.date.slice(0, 10) : (el.dateInput.value || todayDateStr());
  el.topupKrwInput.value = topup ? topup.krw_amount : '';
  el.topupIdrInput.value = topup ? topup.idr_amount : '';
  el.topupConfirmBtn.textContent = topup ? '충전 수정' : '충전 저장';
  updateTopupPreview();
  el.topupOverlay.hidden = false;
}

function updateTopupPreview() {
  const krw = Number(el.topupKrwInput.value);
  const idr = Number(el.topupIdrInput.value);
  const valid = Number.isFinite(krw) && krw > 0 && Number.isFinite(idr) && idr > 0;
  el.topupRatePreview.textContent = valid ? `100Rp = ${formatRate((krw / idr) * 100)}원` : '-';
  el.topupConfirmBtn.disabled = !valid;
}

function handleTopupConfirm() {
  const krw = Number(el.topupKrwInput.value);
  const idr = Number(el.topupIdrInput.value);
  if (!(Number.isFinite(krw) && krw > 0 && Number.isFinite(idr) && idr > 0)) return;

  const date = el.topupDateInput.value || todayDateStr();

  if (editingTopupId) {
    topups = updateTopup(topups, editingTopupId, { date, krw_amount: krw, idr_amount: idr });
  } else {
    topups = addTopup(topups, createTopup({ tab_type: currentTab, date, krw_amount: krw, idr_amount: idr }));
  }
  saveTopups(topups);
  editingTopupId = null;

  el.topupOverlay.hidden = true;
  recalcAndRenderTotals();
  if (currentView === 'ledger') renderLedger();
}

function openWithdrawalModal(withdrawal) {
  editingWithdrawalId = withdrawal ? withdrawal.id : null;
  el.withdrawalDateInput.value = withdrawal ? withdrawal.date.slice(0, 10) : (el.dateInput.value || todayDateStr());
  el.withdrawalIdrInput.value = withdrawal ? withdrawal.idr_amount : '';
  el.withdrawalFeeInput.value = withdrawal && withdrawal.fee_idr ? withdrawal.fee_idr : '';
  el.withdrawalConfirmBtn.textContent = withdrawal ? '인출 수정' : '인출 저장';
  updateWithdrawalConfirmState();
  el.withdrawalOverlay.hidden = false;
}

function updateWithdrawalConfirmState() {
  const idr = Number(el.withdrawalIdrInput.value);
  el.withdrawalConfirmBtn.disabled = !(Number.isFinite(idr) && idr > 0);
}

function handleWithdrawalConfirm() {
  const idr = Number(el.withdrawalIdrInput.value);
  if (!(Number.isFinite(idr) && idr > 0)) return;
  const feeRaw = Number(el.withdrawalFeeInput.value);
  const fee = Number.isFinite(feeRaw) && feeRaw > 0 ? feeRaw : 0;
  const date = el.withdrawalDateInput.value || todayDateStr();

  if (editingWithdrawalId) {
    withdrawals = updateWithdrawal(withdrawals, editingWithdrawalId, { date, idr_amount: idr, fee_idr: fee });
  } else {
    withdrawals = addWithdrawal(
      withdrawals,
      createWithdrawal({ tab_type: currentTab, date, idr_amount: idr, fee_idr: fee })
    );
  }
  saveWithdrawals(withdrawals);
  editingWithdrawalId = null;

  el.withdrawalOverlay.hidden = true;
  recalcAndRenderTotals();
  if (currentView === 'ledger') renderLedger();
}

function tripDateRange() {
  const dates = [];
  let cursor = TRIP_START_DATE;
  while (cursor <= TRIP_END_DATE) {
    dates.push(cursor);
    cursor = shiftDateStr(cursor, 1);
  }
  return dates;
}

function renderExportPanel() {
  const tabEntries = filterEntriesByTab(entries, currentTab);
  const tripDates = tripDateRange();
  const extraDates = [...new Set(tabEntries.map((entry) => entry.date.slice(0, 10)))]
    .filter((date) => !tripDates.includes(date))
    .sort();
  const dates = [...tripDates, ...extraDates];

  el.exportDateList.innerHTML = '';
  dates.forEach((date) => {
    const count = tabEntries.filter((entry) => entry.date.slice(0, 10) === date).length;

    const label = document.createElement('label');
    label.className = 'export-date-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox-input';
    checkbox.value = date;
    checkbox.checked = true;

    const box = document.createElement('span');
    box.className = 'checkbox-box';
    box.innerHTML = `
      <svg class="checkbox-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    `;

    const dateLabel = document.createElement('span');
    dateLabel.className = 'export-date-label';
    dateLabel.textContent = date;

    const countSpan = document.createElement('span');
    countSpan.className = 'export-date-count';
    countSpan.textContent = count ? `${count}건` : '없음';

    label.append(checkbox, box, dateLabel, countSpan);
    el.exportDateList.appendChild(label);
  });
}

function handleExportConfirm() {
  const checkedDates = [...el.exportDateList.querySelectorAll('input:checked')].map((cb) => cb.value);
  const tabEntries = filterEntriesByTab(entries, currentTab);
  const selected = tabEntries.filter((entry) => checkedDates.includes(entry.date.slice(0, 10)));

  const blob = new Blob([JSON.stringify({ entries: selected }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bali-expenses-${currentTab}-${todayDateStr()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  el.exportOverlay.hidden = true;
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
el.dateInput.addEventListener('change', recalcAndRenderTotals);
el.addItemBtn.addEventListener('click', () => {
  currentItems.push({ name: '', price_idr: 0 });
  renderItemsList();
  recalcAndRenderTotals();
});
el.saveBtn.addEventListener('click', handleSaveEntry);
el.paymentMethodButtons.forEach((btn) => btn.addEventListener('click', () => handlePaymentMethodChange(btn.dataset.method)));
el.addTopupBtn.addEventListener('click', () => openTopupModal());
el.topupOverlay.addEventListener('click', (e) => {
  if (e.target === el.topupOverlay) {
    el.topupOverlay.hidden = true;
    editingTopupId = null;
  }
});
el.topupKrwInput.addEventListener('input', updateTopupPreview);
el.topupIdrInput.addEventListener('input', updateTopupPreview);
el.topupConfirmBtn.addEventListener('click', handleTopupConfirm);
el.addWithdrawalBtn.addEventListener('click', () => openWithdrawalModal());
el.withdrawalOverlay.addEventListener('click', (e) => {
  if (e.target === el.withdrawalOverlay) {
    el.withdrawalOverlay.hidden = true;
    editingWithdrawalId = null;
  }
});
el.withdrawalIdrInput.addEventListener('input', updateWithdrawalConfirmState);
el.withdrawalConfirmBtn.addEventListener('click', handleWithdrawalConfirm);
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
  renderExportPanel();
  el.exportOverlay.hidden = false;
});
el.exportOverlay.addEventListener('click', (e) => {
  if (e.target === el.exportOverlay) el.exportOverlay.hidden = true;
});
el.exportSelectAllBtn.addEventListener('click', () => {
  el.exportDateList.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
});
el.exportConfirmBtn.addEventListener('click', handleExportConfirm);

el.taxRateInput.value = currentTaxRate;
el.taxRateInput.disabled = currentTaxMode === 'none';
el.serviceRateInput.value = currentServiceRate;
el.dateInput.value = todayDateStr();
renderItemsList();
recalcAndRenderTotals();
