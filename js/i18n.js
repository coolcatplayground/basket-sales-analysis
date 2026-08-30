/*
 * i18n.js — the two language tables and the switch.
 *
 * Static copy is marked up with data-i18n / data-i18n-html in index.html and filled in by
 * apply(); anything rendered from data asks for a string through t().
 *
 * One deliberate exception: the seven column headers of the 月別推移 block are NOT
 * translated. That header row is the input contract of the seasonal analyzer — the strings
 * have to match exactly — so it stays Japanese whichever language the page is in, and the
 * English note glosses each column instead.
 */
(function (global) {
  'use strict';

  var STRINGS = {
    ja: {
      docTitle: 'EC 売上集計 ＆ カゴ分析 — ライブデモ',
      htmlLang: 'ja',
      langLabel: '表示言語',

      h1: 'EC 売上集計 ＆ カゴ（バスケット）分析',
      lede: '売上 KPI と初回購入のカゴ分析。本番版は SQL Server 上で Power Query・Power Pivot・' +
            'VBA を介して動きますが、このページは同じ計算をブラウザ内でデモ用データに対して' +
            '実行します。Excel を開かずに、条件を変えて数字が動くのを確かめられます。',

      ctrlStart: '開始日',
      ctrlEnd: '終了日',
      ctrlProduct: '商品コード',
      ctrlReset: '既定値に戻す',
      ctrlNote: '商品コードは <strong>②カゴ分析</strong> の対象を決めます。' +
                '①売上集計は期間のみのフィルタで、全商品が対象です — ワークブックと同じ挙動です。',
      productAll: 'All — 全商品',

      k1Head: '売上集計',
      k1HeadEm: 'Sales roll-up',
      k1Desc: '期間フィルタ適用。返品（ステータス 14）は減算されます。',

      tRevenue: '売上金額',
      tUnits: '購入個数',
      tLines: '購入件数',
      tCustomers: '総顧客数',
      tNew: '新規顧客数',
      tExisting: '既存顧客数',
      tAov: '平均注文金額',
      tAvgQty: '平均購入数量',
      uItems: '点',
      uLines: '明細',
      uPeople: '人',
      uDays: '日',

      ch1Title: '月次売上金額',
      ch1Sub: '会計月度ベース（21日締め）。',
      ch2Title: '新規顧客数 / 既存顧客数',
      ch2Sub: 'その月度に「新規」だった顧客と、それ以外の顧客。',
      legNew: '新規顧客',
      legExisting: '既存顧客',
      tipRevenue: '売上金額',
      tipLines: '購入件数',
      tipCustomers: '総顧客数',
      tipNew: '新規',
      tipExisting: '既存',
      tipTotal: '合計',
      chartEmpty: '該当する月度がありません。',

      expHead: '月別推移',
      expHeadEm: 'EXPORT block',
      btnCopy: 'クリップボードにコピー',
      btnCopied: 'コピーしました',
      btnDownload: 'CSV ダウンロード',
      btnXlsx: '季節性アナライザー用 .xlsx',
      allProductsSheet: '全商品',
      expNote: 'この 7 列がそのまま季節性アナライザーの入力形式になります。' +
               'ヘッダー行が両ツールの契約です。アナライザーはシート名を商品名として読むため、' +
               '.xlsx は商品名をシート名にして書き出します（ライブラリなしで生成しています）。',

      parityNote: '<strong>ワークブック準拠の挙動:</strong> ' +
        '月度行は開始日の暦月から採番される一方、数値は月度（21日締め）で集計されます。' +
        '開始日が21日以降のときは 1 か月ずれるため、先頭行が空になり、末尾の月度が 1 つ落ちます。' +
        '開始日を20日以前にすると解消します。',

      k3Head: '商品別 獲得力',
      k3HeadEm: 'Which products acquire customers',
      k3Desc: '期間内の売上と、期間内に獲得した初回購入顧客数を、同じ期間で並べています。',
      k3Lead: '商品の売上ラインだけでは、その商品が<strong>顧客を連れてきているか</strong>は分かりません。' +
              '安い商品が売上ランキングでは目立たないまま、関係の入口になっていることがあります。' +
              '対角線から離れているほど、売る力と獲得する力がずれている商品です。',
      k3ChartTitle: '売上順位 × 獲得順位',
      k3ChartSub: '対角線より上＝売上の順位より、獲得の順位のほうが高い商品。',
      k3Diagonal: '売上＝獲得',
      k3XLabel: '売上順位（1 が最上位）',
      k3YLabel: '獲得順位（1 が最上位）',
      k3LegendHi: '獲得が売上を上回る商品',
      k3LegendRest: 'その他の商品',
      k3Callout: '<strong>{list}</strong> は、売上順位より獲得順位のほうが上です。' +
                 '売上ランキングだけを見ていれば見落とす商品で、この分析が存在する理由でもあります。',
      k3CalloutNone: 'この期間では、売上順位と獲得順位が大きく食い違う商品はありません。',
      k3Note: '獲得顧客数は「初回購入がこの期間内で、その伝票にこの商品が入っていた顧客」の数です。' +
              '初回購入の伝票には通常いくつかの商品が入るため、商品ごとの合計は総獲得数を上回ります。' +
              '②の初回購入顧客数は全期間コホートなので、こちらより大きくなります。',
      thRevRank: '売上順位',
      thAcqRank: '獲得順位',
      thGap: '順位差',
      thAcquired: '獲得顧客数',
      k2Head: 'カゴ分析：初回購入 → 2回目購入',
      k2HeadEm: 'First-purchase basket',
      k2ScopeAll: '全商品・全期間コホート。初回購入の伝票をまるごと数えています。',
      k2ScopeProduct: '{code} を含む初回購入の伝票を対象にした、全期間コホート。',

      tAcquired: '初回購入顧客数',
      tRepeated: 'リピート数',
      tRepeatRate: 'リピート率',
      tAvgDays: '平均リピート日数',

      top1Note: '対象商品を含む<strong>初回購入</strong>の伝票に、他に何が入っていたか。' +
                '伝票の全明細を保持するため、これは本物の併売リストです。',
      top2Note: 'その顧客たちが<strong>2回目</strong>に何を買ったか。' +
                '同じ商品に戻ったのか、隣の棚に移ったのか。',
      thCode: '商品コード',
      thName: '商品名称',
      thLines: '購入件数',
      thRevenue: '売上金額',
      noRows: '該当なし',

      cohortSummary: '登録月度コホート別の内訳',
      cohortCount: '（{n} コホート）',
      cohortNote: '獲得実績は、その顧客が実際に入会した月に対して読むものです。' +
                  '10 年分の履歴に均してしまうと意味が消えます。',
      thCohort: '登録月度',

      notesHead: '読み方の注意',
      notesHeadEm: 'How to read this',
      note1dt: '月度は暦月ではない',
      note1dd: '会計月は20日締めなので、21日の売上は<em>翌月</em>に入ります' +
               '(<code>月度 = if DAY(売上日) &gt;= 21 then month+1 else month</code>)。' +
               '登録日にも同じ規則を当てて、両者を突き合わせて新規／既存を決めます。',
      note2dt: '新規 + 既存 ≠ 総顧客数（長い期間では）',
      note2dd: '同じ人が、ある月には「新規」で別の月には「既存」になり得ます。' +
               '月度ごとに判定しているからです。これは不具合ではありませんが、' +
               '出力を初めて見る人が最初に引っかかる点なので明記しておきます。',
      note3dt: '売上は返品差引後',
      note3dd: 'ステータス 11 が完了、14 が返品。除外ではなく符号を付けて合算するので、' +
               '返品は消えずに引かれます。',
      note4dt: '「初回購入のカゴ」は伝票まるごと',
      note4dd: 'フィルタに一致した明細だけでなく、その伝票の全明細を残します。' +
               'だから併売表がフィルタの言い換えではなく、情報になります。',
      fineprint: '本番版は SQL Server 上の約10年・300万行超に対して動き、KPI1 は数秒、' +
                 'KPI2 は2〜20分かかります。このデモは 6,824 行の合成データで、' +
                 'ブラウザ内で即時に再計算します。実データ・実商品コードは一切含まれません。',
      footer: '合成データによるデモ。計算ロジックは <code>EC_Sales_Basket_Analysis_Demo.xlsx</code> の' +
              '各シートを移植したもので、出力は独立実装と突き合わせて検証しています。',

      errDates: '開始日が終了日より後になっています。日付を入れ替えてください。',
      errLoad: 'データを読み込めませんでした ({msg})。<br>' +
               'ローカルで開いている場合は <code>file://</code> では fetch がブロックされます。' +
               'リポジトリのルートで <code>python3 -m http.server 8000</code> を実行し、' +
               '<code>http://localhost:8000</code> を開いてください。',
      errScript: 'スクリプトエラー: {msg}'
    },

    en: {
      docTitle: 'EC Sales KPIs & Basket Analysis — live demo',
      htmlLang: 'en',
      langLabel: 'Language',

      h1: 'EC Sales KPIs & First-Purchase Basket Analysis',
      lede: 'Sales KPIs and first-purchase basket analysis. The real tool runs on SQL Server ' +
            'through Power Query, Power Pivot and VBA; this page runs the same calculations in ' +
            'the browser over the demo dataset, so you can change the parameters and watch the ' +
            'numbers move without opening Excel.',

      ctrlStart: 'Start date',
      ctrlEnd: 'End date',
      ctrlProduct: 'Product code',
      ctrlReset: 'Reset',
      ctrlNote: 'The product code selects the basket for <strong>② the basket analysis</strong>. ' +
                '① the sales roll-up is filtered by period only and covers the whole catalogue — ' +
                'the same behaviour as the workbook.',
      productAll: 'All — every product',

      k1Head: 'Sales roll-up',
      k1HeadEm: '売上集計',
      k1Desc: 'Filtered by period. Returns (status 14) subtract rather than disappear.',

      tRevenue: 'Net revenue',
      tUnits: 'Units',
      tLines: 'Order lines',
      tCustomers: 'Customers',
      tNew: 'New customers',
      tExisting: 'Returning customers',
      tAov: 'Avg order value',
      tAvgQty: 'Avg quantity',
      uItems: 'items',
      uLines: 'lines',
      uPeople: '',
      uDays: 'days',

      ch1Title: 'Net revenue by month',
      ch1Sub: 'On the accounting month, which closes on the 20th.',
      ch2Title: 'New vs returning customers',
      ch2Sub: 'Customers who were new in that accounting month, against everyone else.',
      legNew: 'New',
      legExisting: 'Returning',
      tipRevenue: 'Revenue',
      tipLines: 'Order lines',
      tipCustomers: 'Customers',
      tipNew: 'New',
      tipExisting: 'Returning',
      tipTotal: 'Total',
      chartEmpty: 'No months fall in this period.',

      expHead: 'Monthly trend',
      expHeadEm: 'EXPORT block',
      btnCopy: 'Copy to clipboard',
      btnCopied: 'Copied',
      btnDownload: 'Download CSV',
      btnXlsx: '.xlsx for the analyzer',
      allProductsSheet: '全商品',
      expNote: 'These seven columns are the input format of the seasonal analyzer, and the header ' +
               'row is the contract between the two tools — so it stays in Japanese in every ' +
               'language. The columns are: 月別推移 (month) · 売上金額 (revenue) · 購入個数 (units) · ' +
               '購入件数 (order lines) · 総顧客数 (customers) · 新規顧客数 (new) · ' +
               '既存顧客数 (returning). The analyzer reads the product name off the SHEET ' +
               'name, so the .xlsx is written with the product as its sheet name — by hand, ' +
               'with no library.',

      parityNote: '<strong>Workbook parity:</strong> the month rows are seeded from the calendar ' +
        'month of the start date, while the figures are bucketed by accounting month (the 21st ' +
        'onward belongs to the next month). When the period starts on the 21st or later the two ' +
        'are one month out of step, so the block opens with an empty row and stops one month ' +
        'early. Starting on or before the 20th avoids it.',

      k3Head: 'Which products acquire customers',
      k3HeadEm: '商品別 獲得力',
      k3Desc: 'Revenue in the period against customers acquired in the same period, ' +
              'on the same window.',
      k3Lead: 'The sales line of a product cannot tell you whether it is ' +
              '<strong>bringing customers in</strong>. A cheap item can look unremarkable on ' +
              'the revenue ranking and still be the thing that opens the relationship. The ' +
              'further a product sits from the diagonal, the more its selling and its ' +
              'acquiring disagree.',
      k3ChartTitle: 'Revenue rank against acquisition rank',
      k3ChartSub: 'Above the diagonal: the product ranks higher on acquisition than on revenue.',
      k3Diagonal: 'sells = acquires',
      k3XLabel: 'Revenue rank (1 is best)',
      k3YLabel: 'Acquisition rank (1 is best)',
      k3LegendHi: 'Acquires better than it sells',
      k3LegendRest: 'Everything else',
      k3Callout: '<strong>{list}</strong> rank higher on acquisition than on revenue. These ' +
                 'are the products a revenue ranking alone would hide — and the reason this ' +
                 'analysis exists.',
      k3CalloutNone: 'In this period no product ranks far apart on the two measures.',
      k3Note: 'Customers acquired counts customers whose FIRST order fell in this period and ' +
              'contained the product. A first order usually holds several products, so the ' +
              'per-product figures sum to more than the number of customers acquired. The ' +
              'headline figure in ② is larger still, because it is an all-time cohort.',
      thRevRank: 'Revenue #',
      thAcqRank: 'Acquisition #',
      thGap: 'Rank gap',
      thAcquired: 'Customers acquired',
      k2Head: 'Basket analysis: first order → second order',
      k2HeadEm: 'カゴ分析',
      k2ScopeAll: 'Whole catalogue, all-time cohort. Every line of the qualifying first order ' +
                  'is counted.',
      k2ScopeProduct: 'All-time cohort of first orders containing {code}.',

      tAcquired: 'Customers acquired',
      tRepeated: 'Came back',
      tRepeatRate: 'Repeat rate',
      tAvgDays: 'Avg days to return',

      top1Note: 'What else was in the <strong>first order</strong> that contained the product. ' +
                'Every line of the order is kept, which is what makes this a real co-purchase list ' +
                'rather than a restatement of the filter.',
      top2Note: 'What those same customers bought on their <strong>second</strong> order — the ' +
                'same product again, or something adjacent.',
      thCode: 'Code',
      thName: 'Product',
      thLines: 'Order lines',
      thRevenue: 'Revenue',
      noRows: 'Nothing matches',

      cohortSummary: 'Breakdown by registration-month cohort',
      cohortCount: '({n} cohorts)',
      cohortNote: 'Acquisition should be read against the month those customers actually joined. ' +
                  'Smeared across ten years of history it stops meaning anything.',
      thCohort: 'Registration month',

      notesHead: 'How to read this',
      notesHeadEm: '読み方の注意',
      note1dt: 'The month is not the calendar month',
      note1dd: 'The accounting month closes on the 20th, so a sale on the 21st belongs to the ' +
               '<em>next</em> month ' +
               '(<code>月度 = if DAY(売上日) &gt;= 21 then month+1 else month</code>). ' +
               'The same rule is applied to the registration date, and the two are compared to ' +
               'decide whether a customer is new or returning.',
      note2dt: 'New + returning ≠ total customers over a long period',
      note2dd: 'The same person can be new in one month and returning in another, because the ' +
               'test is made per month. That is correct rather than a bug — but it needs saying ' +
               'out loud, because it is the first thing that looks wrong.',
      note3dt: 'Revenue is net of returns',
      note3dd: 'Status 11 is a completed order, 14 is a return. Every measure is signed rather ' +
               'than filtered, so returns subtract instead of disappearing.',
      note4dt: 'The first-purchase basket is the whole order',
      note4dd: 'Not just the line that matched the filter — every line of that order is kept. ' +
               'That is why the co-purchase tables carry information instead of restating the ' +
               'filter.',
      fineprint: 'The production tool runs against roughly ten years and 3 million+ rows on SQL ' +
                 'Server: KPI1 returns in seconds, KPI2 takes 2–20 minutes. This demo runs on ' +
                 '6,824 synthetic rows and recalculates instantly in the browser. No real figures ' +
                 'or product codes appear anywhere in it.',
      footer: 'A demo on synthetic data. The calculations are ported from the sheets of ' +
              '<code>EC_Sales_Basket_Analysis_Demo.xlsx</code>, and the output is checked against ' +
              'an independent implementation of the same specification.',

      errDates: 'The start date is after the end date. Swap them round.',
      errLoad: 'Could not load the data ({msg}).<br>' +
               'Opened from disk, <code>file://</code> blocks fetch. Run ' +
               '<code>python3 -m http.server 8000</code> in the repository root and open ' +
               '<code>http://localhost:8000</code>.',
      errScript: 'Script error: {msg}'
    }
  };

  var STORE_KEY = 'basket-demo-lang';
  var current = 'ja';
  var listeners = [];

  function t(key, vars) {
    var s = STRINGS[current][key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace('{' + k + '}', vars[k]);
      });
    }
    return s;
  }

  /* Browser preference decides the first view; an explicit choice outranks it. */
  function initial() {
    var stored = null;
    try { stored = localStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    if (stored === 'ja' || stored === 'en') return stored;
    var nav = (navigator.language || 'en').toLowerCase();
    return nav.indexOf('ja') === 0 ? 'ja' : 'en';
  }

  function apply() {
    document.documentElement.lang = t('htmlLang');
    document.title = t('docTitle');

    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    [].forEach.call(document.querySelectorAll('[data-i18n-html]'), function (node) {
      node.innerHTML = t(node.getAttribute('data-i18n-html'));
    });
    [].forEach.call(document.querySelectorAll('[data-i18n-label]'), function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-label')));
    });

    [].forEach.call(document.querySelectorAll('.lang-switch button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === current));
    });
  }

  function set(lang) {
    if (lang !== 'ja' && lang !== 'en') return;
    current = lang;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode */ }
    apply();
    listeners.forEach(function (fn) { fn(lang); });
  }

  function onChange(fn) { listeners.push(fn); }

  function mount() {
    current = initial();
    [].forEach.call(document.querySelectorAll('.lang-switch button'), function (btn) {
      btn.addEventListener('click', function () { set(btn.getAttribute('data-lang')); });
    });
    apply();
  }

  global.I18N = {
    t: t,
    set: set,
    mount: mount,
    onChange: onChange,
    lang: function () { return current; }
  };
})(window);
