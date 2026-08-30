/*
 * The .xlsx the page hands to the seasonal analyzer is written by hand, so it has to be
 * proved readable rather than assumed. This builds one exactly as the browser does and
 * writes it to disk; check_xlsx_export.py then opens it with a real spreadsheet reader and
 * checks the sheet name, the seven contract headers and the values.
 */
const fs = require('fs');
const path = require('path');
const { loadDemoData } = require('./load_demo_data');

const repo = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(repo, 'tools', '.tmp_export.xlsx');

global.window = global;
global.TextEncoder = TextEncoder;
require(path.join(repo, 'js', 'kpi.js'));
require(path.join(repo, 'js', 'xlsx.js'));

const { orders, products } = loadDemoData(repo);
const base = KPI.buildBase(orders);

const productCode = 'CT106';
const product = products.find((p) => p.code === productCode);
const result = KPI.compute(base, {
  start: 20250121, end: 20260620, productCode: productCode, products: products
});

const header = ['月別推移', '売上金額', '購入個数', '購入件数', '総顧客数', '新規顧客数', '既存顧客数'];
const rows = [header].concat(result.monthly.map((m) => [
  m.label, m.revenue, m.units, m.lines, m.customers, m.newCustomers, m.existingCustomers
]));

const bytes = MiniXlsx.build(product.name, rows);
fs.writeFileSync(out, Buffer.from(bytes));

console.log(JSON.stringify({
  file: out,
  bytes: bytes.length,
  sheetName: MiniXlsx.safeSheetName(product.name),
  rows: rows.length,
  firstDataRow: rows[1]
}));
