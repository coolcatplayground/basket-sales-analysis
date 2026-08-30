/*
 * charts.js — two small SVG bar charts, hand-rolled so the page stays dependency-free.
 *
 * Both charts share an x scale (the month buckets) and are drawn as small multiples
 * stacked down the page rather than combined onto two y axes.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT_H = 190;
  var AXIS_BAND = 30;
  var PAD_L = 58;
  var PAD_R = 10;
  var PAD_T = 12;
  var SEG_GAP = 2;   /* surface gap between stacked segments */
  var END_R = 4;     /* rounded data-end radius */

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) {
        node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  /* A bar with rounded corners at the data end only, anchored to the baseline. */
  function barPath(x, y, w, h, r) {
    if (h <= 0) return '';
    var rr = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) +
      'L' + x + ',' + (y + rr) +
      'Q' + x + ',' + y + ' ' + (x + rr) + ',' + y +
      'L' + (x + w - rr) + ',' + y +
      'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + rr) +
      'L' + (x + w) + ',' + (y + h) + 'Z';
  }

  /* "Nice" axis maximum, so ticks land on round numbers. */
  function niceMax(v) {
    if (v <= 0) return 1;
    var exp = Math.floor(Math.log(v) / Math.LN10);
    var mag = Math.pow(10, exp);
    var f = v / mag;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * mag;
  }

  /* Trim trailing zeros so round axis steps read 1.5M rather than 1.50M. */
  function trim(n, places) {
    return String(parseFloat(n.toFixed(places)));
  }

  /*
   * Money on the y axis, in the units the reader expects: 万 / 億 in Japanese,
   * K / M / B in English. Both drop the currency mark, which the title carries.
   */
  function yenTick(v) {
    if (v === 0) return '0';
    var ja = !window.I18N || I18N.lang() === 'ja';
    if (ja) {
      if (v >= 100000000) return trim(v / 100000000, 2) + '億';
      if (v >= 10000) return Math.round(v / 10000) + '万';
      return String(v);
    }
    if (v >= 1000000000) return trim(v / 1000000000, 2) + 'B';
    if (v >= 1000000) return trim(v / 1000000, 2) + 'M';
    if (v >= 1000) return trim(v / 1000, 1) + 'K';
    return String(v);
  }

  function tooltip(host) {
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('role', 'status');
    host.appendChild(tip);
    return {
      show: function (html, x, width) {
        tip.innerHTML = html;
        tip.classList.add('is-on');
        var tw = tip.offsetWidth;
        var left = Math.max(4, Math.min(x - tw / 2, width - tw - 4));
        tip.style.left = left + 'px';
        tip.style.top = '4px';
      },
      hide: function () { tip.classList.remove('is-on'); }
    };
  }

  /*
   * Shared frame: grid, y ticks, x labels, hover bands. `series` is a list of
   * { label, color, value(row) } and stacking is decided by the caller.
   */
  function render(host, rows, opts) {
    host.textContent = '';
    if (!rows.length) {
      var empty = document.createElement('p');
      empty.className = 'is-loading';
      empty.textContent = window.I18N ? I18N.t('chartEmpty') : '';
      host.appendChild(empty);
      return;
    }

    var width = Math.max(host.clientWidth || 640, 320);
    var height = PAD_T + PLOT_H + AXIS_BAND;
    var plotW = width - PAD_L - PAD_R;
    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      width: width, height: height,
      role: 'img', 'aria-label': opts.ariaLabel
    });

    var max = niceMax(opts.max);
    var yOf = function (v) { return PAD_T + PLOT_H - (v / max) * PLOT_H; };

    /* grid + y ticks — solid hairlines, one shade off the surface */
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var v = (max / ticks) * t;
      var y = yOf(v);
      svg.appendChild(el('line', {
        x1: PAD_L, x2: width - PAD_R, y1: y, y2: y,
        stroke: t === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1
      }));
      var lab = el('text', {
        x: PAD_L - 8, y: y + 4, 'text-anchor': 'end',
        fill: 'var(--text-muted)', 'font-size': 11
      });
      lab.textContent = opts.tickFormat(v);
      svg.appendChild(lab);
    }

    var slot = plotW / rows.length;
    var barW = Math.max(3, Math.min(slot * 0.62, 34));
    var labelStep = Math.ceil(rows.length / Math.floor(plotW / 46)) || 1;

    var tip = tooltip(host);
    var bands = [];

    rows.forEach(function (row, i) {
      var cx = PAD_L + slot * i + slot / 2;
      var x = cx - barW / 2;

      var band = el('rect', {
        x: PAD_L + slot * i, y: PAD_T, width: slot, height: PLOT_H,
        fill: 'transparent', class: 'bar-band'
      });
      svg.appendChild(band);
      bands.push(band);

      /* stack the series from the baseline up */
      var acc = 0;
      opts.series.forEach(function (s) {
        var val = s.value(row);
        if (val <= 0) { acc += Math.max(val, 0); return; }
        var yTop = yOf(acc + val);
        var yBot = yOf(acc);
        var h = yBot - yTop - (acc > 0 ? SEG_GAP : 0);
        if (h > 0.5) {
          svg.appendChild(el('path', {
            d: barPath(x, yTop, barW, h, END_R), fill: s.color
          }));
        }
        acc += val;
      });

      if (i % labelStep === 0) {
        var xl = el('text', {
          x: cx, y: PAD_T + PLOT_H + 18, 'text-anchor': 'middle',
          fill: 'var(--text-muted)', 'font-size': 11
        });
        xl.textContent = row.label;
        svg.appendChild(xl);
      }
    });

    /* selective direct label: the single biggest bar, not every point */
    if (opts.labelPeak) {
      var peak = rows.reduce(function (a, b) {
        return opts.total(b) > opts.total(a) ? b : a;
      });
      var pi = rows.indexOf(peak);
      if (opts.total(peak) > 0) {
        var px = PAD_L + slot * pi + slot / 2;
        var py = yOf(opts.total(peak)) - 7;
        var pl = el('text', {
          x: px, y: py, 'text-anchor': 'middle',
          fill: 'var(--text-secondary)', 'font-size': 11, 'font-weight': 600
        });
        pl.textContent = opts.peakFormat(opts.total(peak));
        svg.appendChild(pl);
      }
    }

    /* hover layer last, so it sits above the marks */
    rows.forEach(function (row, i) {
      var hit = el('rect', {
        x: PAD_L + slot * i, y: PAD_T, width: slot, height: PLOT_H,
        fill: 'transparent', class: 'bar-hit'
      });
      hit.addEventListener('mouseenter', function () {
        bands.forEach(function (b) { b.classList.remove('is-active'); });
        bands[i].classList.add('is-active');
        tip.show(opts.tipHtml(row), PAD_L + slot * i + slot / 2, width);
      });
      hit.addEventListener('mouseleave', function () {
        bands[i].classList.remove('is-active');
        tip.hide();
      });
      svg.appendChild(hit);
    });

    host.appendChild(svg);
  }

  function legend(host, series) {
    var ul = document.createElement('ul');
    ul.className = 'chart-legend';
    series.forEach(function (s) {
      var li = document.createElement('li');
      var sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = s.color;
      li.appendChild(sw);
      li.appendChild(document.createTextNode(s.label));
      ul.appendChild(li);
    });
    host.parentNode.insertBefore(ul, host);
  }

  /*
   * scatter — revenue rank against acquisition rank, one dot per product.
   *
   * Plotting the ranks rather than the raw measures is deliberate. Revenue spans three
   * orders of magnitude across the catalogue, so on a linear axis the whole tail collapses
   * into the left edge and the comparison is unreadable. Ranks spread evenly by
   * construction, and the question here is ordinal anyway: does this product acquire
   * better than it sells? That is its distance from the diagonal.
   *
   * Emphasis, not colour-by-rank: the products that clear the callout threshold take the
   * series colour and a direct label, the rest stay muted. Identity comes from the label
   * and the tooltip, never from hue alone.
   */
  function scatter(host, points, opts) {
    host.textContent = '';
    if (!points.length) return;

    var width = Math.max(host.clientWidth || 640, 320);
    var plotH = Math.min(Math.max(width * 0.52, 260), 420);
    var height = PAD_T + plotH + AXIS_BAND + 14;
    var padL = 46;
    var plotW = width - padL - PAD_R;
    var n = opts.max;

    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      width: width, height: height,
      role: 'img', 'aria-label': opts.ariaLabel
    });

    var xOf = function (v) { return padL + ((v - 1) / (n - 1)) * plotW; };
    var yOf = function (v) { return PAD_T + ((v - 1) / (n - 1)) * plotH; };

    var ticks = [1];
    for (var t = 10; t < n; t += 10) ticks.push(t);
    ticks.push(n);

    ticks.forEach(function (v) {
      svg.appendChild(el('line', {
        x1: padL, x2: width - PAD_R, y1: yOf(v), y2: yOf(v),
        stroke: 'var(--grid)', 'stroke-width': 1
      }));
      svg.appendChild(el('line', {
        x1: xOf(v), x2: xOf(v), y1: PAD_T, y2: PAD_T + plotH,
        stroke: 'var(--grid)', 'stroke-width': 1
      }));
      var yl = el('text', {
        x: padL - 8, y: yOf(v) + 4, 'text-anchor': 'end',
        fill: 'var(--text-muted)', 'font-size': 11
      });
      yl.textContent = v;
      svg.appendChild(yl);
      var xl = el('text', {
        x: xOf(v), y: PAD_T + plotH + 18, 'text-anchor': 'middle',
        fill: 'var(--text-muted)', 'font-size': 11
      });
      xl.textContent = v;
      svg.appendChild(xl);
    });

    /* the diagonal: sells and acquires equally well */
    svg.appendChild(el('line', {
      x1: xOf(1), y1: yOf(1), x2: xOf(n), y2: yOf(n),
      stroke: 'var(--axis)', 'stroke-width': 1
    }));
    var dia = el('text', {
      x: xOf(n) - 6, y: yOf(n) - 8, 'text-anchor': 'end',
      fill: 'var(--text-muted)', 'font-size': 11
    });
    dia.textContent = opts.diagonalLabel;
    svg.appendChild(dia);

    var axX = el('text', {
      x: padL + plotW / 2, y: height - 2, 'text-anchor': 'middle',
      fill: 'var(--text-secondary)', 'font-size': 11
    });
    axX.textContent = opts.xLabel;
    svg.appendChild(axX);

    var axY = el('text', {
      x: 12, y: PAD_T + plotH / 2, 'text-anchor': 'middle',
      fill: 'var(--text-secondary)', 'font-size': 11,
      transform: 'rotate(-90 12 ' + (PAD_T + plotH / 2) + ')'
    });
    axY.textContent = opts.yLabel;
    svg.appendChild(axY);

    var tip = tooltip(host);

    points.forEach(function (p) {
      var cx = xOf(p.x);
      var cy = yOf(p.y);
      /* a 2px surface ring keeps overlapping dots readable without a border */
      svg.appendChild(el('circle', {
        cx: cx, cy: cy, r: p.highlight ? 7 : 6,
        fill: 'var(--surface-1)'
      }));
      svg.appendChild(el('circle', {
        cx: cx, cy: cy, r: p.highlight ? 5 : 4,
        fill: p.highlight ? 'var(--series-1)' : 'var(--text-muted)',
        opacity: p.highlight ? 1 : 0.55
      }));
      if (p.highlight) {
        var lab = el('text', {
          x: cx + 9, y: cy + 4, fill: 'var(--text-secondary)',
          'font-size': 11, 'font-weight': 600
        });
        lab.textContent = p.code;
        svg.appendChild(lab);
      }
    });

    /* hover targets last and generous, so small dots stay easy to hit */
    points.forEach(function (p) {
      var hit = el('circle', {
        cx: xOf(p.x), cy: yOf(p.y), r: 13, fill: 'transparent', class: 'bar-hit'
      });
      hit.addEventListener('mouseenter', function () {
        tip.show(opts.tipHtml(p), xOf(p.x), width);
      });
      hit.addEventListener('mouseleave', tip.hide);
      svg.appendChild(hit);
    });

    host.appendChild(svg);
  }

  global.Charts = {
    render: render,
    scatter: scatter,
    legend: legend,
    niceMax: niceMax,
    yenTick: yenTick
  };
})(window);
