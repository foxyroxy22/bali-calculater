# 발리 경비 계산기 & 가계부 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, no-backend web app that calculates Bali restaurant/shopping bills with tax/service-charge modes, converts to KRW, and saves entries to a browser-local ledger split across "같이"(shared) and "개인"(personal) tabs.

**Architecture:** Plain HTML/CSS/ES-module JS, no framework, no build step. Pure calculation/data logic lives in dependency-free modules (`calc.js`, `entries.js`, `storage.js`) that are unit-tested with Node's built-in test runner. DOM wiring lives in `app.js` and is verified manually in a browser. Data persists in `localStorage`; deploy target is GitHub Pages (`https://github.com/foxyroxy22/bali-calculater.git`, remote `origin` already added).

**Tech Stack:** HTML5, CSS3 (custom properties), vanilla JS (ES modules), Node.js `node:test` + `node:assert/strict` for unit tests. No npm dependencies.

## Global Constraints

- Tax modes: `none` (0% extra) / `plus` (tax % only) / `plusplus` (tax % + service %). Defaults: tax_rate=10, service_rate=10, remembered across sessions via localStorage.
- Exchange rate input format: fixed as "100루피아 = ___원". Default fallback value: `8.03`.
- Exchange rate last-entered value is remembered **per tab** (`shared` vs `personal`) independently.
- On save, the entry's `fx_rate_snapshot` is fixed at that value; it must remain editable afterward from the ledger detail view, recalculating `total_krw` when changed.
- No menu item count limit — the items list area scrolls instead.
- No PWA / manifest / service worker — plain static site only.
- Data export: a button downloads the full `entries` array as pretty-printed (indent 2) JSON.
- No login, no server, no accounts. Both tabs are visible to anyone using the device.
- Data schema (from spec) is authoritative — field names below must match exactly:
  `id, tab_type, date, items[{name, price_idr}], tax_mode, tax_rate, service_rate, subtotal_idr, extra_idr, total_idr, fx_rate_snapshot, total_krw, memo`.

## File Structure

- `package.json` — no deps, `npm test` runs `node --test tests/`
- `js/calc.js` — pure tax/total/KRW-conversion math (Task 1)
- `js/entries.js` — pure entry CRUD/filter/sort/sum over an entries array (Task 2)
- `js/storage.js` — localStorage read/write wrappers, injectable storage for tests (Task 3)
- `index.html` — page structure (Task 4)
- `css/styles.css` — Baemin-derived visual styling (Task 4)
- `js/app.js` — DOM wiring: calculator view, ledger view, edit/delete, export (Task 5)
- `tests/calc.test.js`, `tests/entries.test.js`, `tests/storage.test.js` — unit tests (Tasks 1-3)
- `README.md` — deploy instructions (Task 6)

---

### Task 1: Pure calculation math (`js/calc.js`)

**Files:**
- Create: `package.json`
- Create: `js/calc.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Produces: `computeExtra(subtotalIdr, taxMode, taxRatePercent, serviceRatePercent) -> number`
- Produces: `computeTotals(items, taxMode, taxRatePercent, serviceRatePercent) -> {subtotal_idr, extra_idr, total_idr}` where `items` is `[{name, price_idr}]`
- Produces: `convertToKrw(totalIdr, fxRateSnapshot) -> number` (rounded integer; `fxRateSnapshot` = KRW per 100 IDR)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bali-expense-tracker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Write the failing test — `tests/calc.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExtra, computeTotals, convertToKrw } from '../js/calc.js';

test('computeExtra returns 0 for none mode', () => {
  assert.equal(computeExtra(100000, 'none', 10, 10), 0);
});

test('computeExtra applies tax only for plus mode', () => {
  assert.equal(computeExtra(100000, 'plus', 10, 10), 10000);
});

test('computeExtra applies tax+service for plusplus mode', () => {
  assert.equal(computeExtra(100000, 'plusplus', 10, 10), 20000);
});

test('computeExtra throws on unknown mode', () => {
  assert.throws(() => computeExtra(100000, 'bogus', 10, 10));
});

test('computeTotals sums items and applies extra', () => {
  const items = [{ name: 'Nasi Goreng', price_idr: 50000 }, { name: 'Es Teh', price_idr: 15000 }];
  const result = computeTotals(items, 'plusplus', 10, 10);
  assert.equal(result.subtotal_idr, 65000);
  assert.equal(result.extra_idr, 13000);
  assert.equal(result.total_idr, 78000);
});

test('computeTotals with empty items returns zeros', () => {
  const result = computeTotals([], 'none', 10, 10);
  assert.deepEqual(result, { subtotal_idr: 0, extra_idr: 0, total_idr: 0 });
});

test('convertToKrw applies 100-IDR-based rate and rounds', () => {
  assert.equal(convertToKrw(78000, 8.03), 6263);
});

test('convertToKrw with zero rate returns 0', () => {
  assert.equal(convertToKrw(78000, 0), 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../js/calc.js'`

- [ ] **Step 4: Write minimal implementation — `js/calc.js`**

```js
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json js/calc.js tests/calc.test.js
git commit -m "feat: add tax/total/KRW calculation math"
```

---

### Task 2: Pure entry operations (`js/entries.js`)

**Files:**
- Create: `js/entries.js`
- Test: `tests/entries.test.js`

**Interfaces:**
- Consumes: `computeTotals`, `convertToKrw` from `js/calc.js` (Task 1)
- Produces: `createEntry({tab_type, date, items, tax_mode, tax_rate, service_rate, fx_rate_snapshot, memo}, idGenerator = () => crypto.randomUUID()) -> entry`
- Produces: `addEntry(entries, entry) -> newEntries`
- Produces: `updateEntry(entries, id, patch) -> newEntries` (recomputes `subtotal_idr/extra_idr/total_idr/total_krw`)
- Produces: `removeEntry(entries, id) -> newEntries`
- Produces: `filterByTab(entries, tabType) -> entries`
- Produces: `sortByDateDesc(entries) -> entries`
- Produces: `sumTotals(entries) -> {total_idr, total_krw}`

- [ ] **Step 1: Write the failing test — `tests/entries.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEntry, addEntry, updateEntry, removeEntry, filterByTab, sortByDateDesc, sumTotals
} from '../js/entries.js';

const sampleItems = [{ name: 'Nasi Goreng', price_idr: 50000 }];
let idCounter = 0;
const testIdGen = () => `id-${++idCounter}`;

test('createEntry computes totals and assigns id', () => {
  const entry = createEntry({
    tab_type: 'shared',
    date: '2026-08-01T10:00:00.000Z',
    items: sampleItems,
    tax_mode: 'plus',
    tax_rate: 10,
    service_rate: 10,
    fx_rate_snapshot: 8.03,
    memo: '우붓 맛집'
  }, testIdGen);
  assert.equal(entry.id, 'id-1');
  assert.equal(entry.subtotal_idr, 50000);
  assert.equal(entry.extra_idr, 5000);
  assert.equal(entry.total_idr, 55000);
  assert.equal(entry.total_krw, 4417);
  assert.equal(entry.memo, '우붓 맛집');
});

test('createEntry defaults memo to empty string', () => {
  const entry = createEntry({
    tab_type: 'personal', date: '2026-08-01T10:00:00.000Z', items: sampleItems,
    tax_mode: 'none', tax_rate: 0, service_rate: 0, fx_rate_snapshot: 8.03
  }, testIdGen);
  assert.equal(entry.memo, '');
});

test('addEntry prepends new entry', () => {
  const existing = [{ id: 'old' }];
  const result = addEntry(existing, { id: 'new' });
  assert.deepEqual(result, [{ id: 'new' }, { id: 'old' }]);
});

test('updateEntry recomputes totals when items change', () => {
  const entry = createEntry({
    tab_type: 'shared', date: '2026-08-01T10:00:00.000Z', items: sampleItems,
    tax_mode: 'none', tax_rate: 0, service_rate: 0, fx_rate_snapshot: 8.03
  }, testIdGen);
  const updated = updateEntry([entry], entry.id, { items: [{ name: 'Nasi Goreng', price_idr: 100000 }] });
  assert.equal(updated[0].subtotal_idr, 100000);
  assert.equal(updated[0].total_idr, 100000);
});

test('updateEntry recomputes total_krw when fx_rate_snapshot changes', () => {
  const entry = createEntry({
    tab_type: 'shared', date: '2026-08-01T10:00:00.000Z', items: sampleItems,
    tax_mode: 'none', tax_rate: 0, service_rate: 0, fx_rate_snapshot: 8.03
  }, testIdGen);
  const updated = updateEntry([entry], entry.id, { fx_rate_snapshot: 9 });
  assert.equal(updated[0].total_krw, 4500);
});

test('removeEntry drops matching id', () => {
  const result = removeEntry([{ id: 'a' }, { id: 'b' }], 'a');
  assert.deepEqual(result, [{ id: 'b' }]);
});

test('filterByTab keeps only matching tab_type', () => {
  const entries = [{ tab_type: 'shared' }, { tab_type: 'personal' }];
  assert.deepEqual(filterByTab(entries, 'personal'), [{ tab_type: 'personal' }]);
});

test('sortByDateDesc orders newest first', () => {
  const entries = [{ date: '2026-08-01' }, { date: '2026-08-03' }, { date: '2026-08-02' }];
  const sorted = sortByDateDesc(entries);
  assert.deepEqual(sorted.map((e) => e.date), ['2026-08-03', '2026-08-02', '2026-08-01']);
});

test('sumTotals adds idr and krw across entries', () => {
  const entries = [{ total_idr: 100, total_krw: 8 }, { total_idr: 200, total_krw: 16 }];
  assert.deepEqual(sumTotals(entries), { total_idr: 300, total_krw: 24 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../js/entries.js'`

- [ ] **Step 3: Write minimal implementation — `js/entries.js`**

```js
import { computeTotals, convertToKrw } from './calc.js';

export function createEntry(
  { tab_type, date, items, tax_mode, tax_rate, service_rate, fx_rate_snapshot, memo },
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
    memo: memo || ''
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all Task 1 + Task 2 tests, 17 total)

- [ ] **Step 5: Commit**

```bash
git add js/entries.js tests/entries.test.js
git commit -m "feat: add pure entry CRUD/filter/sort/sum operations"
```

---

### Task 3: localStorage wrappers (`js/storage.js`)

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces: `loadEntries(storage = window.localStorage) -> entries[]`
- Produces: `saveEntries(entries, storage = window.localStorage) -> void`
- Produces: `loadLastRate(tabType, storage = window.localStorage) -> number` (default `8.03`)
- Produces: `saveLastRate(tabType, rate, storage = window.localStorage) -> void`
- Produces: `loadLastTaxRates(storage = window.localStorage) -> {tax_rate, service_rate}` (default `{10, 10}`)
- Produces: `saveLastTaxRates(tax_rate, service_rate, storage = window.localStorage) -> void`

- [ ] **Step 1: Write the failing test — `tests/storage.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadEntries, saveEntries, loadLastRate, saveLastRate, loadLastTaxRates, saveLastTaxRates
} from '../js/storage.js';

class FakeStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
}

test('loadEntries returns empty array when nothing stored', () => {
  assert.deepEqual(loadEntries(new FakeStorage()), []);
});

test('saveEntries then loadEntries round-trips data', () => {
  const storage = new FakeStorage();
  saveEntries([{ id: 'a' }], storage);
  assert.deepEqual(loadEntries(storage), [{ id: 'a' }]);
});

test('loadEntries falls back to empty array on corrupt JSON', () => {
  const storage = new FakeStorage();
  storage.setItem('bali_expense_entries', '{not valid json');
  assert.deepEqual(loadEntries(storage), []);
});

test('loadLastRate defaults to 8.03 when unset', () => {
  assert.equal(loadLastRate('shared', new FakeStorage()), 8.03);
});

test('saveLastRate then loadLastRate round-trips per tab', () => {
  const storage = new FakeStorage();
  saveLastRate('shared', 8.5, storage);
  saveLastRate('personal', 9.1, storage);
  assert.equal(loadLastRate('shared', storage), 8.5);
  assert.equal(loadLastRate('personal', storage), 9.1);
});

test('loadLastTaxRates defaults to 10/10 when unset', () => {
  assert.deepEqual(loadLastTaxRates(new FakeStorage()), { tax_rate: 10, service_rate: 10 });
});

test('saveLastTaxRates then loadLastTaxRates round-trips', () => {
  const storage = new FakeStorage();
  saveLastTaxRates(5, 7, storage);
  assert.deepEqual(loadLastTaxRates(storage), { tax_rate: 5, service_rate: 7 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../js/storage.js'`

- [ ] **Step 3: Write minimal implementation — `js/storage.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all Task 1 + 2 + 3 tests, 24 total)

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: add localStorage wrappers for entries and last-used rates"
```

---

### Task 4: Page structure and styling (`index.html`, `css/styles.css`)

**Files:**
- Create: `index.html`
- Create: `css/styles.css`

**Interfaces:**
- Produces: DOM element ids/classes that `js/app.js` (Task 5) binds to — listed exactly below. Any change to these names in this task must be mirrored in Task 5.
  - Tabs: `.tab-btn[data-tab="shared"|"personal"]`
  - View switch: `.view-btn[data-view="calculator"|"ledger"]`, sections `#calculator-view.view`, `#ledger-view.view`
  - Tax mode: `.tax-mode-btn[data-mode="none"|"plus"|"plusplus"]`
  - Inputs: `#tax-rate-input`, `#service-rate-input`, `#fx-rate-input`, `#memo-input`
  - Items: `#items-list`, `#add-item-btn`
  - Totals: `#subtotal-display`, `#extra-display`, `#total-idr-display`, `#total-krw-display`
  - Save: `#save-entry-btn`
  - Ledger: `#ledger-list`, `#ledger-summary-idr`, `#ledger-summary-krw`, `#filter-start-date`, `#filter-end-date`
  - Export: `#export-btn`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>발리 경비 계산기</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="app">
    <header class="tabs">
      <button class="tab-btn active" data-tab="shared">같이</button>
      <button class="tab-btn" data-tab="personal">개인</button>
    </header>

    <nav class="view-switch">
      <button class="view-btn active" data-view="calculator">계산기</button>
      <button class="view-btn" data-view="ledger">가계부</button>
    </nav>

    <main>
      <section id="calculator-view" class="view active">
        <div class="tax-mode-toggle">
          <button class="tax-mode-btn active" data-mode="none">가격만</button>
          <button class="tax-mode-btn" data-mode="plus">+</button>
          <button class="tax-mode-btn" data-mode="plusplus">++</button>
        </div>

        <div class="rate-inputs">
          <label>세금 %<input type="number" id="tax-rate-input" min="0" step="0.1"></label>
          <label>서비스차지 %<input type="number" id="service-rate-input" min="0" step="0.1" disabled></label>
        </div>

        <div class="fx-input">
          <label>환율 (100루피아 = 원)<input type="number" id="fx-rate-input" min="0" step="0.01"></label>
        </div>

        <div id="items-list" class="items-list"></div>
        <button id="add-item-btn" class="btn-outline">+ 메뉴 추가</button>

        <div class="totals">
          <div class="totals-row"><span>소계</span><span id="subtotal-display">Rp 0</span></div>
          <div class="totals-row"><span>추가요금</span><span id="extra-display">Rp 0</span></div>
          <div class="totals-row total-final"><span>총액</span><span id="total-idr-display">Rp 0</span></div>
          <div class="totals-row total-krw"><span>원화 총액</span><span id="total-krw-display">₩0</span></div>
        </div>

        <label>메모(선택)<input type="text" id="memo-input" placeholder="예: 우붓 맛집"></label>

        <button id="save-entry-btn" class="btn-primary" disabled>저장하기</button>
      </section>

      <section id="ledger-view" class="view">
        <div class="ledger-summary">
          <span id="ledger-summary-idr">Rp 0</span>
          <span id="ledger-summary-krw">₩0</span>
        </div>
        <div class="date-filter">
          <input type="date" id="filter-start-date">
          <input type="date" id="filter-end-date">
        </div>
        <div id="ledger-list" class="ledger-list"></div>
      </section>
    </main>

    <button id="export-btn" class="btn-outline export-btn">내보내기 (JSON)</button>
  </div>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/styles.css`**

```css
:root {
  --color-primary: #0cefd3;
  --color-canvas: #ffffff;
  --color-panel: #f6f6f6;
  --color-fg: #222222;
  --color-muted: #6c6d6f;
  --color-border: #a6a7a9;
  --color-disabled: #cccccc;
  --radius-lg: 12px;
  --radius-sm: 8px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 20px;
  --space-xl: 24px;
  --space-xxl: 32px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--color-panel);
  color: var(--color-fg);
}

.app {
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-md);
  min-height: 100vh;
  background: var(--color-canvas);
}

.tabs, .view-switch {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn, .view-btn {
  flex: 1;
  padding: var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-panel);
  color: var(--color-muted);
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
}

.tab-btn.active, .view-btn.active {
  background: var(--color-primary);
  color: var(--color-fg);
}

.view { display: none; }
.view.active { display: block; }

.tax-mode-toggle {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tax-mode-btn {
  flex: 1;
  padding: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-canvas);
  cursor: pointer;
}

.tax-mode-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.rate-inputs, .fx-input {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.rate-inputs label, .fx-input label {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  color: var(--color-muted);
  gap: 4px;
}

input[type="number"], input[type="text"], input[type="date"] {
  padding: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 16px;
}

input:disabled { background: var(--color-panel); color: var(--color-disabled); }

.items-list {
  max-height: 320px;
  overflow-y: auto;
  margin-bottom: var(--space-sm);
}

.item-row {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
  align-items: center;
}

.item-row input[name="item-name"] { flex: 2; }
.item-row input[name="item-price"] { flex: 1; }

.item-delete-btn {
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 0 var(--space-xs);
}

.btn-primary, .btn-outline {
  display: block;
  width: 100%;
  height: 52px;
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: var(--space-md);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-fg);
}

.btn-primary:disabled {
  background: var(--color-disabled);
  color: var(--color-canvas);
  cursor: not-allowed;
}

.btn-outline {
  border: 1px solid var(--color-border);
  background: var(--color-canvas);
  color: var(--color-fg);
}

.totals {
  background: var(--color-panel);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

.totals-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.total-final { font-weight: 700; border-top: 1px solid var(--color-border); }
.total-krw { color: var(--color-primary); font-weight: 700; }

.ledger-summary {
  display: flex;
  justify-content: space-between;
  background: var(--color-panel);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  font-weight: 700;
}

.date-filter {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.ledger-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.ledger-item-header {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
}

.ledger-item-detail { display: none; margin-top: var(--space-sm); }
.ledger-item.expanded .ledger-item-detail { display: block; }

.ledger-item-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.export-btn { margin-top: var(--space-lg); }
```

- [ ] **Step 3: Manual verification**

Open `index.html` directly in a browser (double-click or `file://` path). Expected: mint-accented tab bar renders, calculator view shows with disabled service-rate field, no console errors (a 404 for `js/app.js` is expected and fine at this point — it does not exist until Task 5).

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: add static page structure and Baemin-derived styling"
```

---

### Task 5: DOM wiring — calculator, ledger, edit, export (`js/app.js`)

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Consumes: `computeTotals`, `convertToKrw` from `js/calc.js`
- Consumes: `createEntry, addEntry, updateEntry, removeEntry, filterByTab, sortByDateDesc, sumTotals` from `js/entries.js`
- Consumes: `loadEntries, saveEntries, loadLastRate, saveLastRate, loadLastTaxRates, saveLastTaxRates` from `js/storage.js`
- Consumes: DOM ids/classes defined in Task 4
- Produces: none (top-level script, no exports needed — it is the app entry point loaded via `<script type="module" src="js/app.js">`)

- [ ] **Step 1: Write `js/app.js`**

```js
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
    if (filterStart && entry.date < filterStart) return false;
    if (filterEnd && entry.date > filterEnd) return false;
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
  header.innerHTML = `<span>${entry.date.slice(0, 10)} ${entry.memo ? '· ' + entry.memo : ''}</span><span>${formatKrw(entry.total_krw)}</span>`;
  header.addEventListener('click', () => container.classList.toggle('expanded'));

  const detail = document.createElement('div');
  detail.className = 'ledger-item-detail';

  const itemsHtml = entry.items.map((item) => `<div>${item.name} — ${formatIdr(item.price_idr)}</div>`).join('');
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
```

- [ ] **Step 2: Manual verification checklist (open `index.html` in a browser)**

1. 같이 탭에서 환율 8.5 입력 → 개인 탭 전환 → 환율 입력칸이 별도 기본값(8.03)인지 확인 → 다시 같이 탭 전환 → 8.5로 남아있는지 확인.
2. 메뉴 2개 추가(이름+가격), 세금모드 `++`로 전환 → 세금/서비스차지 % 입력 가능해지는지, 소계/추가요금/총액(Rp)/총액(원) 실시간 갱신 확인.
3. 메뉴 0개면 저장 버튼 비활성 확인. 메뉴 추가 후 활성화 확인.
4. "저장하기" 클릭 → 가계부 뷰로 이동, 방금 저장한 항목이 리스트 최상단에 보이는지 확인.
5. 가계부 항목 클릭 → 상세 펼침(메뉴 목록, 세금모드, 환율) 확인.
6. 상세의 환율 입력값을 바꾸고 포커스 아웃 → 원화 총액(₩) 헤더 표시가 즉시 재계산되는지 확인.
7. "수정" 클릭 → 계산기 뷰로 돌아가 기존 값이 채워지는지, 저장 버튼 텍스트가 "수정 저장"인지 확인 → 값 변경 후 저장 → 가계부에 갯수 그대로(새로 안 늘어남) 반영되는지 확인.
8. "삭제" 클릭 → confirm 후 리스트에서 제거되는지 확인.
9. 날짜 필터(시작/끝) 입력 → 리스트가 범위로 좁혀지는지 확인.
10. "내보내기" 클릭 → `bali-expenses-YYYY-MM-DD.json` 파일이 다운로드되고, 내용이 pretty-printed JSON `{"entries": [...]}` 형태인지 확인.
11. 브라우저 새로고침 → 저장된 항목/마지막 환율/마지막 세금% 이 그대로 유지되는지 확인 (localStorage 영속성).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: wire up calculator, ledger, edit, and export UI"
```

---

### Task 6: README and GitHub Pages deploy

**Files:**
- Create: `README.md`

**Interfaces:**
- None (documentation + deployment task).

- [ ] **Step 1: Create `README.md`**

```markdown
# 발리 경비 계산기

발리 여행 중 식당/쇼핑 계산서를 세금·서비스차지 구조로 계산하고, 가계부로 저장하는 정적 웹앱.
로그인/서버 없음 — 모든 데이터는 브라우저 `localStorage`에만 저장됨.

## 로컬 실행

그냥 `index.html`을 브라우저로 열면 됨. 빌드 과정 없음.

## 테스트

```bash
npm test
```

## 배포 (GitHub Pages)

1. GitHub 저장소 Settings → Pages → Source를 `main` 브랜치 `/ (root)`로 설정.
2. 몇 분 후 `https://foxyroxy22.github.io/bali-calculater/` 에서 접속 가능.
3. 아이폰: Safari로 위 주소 접속 → 공유 버튼 → "홈 화면에 추가" 하면 앱처럼 아이콘 생김.

## 데이터 내보내기

가계부 화면 하단 "내보내기 (JSON)" 버튼 → `bali-expenses-YYYY-MM-DD.json` 다운로드.
파일 구조: `{"entries": [{id, tab_type, date, items, tax_mode, tax_rate, service_rate, subtotal_idr, extra_idr, total_idr, fx_rate_snapshot, total_krw, memo}, ...]}`
```

- [ ] **Step 2: Verify test suite is green end-to-end**

Run: `npm test`
Expected: PASS (all 24 tests across `calc.test.js`, `entries.test.js`, `storage.test.js`)

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: add README with local run, test, and GitHub Pages deploy steps"
git branch -M main
git push -u origin main
```

- [ ] **Step 4: Enable GitHub Pages**

In the GitHub repo (`https://github.com/foxyroxy22/bali-calculater`): Settings → Pages → Source → Deploy from a branch → `main` / `/ (root)` → Save. Confirm the app loads at the generated `github.io` URL and repeat the Task 5 manual checklist there (mobile Safari included, since that is the real usage device).
