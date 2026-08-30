/* Runs js/kpi.js outside the browser so its output can be diffed against ref.py. */
const fs = require('fs');
const path = require('path');

/*
 * Resolve to an absolute path before anything else: require() reads a bare relative path
 * like 'js/kpi.js' as a package name, so passing '.' as the base fails with
 * MODULE_NOT_FOUND — which is exactly how this broke in CI while passing locally.
 */
const base = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const scenarios = JSON.parse(
  fs.readFileSync(path.resolve(process.argv[3] || path.join(__dirname, 'scenarios.json')),
                  'utf8')
);

global.window = global;
require(path.join(base, 'js', 'kpi.js'));

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const cells = l.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = cells[i]; });
    return o;
  });
}

const orders = parseCsv(fs.readFileSync(path.join(base, 'data', 'orders_demo.csv'), 'utf8'))
  .map((r) => ({
    orderNo: r['受注伝票番号'],
    saleDate: +r['売上日'],
    memberId: r['会員ID'],
    regDate: +r['会員登録日'],
    code: r['商品コード'],
    name: r['商品名称'],
    qty: +r['注文数量'],
    amount: +r['商品売価計'],
    status: r['受注ステータス']
  }));

const products = parseCsv(fs.readFileSync(path.join(base, 'data', 'products_demo.csv'), 'utf8'))
  .map((r) => ({ code: r['商品コード'], name: r['商品名称'] }));

const kpiBase = KPI.buildBase(orders);
const out = {};
for (const s of scenarios) {
  const r = KPI.compute(kpiBase, {
    start: s.start, end: s.end, productCode: s.product, products: products
  });
  out[s.label] = {
    summary: r.summary,
    monthly: r.monthly.map((m) => ({
      label: m.label, revenue: m.revenue, units: m.units, lines: m.lines,
      customers: m.customers, newCustomers: m.newCustomers,
      existingCustomers: m.existingCustomers
    })),
    cohorts: r.cohorts,
    top1st: r.top1st.map((e) => ({
      code: e.code, name: e.name, lines: e.lines, revenue: e.revenue
    })),
    top2nd: r.top2nd.map((e) => ({
      code: e.code, name: e.name, lines: e.lines, revenue: e.revenue
    }))
  };
}
process.stdout.write(JSON.stringify(out));
