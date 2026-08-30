/*
 * kpi.js — the calculation engine, ported from the demo workbook.
 *
 * Every block here mirrors a column or a sheet of EC_Sales_Basket_Analysis_Demo.xlsx, and
 * the sheet and column it came from is named in the comment above it. The workbook is the
 * specification; where the two disagree, the workbook is right.
 *
 * Knows nothing about the DOM — app.js renders whatever this returns.
 */
(function (global) {
  'use strict';

  /* ---------- dates ----------------------------------------------------- */
  /* Dates arrive as YYYYMMDD integers, exactly as they sit in the order table. */

  function ymd(n) {
    return { y: Math.floor(n / 10000), m: Math.floor(n / 100) % 100, d: n % 100 };
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  /* Excel EDATE: add months, clamping the day to the end of the target month. */
  function edate(y, m, d, months) {
    var total = y * 12 + (m - 1) + months;
    var ny = Math.floor(total / 12);
    var nm = (total % 12) + 1;
    return { y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) };
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function monthLabel(y, m) {
    return pad2(y % 100) + '_' + pad2(m);
  }

  function serial(p) {
    return Date.UTC(p.y, p.m - 1, p.d) / 86400000;
  }

  /*
   * DATA_ORDERS!K/L — 月度基準日 and 月度.
   * The accounting month closes on the 20th, so the 21st onward belongs to the next month:
   * =IF(DAY(date)>=21, EDATE(date,1), date), labelled TEXT(...,"yy")&"_"&TEXT(...,"mm").
   */
  function fiscalYM(dateInt) {
    var p = ymd(dateInt);
    return p.d >= 21 ? edate(p.y, p.m, p.d, 1) : p;
  }

  function fiscalLabel(dateInt) {
    var b = fiscalYM(dateInt);
    return monthLabel(b.y, b.m);
  }

  /* Months as a single running index, so "is this month past that one" is one comparison. */
  function monthIndex(y, m) {
    return y * 12 + (m - 1);
  }

  function dayNumber(dateInt) {
    return serial(ymd(dateInt));
  }

  /* ---------- base pass: everything independent of the parameters -------- */
  /*
   * Covers DATA_ORDERS!J-S, U-W. These columns depend only on the raw data, so they are
   * computed once at load and reused for every parameter change.
   *
   * The row-relative formulas (=IF(C3<>C2,...)) assume the table is grouped by member and
   * ordered by date within a member. The shipped CSV satisfies that.
   */
  function buildBase(orders) {
    var rows = orders.map(function (o) {
      var fiscal = fiscalLabel(o.saleDate);
      var regFiscal = fiscalLabel(o.regDate);
      return {
        orderNo: o.orderNo,
        saleDate: o.saleDate,
        memberId: o.memberId,
        regDate: o.regDate,
        code: o.code,
        name: o.name,
        qty: o.qty,
        amount: o.amount,
        status: o.status,
        fiscal: fiscal,                        /* L  月度 */
        regFiscal: regFiscal,                  /* O  登録月度 */
        isNew: fiscal === regFiscal ? 1 : 0,   /* P  新規フラグ */
        /* Q/R/S 分析用売上・購入個数・購入件数 — signed, so returns subtract. */
        sgnAmount: o.status === '11' ? o.amount : o.status === '14' ? -o.amount : 0,
        sgnQty: o.status === '11' ? o.qty : o.status === '14' ? -o.qty : 0,
        sgnLines: o.status === '11' ? 1 : o.status === '14' ? -1 : 0,
        rank: 0
      };
    });

    /*
     * V 購入順位 — rank per customer over completed orders only, so a cancelled order
     * does not consume a rank. U 新伝票 marks the first line of each order.
     */
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var prev = i > 0 ? rows[i - 1] : null;
      var newOrder = !prev || r.orderNo !== prev.orderNo;
      if (!prev || r.memberId !== prev.memberId) {
        r.rank = r.status === '11' ? 1 : 0;
      } else if (newOrder && r.status === '11') {
        r.rank = prev.rank + 1;
      } else {
        r.rank = prev.rank;
      }
    }

    /* Index by order and by member so the parameter pass never rescans the table. */
    var byOrder = new Map();
    var members = new Map();
    rows.forEach(function (r, i) {
      if (!byOrder.has(r.orderNo)) byOrder.set(r.orderNo, []);
      byOrder.get(r.orderNo).push(i);
      if (!members.has(r.memberId)) {
        members.set(r.memberId, { id: r.memberId, rows: [], regFiscal: r.regFiscal });
      }
      members.get(r.memberId).rows.push(i);
    });

    /* MEMBERS!C-F — the first and second order, found through the id#rank key. */
    members.forEach(function (m) {
      m.first = null;
      m.second = null;
      for (var k = 0; k < m.rows.length; k++) {
        var r = rows[m.rows[k]];
        if (m.first === null && r.rank === 1) m.first = { orderNo: r.orderNo, date: r.saleDate };
        if (m.second === null && r.rank === 2) m.second = { orderNo: r.orderNo, date: r.saleDate };
      }
    });

    return { rows: rows, byOrder: byOrder, members: members };
  }

  /* ---------- parameter pass -------------------------------------------- */

  function compute(base, params) {
    var rows = base.rows;
    var start = params.start;
    var end = params.end;
    var pc = String(params.productCode || 'All').toUpperCase();
    var isAll = pc === 'ALL';
    var i;

    /* T 期間内, AF 対象商品行 */
    var inPeriod = new Array(rows.length);
    var targetLine = new Array(rows.length);
    for (i = 0; i < rows.length; i++) {
      inPeriod[i] = rows[i].saleDate >= start && rows[i].saleDate <= end ? 1 : 0;
      targetLine[i] = isAll || rows[i].code.toUpperCase() === pc ? 1 : 0;
    }

    /*
     * AG 伝票対象 — does this ORDER contain the product, rather than does this line.
     * This is the whole point of the basket analysis: an order qualifies as a unit and
     * then every line of it is kept, which is why the co-purchase tables carry
     * information instead of restating the filter.
     */
    var orderHasTarget = new Map();
    base.byOrder.forEach(function (idxs, orderNo) {
      var hit = false;
      for (var k = 0; k < idxs.length; k++) {
        if (targetLine[idxs[k]]) { hit = true; break; }
      }
      orderHasTarget.set(orderNo, hit);
    });

    /* MEMBERS!G-K — qualification, repeat status, elapsed days. */
    var memberState = new Map();
    base.members.forEach(function (m) {
      var qualifies = m.first ? orderHasTarget.get(m.first.orderNo) === true : false;
      var firstInPeriod = m.first ? m.first.date >= start && m.first.date <= end : false;
      var repeated = qualifies && m.second !== null;
      memberState.set(m.id, {
        regFiscal: m.regFiscal,
        qualifies: qualifies,
        firstInPeriod: firstInPeriod,
        repeated: repeated,
        /* I 経過日数 — only meaningful for a member who came back. */
        days: repeated ? dayNumber(m.second.date) - dayNumber(m.first.date) : null,
        /* K TOP10_2ND資格 — qualified AND acquired inside the period. */
        top2nd: qualifies && firstInPeriod
      });
    });

    /*
     * DATA_ORDERS!X-AE — running counters that collapse a customer's repeated appearances
     * into a single "first seen" flag, so each customer is counted once per scope.
     */
    var firstSeenPeriod = new Array(rows.length);
    var firstSeenMonth = new Array(rows.length);
    var firstSeenNew = new Array(rows.length);
    var firstSeenExisting = new Array(rows.length);
    var cumPeriod = 0, cumMonth = 0, cumNew = 0, cumExisting = 0;

    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      var prev = i > 0 ? rows[i - 1] : null;
      var memberChanged = !prev || row.memberId !== prev.memberId;
      var monthChanged = memberChanged || row.fiscal !== prev.fiscal;
      var t = inPeriod[i];
      var tNew = t * row.isNew;
      var tExisting = t * (1 - row.isNew);

      cumPeriod = memberChanged ? t : cumPeriod + t;
      cumMonth = monthChanged ? t : cumMonth + t;
      cumNew = memberChanged ? tNew : cumNew + tNew;
      cumExisting = memberChanged ? tExisting : cumExisting + tExisting;

      firstSeenPeriod[i] = t === 1 && cumPeriod === 1 ? 1 : 0;              /* Y  期間内会員初出 */
      firstSeenMonth[i] = t === 1 && cumMonth === 1 ? 1 : 0;                /* AA 月内初出 */
      firstSeenNew[i] = tNew === 1 && cumNew === 1 ? 1 : 0;                 /* AC 期間内新規初出 */
      firstSeenExisting[i] = tExisting === 1 && cumExisting === 1 ? 1 : 0;  /* AE 期間内既存初出 */
    }

    /* AI TOP10_1ST対象 / AJ TOP10_2ND対象 — the two basket flags. */
    var flag1st = new Array(rows.length);
    var flag2nd = new Array(rows.length);
    for (i = 0; i < rows.length; i++) {
      var r2 = rows[i];
      var ms = memberState.get(r2.memberId);
      flag1st[i] = r2.rank === 1 && r2.status === '11' &&
        orderHasTarget.get(r2.orderNo) === true && inPeriod[i] === 1 ? 1 : 0;
      flag2nd[i] = r2.rank === 2 && r2.status === '11' && ms.top2nd ? 1 : 0;
    }

    return {
      summary: kpi1Summary(rows, inPeriod, firstSeenPeriod, firstSeenNew, firstSeenExisting),
      monthly: kpi1Monthly(rows, inPeriod, firstSeenMonth, start, end),
      cohorts: kpi2Summary(memberState),
      top1st: topProducts(rows, flag1st, params.products),
      top2nd: topProducts(rows, flag2nd, params.products)
    };
  }

  /* KPI1_SUMMARY!A2:H2 */
  function kpi1Summary(rows, inPeriod, seenPeriod, seenNew, seenExisting) {
    var s = {
      revenue: 0, units: 0, lines: 0,
      customers: 0, newCustomers: 0, existingCustomers: 0
    };
    for (var i = 0; i < rows.length; i++) {
      if (inPeriod[i]) {
        s.revenue += rows[i].sgnAmount;
        s.units += rows[i].sgnQty;
        s.lines += rows[i].sgnLines;
      }
      s.customers += seenPeriod[i];
      s.newCustomers += seenNew[i];
      s.existingCustomers += seenExisting[i];
    }
    s.avgOrderValue = s.lines ? s.revenue / s.lines : 0;
    s.avgQty = s.lines ? s.units / s.lines : 0;
    return s;
  }

  /*
   * KPI1_MONTHLY!A2:J37 — up to 36 month rows: =IF(EDATE(CONFIG!$B$4,n)>CONFIG!$B$5,"",...).
   *
   * CONFIG!$B$4 and $B$5 are not the raw dates. They are 開始月度の基準日 / 終了月度の基準日 —
   * the FISCAL month of each bound, normalised to the first of the month:
   *   =DATE(YEAR(IF(DAY(B2)>=21,EDATE(B2,1),B2)), MONTH(...), 1)
   * So the rows run over the fiscal months the period actually spans, which is what makes
   * them line up with the fiscal month the figures are bucketed by. Seeding from the raw
   * calendar month instead would shift the whole block by one whenever the period starts on
   * the 21st or later — an empty leading row, and the newest month dropped off the end.
   */
  function kpi1Monthly(rows, inPeriod, seenMonth, start, end) {
    var from = fiscalYM(start);
    var to = fiscalYM(end);
    var first = monthIndex(from.y, from.m);
    var last = monthIndex(to.y, to.m);
    var buckets = new Map();
    var order = [];

    for (var n = 0; n < 36; n++) {
      var idx = first + n;
      if (idx > last) break;
      var label = monthLabel(Math.floor(idx / 12), (idx % 12) + 1);
      buckets.set(label, {
        label: label, revenue: 0, units: 0, lines: 0,
        customers: 0, newCustomers: 0, existingCustomers: 0
      });
      order.push(label);
    }

    for (var i = 0; i < rows.length; i++) {
      var bucket = buckets.get(rows[i].fiscal);
      if (!bucket) continue;
      if (inPeriod[i]) {
        bucket.revenue += rows[i].sgnAmount;
        bucket.units += rows[i].sgnQty;
        bucket.lines += rows[i].sgnLines;
      }
      /* 総顧客数 filters on the month alone — 月内初出 already carries the period test. */
      if (seenMonth[i]) {
        bucket.customers += 1;
        if (rows[i].isNew) bucket.newCustomers += 1;
        else bucket.existingCustomers += 1;
      }
    }

    return order.map(function (label) {
      var b = buckets.get(label);
      b.avgOrderValue = b.lines ? b.revenue / b.lines : 0;
      b.avgQty = b.lines ? b.units / b.lines : 0;
      return b;
    });
  }

  /* KPI2_SUMMARY — the 合計 row plus one row per registration-month cohort. */
  function kpi2Summary(memberState) {
    var total = { label: '合計', acquired: 0, repeated: 0, daysSum: 0, daysCount: 0 };
    var byCohort = new Map();

    memberState.forEach(function (m) {
      if (!m.qualifies) return;
      if (!byCohort.has(m.regFiscal)) {
        byCohort.set(m.regFiscal, {
          label: m.regFiscal, acquired: 0, repeated: 0, daysSum: 0, daysCount: 0
        });
      }
      var c = byCohort.get(m.regFiscal);
      c.acquired += 1;
      total.acquired += 1;
      if (m.repeated) {
        c.repeated += 1;
        total.repeated += 1;
        c.daysSum += m.days;
        c.daysCount += 1;
        total.daysSum += m.days;
        total.daysCount += 1;
      }
    });

    function finish(c) {
      return {
        label: c.label,
        acquired: c.acquired,
        repeated: c.repeated,
        repeatRate: c.acquired ? c.repeated / c.acquired : 0,
        avgDays: c.daysCount ? c.daysSum / c.daysCount : 0
      };
    }

    var rows = Array.from(byCohort.values())
      .sort(function (a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0; })
      .map(finish);

    return { total: finish(total), rows: rows };
  }

  /*
   * PRODUCTS!C-H → TOP10_1ST / TOP10_2ND.
   * Ranked by line count, ties broken by the product master's own order — the workbook
   * does this with a (1000-ROW())/100000 nudge on the sort key.
   */
  function topProducts(rows, flags, products) {
    var byCode = new Map();
    products.forEach(function (p, idx) {
      byCode.set(p.code, { code: p.code, name: p.name, lines: 0, revenue: 0, idx: idx });
    });

    for (var i = 0; i < rows.length; i++) {
      if (!flags[i]) continue;
      var entry = byCode.get(rows[i].code);
      if (!entry) {
        entry = { code: rows[i].code, name: rows[i].name, lines: 0, revenue: 0, idx: 9999 };
        byCode.set(rows[i].code, entry);
      }
      entry.lines += 1;
      entry.revenue += rows[i].amount;
    }

    return Array.from(byCode.values())
      .filter(function (e) { return e.lines >= 1; })
      .sort(function (a, b) { return b.lines - a.lines || a.idx - b.idx; })
      .slice(0, 10);
  }

  /*
   * productScan — the catalogue ranked two ways at once.
   *
   * The point the tool exists to make is that a product's own revenue line cannot tell you
   * whether it acquires customers. So for every product this reports what it sold in the
   * period alongside how many customers it brought in, and ranks it on both.
   *
   * Acquisition here is period-scoped: a customer counts for product P when their FIRST
   * order fell inside the window and contained P — the workbook's own MEMBERS!K test. That
   * keeps both measures on the same window, which the ② headline figure deliberately does
   * not do (it is an all-time cohort). Over a window that covers the whole dataset the two
   * agree exactly, which is what the test asserts.
   *
   * Because a first order usually holds several products, the per-product counts sum to
   * more than the number of customers acquired. Each product gets credit for the basket it
   * arrived in — that is the whole idea of the co-purchase view, not double counting.
   */
  function productScan(base, params) {
    var rows = base.rows;
    var start = params.start;
    var end = params.end;
    var stat = new Map();
    var i;

    (params.products || []).forEach(function (p, idx) {
      stat.set(p.code, {
        code: p.code, name: p.name, idx: idx,
        revenue: 0, lines: 0, acquired: 0, repeated: 0, daysSum: 0, daysCount: 0
      });
    });

    function entry(code, name) {
      if (!stat.has(code)) {
        stat.set(code, {
          code: code, name: name, idx: 9999,
          revenue: 0, lines: 0, acquired: 0, repeated: 0, daysSum: 0, daysCount: 0
        });
      }
      return stat.get(code);
    }

    /* what each product sold inside the window */
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.saleDate < start || r.saleDate > end) continue;
      var e = entry(r.code, r.name);
      e.revenue += r.sgnAmount;
      e.lines += r.sgnLines;
    }

    /*
     * One pass over first orders, rather than re-running the whole cohort per product:
     * every distinct product in a qualifying first order is credited that customer.
     */
    base.members.forEach(function (m) {
      if (!m.first) return;
      if (m.first.date < start || m.first.date > end) return;
      var repeated = m.second !== null;
      var days = repeated ? dayNumber(m.second.date) - dayNumber(m.first.date) : 0;
      var seen = new Set();
      var idxs = base.byOrder.get(m.first.orderNo) || [];
      for (var k = 0; k < idxs.length; k++) {
        var row = rows[idxs[k]];
        if (seen.has(row.code)) continue;
        seen.add(row.code);
        var s = entry(row.code, row.name);
        s.acquired += 1;
        if (repeated) {
          s.repeated += 1;
          s.daysSum += days;
          s.daysCount += 1;
        }
      }
    });

    var list = Array.from(stat.values()).map(function (e) {
      return {
        code: e.code,
        name: e.name,
        idx: e.idx,
        revenue: e.revenue,
        lines: e.lines,
        acquired: e.acquired,
        repeated: e.repeated,
        repeatRate: e.acquired ? e.repeated / e.acquired : 0,
        avgDays: e.daysCount ? e.daysSum / e.daysCount : 0
      };
    });

    /* Rank 1 is best on each measure; the product master's order breaks ties. */
    rank(list, 'revenue', 'revenueRank');
    rank(list, 'acquired', 'acquiredRank');
    list.forEach(function (e) {
      /* positive = acquires better than it sells, which is the case worth looking at */
      e.gap = e.revenueRank - e.acquiredRank;
    });

    return list.sort(function (a, b) { return a.revenueRank - b.revenueRank; });
  }

  function rank(list, key, into) {
    list.slice().sort(function (a, b) {
      return b[key] - a[key] || a.idx - b.idx;
    }).forEach(function (e, i) { e[into] = i + 1; });
  }

  global.KPI = {
    buildBase: buildBase,
    compute: compute,
    productScan: productScan,
    fiscalLabel: fiscalLabel,
    fiscalYM: fiscalYM,
    monthLabel: monthLabel,
    edate: edate,
    ymd: ymd
  };
})(typeof window !== 'undefined' ? window : globalThis);
