/*
 * productScan takes one pass over first orders and credits every product in the basket,
 * instead of re-running the whole cohort thirty times. That shortcut is only legitimate if
 * it lands on the same numbers, so this asserts it does.
 *
 * Over a window that spans the whole dataset, the scan's period-scoped acquisition and the
 * all-time cohort in compute() must agree exactly, product by product: customers acquired,
 * repeat count, repeat rate and average days to return.
 */
const path = require('path');
const { loadDemoData } = require('./load_demo_data');

const repo = path.resolve(__dirname, '..');
const { orders, products } = loadDemoData(repo);

global.window = global;
require(path.join(repo, 'js', 'kpi.js'));

const base = KPI.buildBase(orders);
const WIDE = { start: 19000101, end: 20991231 };

const scan = KPI.productScan(base, { start: WIDE.start, end: WIDE.end, products: products });
const byCode = new Map(scan.map((e) => [e.code, e]));

const failures = [];

function near(a, b) {
  return Math.abs(a - b) < 1e-9;
}

for (const p of products) {
  const viaCompute = KPI.compute(base, {
    start: WIDE.start, end: WIDE.end, productCode: p.code, products: products
  }).cohorts.total;
  const viaScan = byCode.get(p.code);

  const checks = [
    ['acquired', viaCompute.acquired, viaScan.acquired],
    ['repeated', viaCompute.repeated, viaScan.repeated],
    ['repeatRate', viaCompute.repeatRate, viaScan.repeatRate],
    ['avgDays', viaCompute.avgDays, viaScan.avgDays]
  ];
  for (const [field, expected, actual] of checks) {
    if (!near(expected, actual)) {
      failures.push(`${p.code} ${field}: compute=${expected} scan=${actual}`);
    }
  }
}

/* Ranks must be a permutation of 1..N on each measure, with no gaps or repeats. */
for (const field of ['revenueRank', 'acquiredRank']) {
  const seen = scan.map((e) => e[field]).sort((a, b) => a - b);
  const expect = scan.map((_, i) => i + 1);
  if (JSON.stringify(seen) !== JSON.stringify(expect)) {
    failures.push(`${field} is not a clean 1..${scan.length} ranking`);
  }
}

/* A narrower window can only ever acquire fewer customers than the all-time one. */
const narrow = KPI.productScan(base, { start: 20250101, end: 20251231, products: products });
for (const e of narrow) {
  const all = byCode.get(e.code);
  if (e.acquired > all.acquired) {
    failures.push(`${e.code}: narrow window acquired ${e.acquired} > all-time ${all.acquired}`);
  }
}

console.log(`products checked: ${products.length}`);
const top = scan.slice().sort((a, b) => b.gap - a.gap)[0];
console.log(`widest rank gap: ${top.code} ${top.name} ` +
  `(revenue #${top.revenueRank}, acquisition #${top.acquiredRank}, gap +${top.gap})`);

if (failures.length) {
  console.error(`\nFAILURES (${failures.length}):`);
  failures.slice(0, 20).forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('\nproductScan agrees with compute() on every product');
