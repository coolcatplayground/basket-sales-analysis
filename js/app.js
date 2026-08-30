/*
 * app.js — loads the demo data, wires the parameters to the engine, renders the result.
 * All arithmetic lives in kpi.js; this file only reads the controls and writes the DOM.
 * Every user-visible string comes from i18n.js, so a language change re-renders in place.
 */
(function () {
  'use strict';

  var DEFAULTS = { start: 20250121, end: 20260620, product: 'All' };

  var state = {
    base: null, products: [], result: null, scan: null,
    sort: { key: 'revenueRank', dir: 1 }
  };

  /* A product is called out only when its two ranks differ by this much AND it has
     enough customers behind it for the rank to mean anything. Without the second test
     a product with four buyers can top the list on noise alone. */
  var CALLOUT_GAP = 3;
  var CALLOUT_MIN_CUSTOMERS = 20;

  /* --- small helpers ---------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function t(key, vars) { return I18N.t(key, vars); }

  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }

  function fmtYen(n) { return '¥' + fmtInt(n); }

  function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }

  function fmtDays(n) { return n ? n.toFixed(1) : '—'; }

  function toInputDate(n) {
    var s = String(n);
    return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  }

  function fromInputDate(s) { return parseInt(s.replace(/-/g, ''), 10); }

  function fail(message) {
    var banner = $('error-banner');
    banner.hidden = false;
    banner.innerHTML = message;
  }

  /*
   * A minimal CSV reader. The demo files are generated, contain no embedded commas
   * or quotes, and are checked into the repo — so a full RFC 4180 parser would be
   * more machinery than the input warrants.
   */
  function parseCsv(text) {
    var lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
    var head = lines[0].split(',');
    return lines.slice(1).map(function (line) {
      var cells = line.split(',');
      var row = {};
      head.forEach(function (h, i) { row[h] = cells[i]; });
      return row;
    });
  }

  /* --- rendering -------------------------------------------------------- */

  function tiles(host, items) {
    host.textContent = '';
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      var wrap = document.createElement('dl');
      wrap.className = 'tile';
      var dt = document.createElement('dt');
      dt.textContent = it.label;
      var dd = document.createElement('dd');
      dd.textContent = it.value;
      if (it.unit) {
        var u = document.createElement('span');
        u.className = 'unit';
        u.textContent = it.unit;
        dd.appendChild(u);
      }
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      frag.appendChild(wrap);
    });
    host.appendChild(frag);
  }

  function renderKpi1(r) {
    var s = r.summary;
    tiles($('kpi1-tiles'), [
      { label: t('tRevenue'), value: fmtYen(s.revenue) },
      { label: t('tUnits'), value: fmtInt(s.units), unit: t('uItems') },
      { label: t('tLines'), value: fmtInt(s.lines), unit: t('uLines') },
      { label: t('tCustomers'), value: fmtInt(s.customers), unit: t('uPeople') },
      { label: t('tNew'), value: fmtInt(s.newCustomers), unit: t('uPeople') },
      { label: t('tExisting'), value: fmtInt(s.existingCustomers), unit: t('uPeople') },
      { label: t('tAov'), value: fmtYen(s.avgOrderValue) },
      { label: t('tAvgQty'), value: s.avgQty.toFixed(2), unit: t('uItems') }
    ]);
  }

  function renderCharts(r) {
    var months = r.monthly;

    Charts.render($('chart-revenue'), months, {
      ariaLabel: t('ch1Title'),
      series: [{
        label: t('tRevenue'), color: 'var(--series-1)',
        value: function (m) { return m.revenue; }
      }],
      max: Math.max.apply(null, months.map(function (m) { return m.revenue; }).concat([1])),
      total: function (m) { return m.revenue; },
      tickFormat: Charts.yenTick,
      labelPeak: true,
      peakFormat: function (v) { return Charts.yenTick(v); },
      tipHtml: function (m) {
        return '<b>' + m.label + '</b>' +
          '<div class="row"><span>' + t('tipRevenue') + '</span><span class="v">' +
          fmtYen(m.revenue) + '</span></div>' +
          '<div class="row"><span>' + t('tipLines') + '</span><span class="v">' +
          fmtInt(m.lines) + '</span></div>' +
          '<div class="row"><span>' + t('tipCustomers') + '</span><span class="v">' +
          fmtInt(m.customers) + '</span></div>';
      }
    });

    var custSeries = [
      { label: t('legNew'), color: 'var(--series-1)',
        value: function (m) { return m.newCustomers; } },
      { label: t('legExisting'), color: 'var(--series-2)',
        value: function (m) { return m.existingCustomers; } }
    ];
    var custHost = $('chart-customers');
    Charts.render(custHost, months, {
      ariaLabel: t('ch2Title'),
      series: custSeries,
      max: Math.max.apply(null, months.map(function (m) { return m.customers; }).concat([1])),
      total: function (m) { return m.customers; },
      tickFormat: function (v) { return fmtInt(v); },
      labelPeak: false,
      peakFormat: fmtInt,
      tipHtml: function (m) {
        return '<b>' + m.label + '</b>' +
          '<div class="row"><span class="swatch" style="background:var(--series-1)"></span>' +
          '<span>' + t('tipNew') + '</span><span class="v">' + fmtInt(m.newCustomers) +
          '</span></div>' +
          '<div class="row"><span class="swatch" style="background:var(--series-2)"></span>' +
          '<span>' + t('tipExisting') + '</span><span class="v">' + fmtInt(m.existingCustomers) +
          '</span></div>' +
          '<div class="row"><span>' + t('tipTotal') + '</span><span class="v">' +
          fmtInt(m.customers) + '</span></div>';
      }
    });

    /* drop any previous legend before adding this language's */
    var prev = custHost.previousElementSibling;
    if (prev && prev.classList.contains('chart-legend')) prev.remove();
    Charts.legend(custHost, custSeries);
  }

  function renderMonthlyTable(r) {
    var body = $('monthly-table').querySelector('tbody');
    body.textContent = '';
    r.monthly.forEach(function (m) {
      var tr = document.createElement('tr');
      if (m.lines === 0 && m.customers === 0) tr.className = 'zero-row';
      [m.label, fmtInt(m.revenue), fmtInt(m.units), fmtInt(m.lines),
       fmtInt(m.customers), fmtInt(m.newCustomers), fmtInt(m.existingCustomers)
      ].forEach(function (v, i) {
        var cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.setAttribute('scope', 'row');
        cell.textContent = v;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
  }

  function renderKpi2(r) {
    var c = r.cohorts.total;
    tiles($('kpi2-tiles'), [
      { label: t('tAcquired'), value: fmtInt(c.acquired), unit: t('uPeople') },
      { label: t('tRepeated'), value: fmtInt(c.repeated), unit: t('uPeople') },
      { label: t('tRepeatRate'), value: fmtPct(c.repeatRate) },
      { label: t('tAvgDays'), value: fmtDays(c.avgDays), unit: t('uDays') }
    ]);

    rankTable($('top1st'), r.top1st);
    rankTable($('top2nd'), r.top2nd);

    var body = $('cohort-table').querySelector('tbody');
    body.textContent = '';
    r.cohorts.rows.forEach(function (row) {
      var tr = document.createElement('tr');
      [row.label, fmtInt(row.acquired), fmtInt(row.repeated),
       row.acquired ? fmtPct(row.repeatRate) : '—',
       row.repeated ? fmtDays(row.avgDays) : '—'
      ].forEach(function (v, i) {
        var cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.setAttribute('scope', 'row');
        cell.textContent = v;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
    $('cohort-count').textContent = t('cohortCount', { n: r.cohorts.rows.length });
  }

  function rankTable(table, rows) {
    var body = table.querySelector('tbody');
    body.textContent = '';
    if (!rows.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = t('noRows');
      td.style.textAlign = 'center';
      td.style.color = 'var(--text-muted)';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    var top = rows[0].lines || 1;
    rows.forEach(function (e) {
      var tr = document.createElement('tr');

      var code = document.createElement('th');
      code.setAttribute('scope', 'row');
      code.textContent = e.code;
      tr.appendChild(code);

      var name = document.createElement('td');
      name.textContent = e.name;
      tr.appendChild(name);

      var lines = document.createElement('td');
      lines.className = 'num-col';
      lines.appendChild(document.createTextNode(fmtInt(e.lines)));
      var bar = document.createElement('span');
      bar.className = 'cell-bar';
      bar.style.width = Math.max(4, (e.lines / top) * 100) + '%';
      lines.appendChild(bar);
      tr.appendChild(lines);

      var rev = document.createElement('td');
      rev.className = 'num-col';
      rev.textContent = fmtInt(e.revenue);
      tr.appendChild(rev);

      body.appendChild(tr);
    });
  }

  /* --- ③ which products acquire customers -------------------------------- */

  function renderProductScan() {
    var scan = state.scan;
    var n = scan.length;

    var highlighted = scan.filter(function (e) {
      return e.gap >= CALLOUT_GAP && e.acquired >= CALLOUT_MIN_CUSTOMERS;
    }).sort(function (a, b) { return b.gap - a.gap || b.acquired - a.acquired; });
    var isHigh = {};
    highlighted.forEach(function (e) { isHigh[e.code] = true; });

    var legend = $('scatter-legend');
    legend.textContent = '';
    [[t('k3LegendHi'), 'var(--series-1)'], [t('k3LegendRest'), 'var(--text-muted)']]
      .forEach(function (pair) {
        var li = document.createElement('li');
        var sw = document.createElement('span');
        sw.className = 'swatch';
        sw.style.background = pair[1];
        li.appendChild(sw);
        li.appendChild(document.createTextNode(pair[0]));
        legend.appendChild(li);
      });

    Charts.scatter($('chart-scatter'), scan.map(function (e) {
      return {
        x: e.revenueRank, y: e.acquiredRank, code: e.code, highlight: !!isHigh[e.code],
        entry: e
      };
    }), {
      max: n,
      ariaLabel: t('k3ChartTitle'),
      xLabel: t('k3XLabel'),
      yLabel: t('k3YLabel'),
      diagonalLabel: t('k3Diagonal'),
      tipHtml: function (p) {
        var e = p.entry;
        return '<b>' + e.code + ' ' + e.name + '</b>' +
          '<div class="row"><span>' + t('thRevenue') + '</span><span class="v">' +
          fmtYen(e.revenue) + ' (#' + e.revenueRank + ')</span></div>' +
          '<div class="row"><span>' + t('thAcquired') + '</span><span class="v">' +
          fmtInt(e.acquired) + ' (#' + e.acquiredRank + ')</span></div>' +
          '<div class="row"><span>' + t('tRepeatRate') + '</span><span class="v">' +
          fmtPct(e.repeatRate) + '</span></div>';
      }
    });

    var callout = $('k3-callout');
    callout.hidden = false;
    if (highlighted.length) {
      callout.innerHTML = t('k3Callout', {
        list: highlighted.slice(0, 4).map(function (e) {
          return e.code + ' ' + e.name;
        }).join(' / ')
      });
    } else {
      callout.textContent = t('k3CalloutNone');
    }

    renderProductTable(isHigh);
  }

  function renderProductTable(isHigh) {
    var key = state.sort.key;
    var dir = state.sort.dir;
    var rows = state.scan.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (typeof x === 'string') return dir * x.localeCompare(y);
      return dir * (x - y) || a.revenueRank - b.revenueRank;
    });

    var body = $('product-table').querySelector('tbody');
    body.textContent = '';
    rows.forEach(function (e) {
      var tr = document.createElement('tr');
      if (isHigh && isHigh[e.code]) tr.className = 'is-called-out';
      var cells = [
        e.code, e.name, fmtInt(e.revenue), '#' + e.revenueRank,
        fmtInt(e.acquired), '#' + e.acquiredRank,
        e.gap > 0 ? '+' + e.gap : String(e.gap),
        e.acquired ? fmtPct(e.repeatRate) : '—'
      ];
      cells.forEach(function (v, i) {
        var cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.setAttribute('scope', 'row');
        if (i >= 2) cell.className = 'num-col';
        if (i === 6 && e.gap > 0) cell.classList.add('gap-positive');
        cell.textContent = v;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });

    [].forEach.call($('product-table').querySelectorAll('th[data-sort]'), function (th) {
      var active = th.getAttribute('data-sort') === key;
      th.setAttribute('aria-sort', active ? (dir === 1 ? 'ascending' : 'descending') : 'none');
      th.classList.toggle('is-sorted', active);
      th.classList.toggle('is-desc', active && dir === -1);
    });
  }

  function wireSorting() {
    [].forEach.call($('product-table').querySelectorAll('th[data-sort]'), function (th) {
      th.tabIndex = 0;
      var choose = function () {
        var key = th.getAttribute('data-sort');
        if (state.sort.key === key) {
          state.sort.dir = -state.sort.dir;
        } else {
          state.sort.key = key;
          /* ranks read best smallest-first; everything else biggest-first */
          state.sort.dir = key === 'revenueRank' || key === 'acquiredRank' ||
            key === 'code' || key === 'name' ? 1 : -1;
        }
        renderProductScan();
      };
      th.addEventListener('click', choose);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
      });
    });
  }

  /* --- export block ----------------------------------------------------- */
  /* The header row is the analyzer's contract, so it is Japanese in every language. */

  function exportRows(r) {
    var head = ['月別推移', '売上金額', '購入個数', '購入件数', '総顧客数', '新規顧客数', '既存顧客数'];
    var lines = [head];
    r.monthly.forEach(function (m) {
      lines.push([m.label, m.revenue, m.units, m.lines, m.customers,
                  m.newCustomers, m.existingCustomers]);
    });
    return lines;
  }

  function exportText(r, sep) {
    return exportRows(r).map(function (row) { return row.join(sep); }).join('\n');
  }

  function downloadExport() {
    var name = currentParams().productCode;
    saveBlob(new Blob(['﻿' + exportText(state.result, ',')],
                      { type: 'text/csv;charset=utf-8' }), 'monthly_' + name + '.csv');
  }

  /*
   * The analyzer takes .xlsx, not CSV, and reads the product name off the sheet name — so
   * the sheet name is part of the payload, and it stays Japanese in both languages for the
   * same reason the header row does.
   */
  function sheetNameForExport() {
    var code = currentParams().productCode;
    if (String(code).toUpperCase() === 'ALL') return t('allProductsSheet');
    var match = null;
    state.products.forEach(function (p) {
      if (p.code === code) match = p;
    });
    return match ? match.name : code;
  }

  function downloadXlsx() {
    var rows = exportRows(state.result).map(function (row, i) {
      if (i === 0) return row;
      return row.map(function (v, c) { return c === 0 ? v : Number(v); });
    });
    var name = sheetNameForExport();
    var bytes = MiniXlsx.build(name, rows);
    saveBlob(new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), name + '.xlsx');
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function copyExport(button) {
    var text = exportText(state.result, '\t');
    var done = function () {
      button.textContent = t('btnCopied');
      setTimeout(function () { button.textContent = t('btnCopy'); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* nothing to do */ }
    document.body.removeChild(ta);
  }

  /* --- shareable URL ----------------------------------------------------- */
  /*
   * The parameters live in the query string so a particular view can be linked to
   * directly — "here is the CT106 case" rather than "now pick CT106 from the dropdown".
   * replaceState, so changing a date does not fill the back button with history.
   */

  function writeUrl(params) {
    if (!window.history || !history.replaceState) return;
    var q = [];
    /* a pinned language stays pinned across parameter changes */
    if (I18N.pinnedInUrl()) q.push('lang=' + I18N.lang());
    if (params.start !== DEFAULTS.start) q.push('start=' + params.start);
    if (params.end !== DEFAULTS.end) q.push('end=' + params.end);
    if (params.productCode !== DEFAULTS.product) q.push('product=' + params.productCode);
    var url = location.pathname + (q.length ? '?' + q.join('&') : '');
    history.replaceState(null, '', url);
  }

  function readUrl() {
    var out = {};
    var q = location.search.replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (pair) {
      var bits = pair.split('=');
      var k = decodeURIComponent(bits[0]);
      var v = decodeURIComponent(bits[1] || '');
      if (k === 'start' || k === 'end') {
        var n = parseInt(v, 10);
        /* only accept a well-formed YYYYMMDD, so a mangled link falls back to the default */
        if (/^\d{8}$/.test(v) && n) out[k] = n;
      } else if (k === 'product') {
        out.product = v;
      }
    });
    return out;
  }

  /* --- parameters ------------------------------------------------------- */

  /*
   * The master carries a Japanese 商品名称 and an English gloss; the code is the same in
   * both. Everything downstream just reads `.name`, so the language is resolved here.
   */
  function localizedProducts() {
    var en = I18N.lang() === 'en';
    return state.products.map(function (p) {
      return { code: p.code, name: en && p.nameEn ? p.nameEn : p.name };
    });
  }

  function currentParams() {
    return {
      start: fromInputDate($('start').value) || DEFAULTS.start,
      end: fromInputDate($('end').value) || DEFAULTS.end,
      productCode: $('product').value || DEFAULTS.product,
      products: localizedProducts()
    };
  }

  function recompute() {
    var params = currentParams();
    if (params.start > params.end) {
      fail(t('errDates'));
      return;
    }
    $('error-banner').hidden = true;

    state.result = KPI.compute(state.base, params);
    state.scan = KPI.productScan(state.base, params);
    renderKpi1(state.result);
    renderCharts(state.result);
    renderMonthlyTable(state.result);
    renderKpi2(state.result);
    renderProductScan();
    writeUrl(params);

    $('kpi2-scope').textContent = params.productCode.toUpperCase() === 'ALL'
      ? t('k2ScopeAll')
      : t('k2ScopeProduct', { code: params.productCode });
  }

  /* --- boot ------------------------------------------------------------- */

  function fillProducts() {
    var select = $('product');
    var keep = select.value;
    select.textContent = '';
    var all = document.createElement('option');
    all.value = 'All';
    all.textContent = t('productAll');
    select.appendChild(all);
    localizedProducts().forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.code;
      opt.textContent = p.code + ' — ' + p.name;
      select.appendChild(opt);
    });
    select.value = keep || DEFAULTS.product;
  }

  function boot(orders, products) {
    state.products = products;
    state.base = KPI.buildBase(orders);

    fillProducts();

    var initial = readUrl();
    $('start').value = toInputDate(initial.start || DEFAULTS.start);
    $('end').value = toInputDate(initial.end || DEFAULTS.end);
    $('product').value = initial.product && $('product').querySelector(
      'option[value="' + initial.product.replace(/"/g, '') + '"]')
      ? initial.product : DEFAULTS.product;

    wireSorting();

    ['start', 'end', 'product'].forEach(function (id) {
      $(id).addEventListener('change', recompute);
    });
    $('reset').addEventListener('click', function () {
      $('start').value = toInputDate(DEFAULTS.start);
      $('end').value = toInputDate(DEFAULTS.end);
      $('product').value = DEFAULTS.product;
      recompute();
    });
    $('download-export').addEventListener('click', downloadExport);
    $('download-xlsx').addEventListener('click', downloadXlsx);
    $('copy-export').addEventListener('click', function () { copyExport(this); });

    /* i18n.js has already refreshed the static copy; redraw what data produced. */
    I18N.onChange(function () {
      fillProducts();
      if (state.result) recompute();
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (state.result) renderCharts(state.result);
      }, 150);
    });

    $('main').setAttribute('aria-busy', 'false');
    recompute();
  }

  function load() {
    I18N.mount();
    Promise.all([
      fetch('data/orders_demo.csv').then(function (r) {
        if (!r.ok) throw new Error('orders_demo.csv: HTTP ' + r.status);
        return r.text();
      }),
      fetch('data/products_demo.csv').then(function (r) {
        if (!r.ok) throw new Error('products_demo.csv: HTTP ' + r.status);
        return r.text();
      })
    ]).then(function (texts) {
      var orders = parseCsv(texts[0]).map(function (r) {
        return {
          orderNo: r['受注伝票番号'],
          saleDate: +r['売上日'],
          memberId: r['会員ID'],
          regDate: +r['会員登録日'],
          code: r['商品コード'],
          name: r['商品名称'],
          qty: +r['注文数量'],
          amount: +r['商品売価計'],
          status: r['受注ステータス']
        };
      });
      var products = parseCsv(texts[1]).map(function (r) {
        return { code: r['商品コード'], name: r['商品名称'], nameEn: r['商品名称_EN'] };
      });
      boot(orders, products);
    }).catch(function (err) {
      fail(t('errLoad', { msg: err.message }));
      $('main').setAttribute('aria-busy', 'false');
    });
  }

  /* Any uncaught error surfaces at the top of the page instead of failing silently. */
  window.addEventListener('error', function (e) {
    fail(I18N.t('errScript', { msg: e.message || 'unknown' }));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
