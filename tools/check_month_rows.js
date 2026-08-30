/*
 * The 月別推移 block is the analyzer's input, so which months it contains is a contract,
 * not a detail. This pins it.
 *
 * The workbook builds the row labels like this:
 *   CONFIG!B4  開始月度の基準日 = DATE(YEAR(fiscal(StartDate)), MONTH(fiscal(StartDate)), 1)
 *   CONFIG!B5  終了月度の基準日 = same, for EndDate
 *   KPI1_MONTHLY!An = IF(EDATE(CONFIG!$B$4, n) > CONFIG!$B$5, "", EDATE(CONFIG!$B$4, n))
 * where fiscal(d) shifts to the next month when DAY(d) >= 21, and the sheet has room for
 * 36 rows.
 *
 * The expectations below were worked out from those formulas by hand, NOT from the engine,
 * so this catches the engine drifting away from the workbook. That matters here: the first
 * port of this block seeded from the raw calendar month instead of the fiscal one, which
 * shifted every row by one — an empty leading month and the newest month missing. Two
 * implementations wrote from the same misreading agreed with each other perfectly, so only
 * a check written from the workbook itself could find it.
 */
const path = require('path');
const { loadDemoData } = require('./load_demo_data');

const repo = path.resolve(__dirname, '..');
global.window = global;
require(path.join(repo, 'js', 'kpi.js'));

const { orders, products } = loadDemoData(repo);
const base = KPI.buildBase(orders);

const CASES = [
  {
    what: 'the default window; starts on the 21st, so the first fiscal month is 25_02',
    start: 20250121, end: 20260620,
    first: '25_02', last: '26_06', count: 17
  },
  {
    what: 'one day earlier: the 20th still belongs to 25_01',
    start: 20250120, end: 20260620,
    first: '25_01', last: '26_06', count: 18
  },
  {
    what: 'a window inside a single fiscal month, both bounds shifted',
    start: 20250125, end: 20250210,
    first: '25_02', last: '25_02', count: 1
  },
  {
    what: 'a window inside a single fiscal month, neither bound shifted',
    start: 20250105, end: 20250120,
    first: '25_01', last: '25_01', count: 1
  },
  {
    what: 'a single day',
    start: 20250515, end: 20250515,
    first: '25_05', last: '25_05', count: 1
  },
  {
    what: 'a window with no orders in it at all still lists its months',
    start: 20260701, end: 20261231,
    first: '26_07', last: '27_01', count: 7
  },
  {
    what: 'a window longer than the sheet: 36 rows and no more',
    start: 20230101, end: 20261231,
    first: '23_01', last: '25_12', count: 36
  }
];

const failures = [];

for (const c of CASES) {
  const monthly = KPI.compute(base, {
    start: c.start, end: c.end, productCode: 'All', products: products
  }).monthly;
  const labels = monthly.map((m) => m.label);

  const got = {
    first: labels[0], last: labels[labels.length - 1], count: labels.length
  };
  const ok = got.first === c.first && got.last === c.last && got.count === c.count;

  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${c.start}..${c.end}  ` +
    `${got.first}..${got.last} (${got.count})  — ${c.what}`);
  if (!ok) {
    failures.push(`${c.start}..${c.end}: expected ${c.first}..${c.last} (${c.count}), ` +
      `got ${got.first}..${got.last} (${got.count})`);
  }

  /* labels must be consecutive months, with no gaps or repeats */
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1].split('_').map(Number);
    const cur = labels[i].split('_').map(Number);
    const step = (cur[0] * 12 + cur[1]) - (prev[0] * 12 + prev[1]);
    if (step !== 1) {
      failures.push(`${c.start}..${c.end}: ${labels[i - 1]} is followed by ${labels[i]}`);
      break;
    }
  }

  /*
   * Nothing may fall outside the listed months: every in-period order line has to land in
   * one of the buckets, so the block cannot quietly drop the newest month again.
   */
  const inside = new Set(labels);
  let orphaned = 0;
  for (const row of base.rows) {
    if (row.saleDate < c.start || row.saleDate > c.end) continue;
    if (!inside.has(row.fiscal)) orphaned += 1;
  }
  if (orphaned && labels.length < 36) {
    failures.push(`${c.start}..${c.end}: ${orphaned} in-period order lines fall outside ` +
      `the listed months`);
  }
}

if (failures.length) {
  console.error(`\nFAILURES (${failures.length}):`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('\nmonth rows match the workbook formulas');
