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
      ctrlNote: '商品コードは複数選べます（本番版の <code>ct101, ct102</code> のような入力と同じ）。' +
                'V3 からは <strong>①売上集計</strong> も選んだ商品に絞り込まれ、' +
                '②カゴ分析・④LTV の対象も同じ商品で決まります。',
      productAll: 'All — 全商品',
      pickAll: '全商品に戻す',
      pickDone: '閉じる',
      pickCount: '{n} 商品を選択中',
      ctrlCohortStart: 'LTV 獲得期間 開始',
      ctrlCohortEnd: 'LTV 獲得期間 終了',
      ctrlCohortNote: '④LTV は、初回購入日がこの期間に入る会員だけを追いかけます。' +
                      '長く追うほど後ろの区分が読めるので、終了日は1年以上前がおすすめです。',
      errCohortDates: 'LTV 獲得期間の開始日が終了日より後になっています。',

      k1Head: '売上集計',
      k1HeadEm: 'Sales roll-up',
      k1Desc: '期間と商品コードで絞り込み。返品（ステータス 14）は減算されます。',

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
      k2ScopeProduct: '{code} のいずれかを含む初回購入の伝票を対象にした、全期間コホート。',

      tAcquired: '初回購入顧客数',
      tRepeated: 'リピート数',
      tRepeatRate: 'リピート率',
      tAvgDays: '平均リピート日数',
      tMedianDays: '中央値リピート日数',
      tMinDays: '最短リピート日数',
      tAvgTracked: '平均追跡日数',

      bandHead: 'リピートまでの時間バンド',
      bandNote: '「90日以内に戻ったか」は、初回購入から90日以上たった会員でしか判定できません。' +
                'そこで各バンドは<strong>そのバンドを見届けられる会員だけ</strong>を分母にしています' +
                '（打ち切り対策）。生涯の行だけは期限がないので全員が対象です。',
      thBand: 'バンド',
      thEligible: '追跡可能会員数',
      bandWithin: '{d}日以内',
      bandLifetime: '生涯（期間無制限）',

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

      k4Head: 'LTV 解析',
      k4HeadEm: 'Lifetime value & allowable CAC',
      k4Scope: '{products}・初回購入日 {from} 〜 {to} の獲得会員を、初回購入からの経過日数で追跡。',
      k4ScopeAll: '全商品',
      tLtvAcquired: '獲得会員数',
      tSinceEnd: '獲得期間終了からの日数',
      tGp90: '90日 累計粗利/人',
      tGp365: '365日 累計粗利/人',
      tCac365: '許容CAC（365日・3対1）',
      matureAll: '獲得期間の終了から {d} 日。<strong>730日</strong>までの LTV が読めます。',
      mature365: '獲得期間の終了から {d} 日。<strong>365日</strong>までの LTV が読めます（730日の行は母数不足で過小評価になります）。',
      mature180: '獲得期間の終了から {d} 日。<strong>180日</strong>までの LTV が読めます（365日以降の行は信用できません）。',
      matureNone: '獲得期間の終了から {d} 日。<strong>獲得期間が新しすぎます</strong> — どの行も追跡期間が足りません。終了日を1年以上前にしてください。',
      k4ChartTitle: 'LTV カーブ（会員1人あたり累計粗利）',
      k4ChartSub: '経過区分ごとの粗利を積み上げ、獲得会員全員の人数で割った値。線ではなく区分の累計です。',
      legCumGp: '累計粗利/人',
      thElapsed: '経過区分',
      thGp: '粗利（区分内）',
      thCumGpPer: '累計粗利/人',
      thCac: '許容CAC（3対1）',
      thBuyers: '購入会員数',
      thMissingCost: '原価欠落件数',
      elapsedUpTo: '{d}日まで',
      elapsedOver: '730日超',
      ltvEmpty: 'この獲得期間に該当する会員がいません。',
      ltvCheckMatch: '②の初回購入顧客数と④の獲得会員数は、どちらも {n} 人で一致しています。',
      ltvCheckDiff: '②の初回購入顧客数は {kpi2} 人（全期間）、④の獲得会員数は {ltv} 人（獲得期間内）です。' +
                    '本番版ではこの差を「CohortStart / CohortEnd の範囲を確認」という警告として出します。',

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
      note5dt: 'バンドの分母は「見届けられる会員」だけ',
      note5dd: '最近入った会員を 365日バンドの分母に入れると、まだ戻る時間がなかっただけの人が' +
               '「戻らなかった」扱いになり、率が不当に下がります。追跡日数は今日までで数えます。',
      note6dt: 'LTV は売上ではなく粗利、許容CAC は 3 対 1',
      note6dd: '粗利 = 売上金額 − 原価 × 購入個数（返品は符号付き）。累計粗利を<strong>獲得会員全員</strong>で割るので、' +
               '二度と戻らなかった会員も分母に入ります。その 1/3 が、LTV:CAC = 3:1 を守れる 1人あたり獲得費用の上限です。' +
               'デモの原価は架空の値です。',
      fineprint: '本番版は SQL Server 上の約10年・300万行超に対して動き、KPI1 は数秒、' +
                 'KPI2 は2〜20分かかります。このデモは 6,824 行の合成データで、' +
                 'ブラウザ内で即時に再計算します。実データ・実商品コードは一切含まれません。',
      footer: '合成データによるデモ。①〜③の基本ロジックは <code>EC_Sales_Basket_Analysis_Demo.xlsx</code>（V2）の' +
              '各シートを移植し、複数商品・時間バンド・LTV は本番 V3 の Power Query から移植しています。' +
              '出力は独立実装と突き合わせて検証しています。',

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
      ctrlNote: 'Pick one product or several — the production tool takes a list like ' +
                '<code>ct101, ct102</code>. Since V3, <strong>① the sales roll-up</strong> is ' +
                'filtered to the chosen products too, and the same choice sets the cohort for ② and ④.',
      productAll: 'All — every product',
      pickAll: 'Back to all',
      pickDone: 'Done',
      pickCount: '{n} products selected',
      ctrlCohortStart: 'LTV cohort from',
      ctrlCohortEnd: 'LTV cohort to',
      ctrlCohortNote: '④ follows only members whose first purchase falls in this window. The ' +
                      'older the window, the further along the curve you can read, so end it at ' +
                      'least a year back.',
      errCohortDates: 'The LTV cohort starts after it ends. Swap the dates round.',

      k1Head: 'Sales roll-up',
      k1HeadEm: '売上集計',
      k1Desc: 'Filtered by period and product. Returns (status 14) subtract rather than disappear.',

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
      k2ScopeProduct: 'All-time cohort of first orders containing any of {code}.',

      tAcquired: 'Customers acquired',
      tRepeated: 'Came back',
      tRepeatRate: 'Repeat rate',
      tAvgDays: 'Avg days to return',
      tMedianDays: 'Median days to return',
      tMinDays: 'Fastest return',
      tAvgTracked: 'Avg days tracked',

      bandHead: 'Repeat rate by time band',
      bandNote: 'Whether someone came back within 90 days can only be judged for members whose ' +
                'first purchase is at least 90 days old. So each band counts <strong>only the ' +
                'members tracked long enough to see it</strong> (a guard against right-censoring). ' +
                'The lifetime row has no horizon, so everyone is in it.',
      thBand: 'Band',
      thEligible: 'Members trackable',
      bandWithin: 'within {d} days',
      bandLifetime: 'lifetime (no limit)',

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

      k4Head: 'Lifetime value & allowable CAC',
      k4HeadEm: 'LTV 解析',
      k4Scope: 'Members acquired through {products}, first purchase {from} – {to}, followed by days since that first purchase.',
      k4ScopeAll: 'any product',
      tLtvAcquired: 'Members acquired',
      tSinceEnd: 'Days since cohort end',
      tGp90: 'Cum. gross profit / member, 90d',
      tGp365: 'Cum. gross profit / member, 365d',
      tCac365: 'Allowable CAC (365d, 3:1)',
      matureAll: '{d} days since the cohort ended. The curve reads out to <strong>730 days</strong>.',
      mature365: '{d} days since the cohort ended. The curve reads out to <strong>365 days</strong> (the 730-day row has too few members old enough, so it understates).',
      mature180: '{d} days since the cohort ended. The curve reads out to <strong>180 days</strong> (do not trust 365 days onward).',
      matureNone: '{d} days since the cohort ended. <strong>This cohort is too recent</strong> — no row has been tracked long enough. End the window at least a year back.',
      k4ChartTitle: 'LTV curve — cumulative gross profit per member',
      k4ChartSub: 'Gross profit summed bucket by bucket and divided by every member acquired. Cumulative by bucket, not a smooth line.',
      legCumGp: 'Cum. gross profit / member',
      thElapsed: 'Days since first purchase',
      thGp: 'Gross profit in bucket',
      thCumGpPer: 'Cum. GP / member',
      thCac: 'Allowable CAC (3:1)',
      thBuyers: 'Members buying',
      thMissingCost: 'Lines missing cost',
      elapsedUpTo: 'up to {d}',
      elapsedOver: 'over 730',
      ltvEmpty: 'No members were acquired in this cohort window.',
      ltvCheckMatch: 'Customers acquired in ② and members acquired in ④ agree: {n} each.',
      ltvCheckDiff: '② counts {kpi2} customers acquired (all time); ④ counts {ltv} (inside the cohort ' +
                    'window). The production tool raises this gap as a warning to check CohortStart / CohortEnd.',

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
      note5dt: 'A band only counts members who could have made it',
      note5dd: 'Put last month\'s new members in the 365-day denominator and people who simply have ' +
               'not had time to come back are counted as not coming back, dragging the rate down. ' +
               'Tracking days run up to today.',
      note6dt: 'LTV is gross profit, not revenue — and CAC is held to 3:1',
      note6dd: 'Gross profit = revenue − unit cost × units (returns signed). The running total is divided ' +
               'by <strong>every member acquired</strong>, including the ones who never came back. A third of ' +
               'that is the most one acquisition may cost while keeping LTV:CAC at 3:1. The demo\'s costs are invented.',
      fineprint: 'The production tool runs against roughly ten years and 3 million+ rows on SQL ' +
                 'Server: KPI1 returns in seconds, KPI2 takes 2–20 minutes. This demo runs on ' +
                 '6,824 synthetic rows and recalculates instantly in the browser. No real figures ' +
                 'or product codes appear anywhere in it.',
      footer: 'A demo on synthetic data. The core of ①–③ is ported from the sheets of ' +
              '<code>EC_Sales_Basket_Analysis_Demo.xlsx</code> (V2); multiple products, time bands ' +
              'and LTV are ported from the production V3 Power Query. The output is checked against ' +
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

  function fromUrl() {
    var m = /[?&]lang=(ja|en)\b/.exec(location.search);
    return m ? m[1] : null;
  }

  /*
   * ?lang= wins, so a link can pin the language the reader lands in; then a choice they
   * made earlier on this device; then what the browser asks for.
   */
  function initial() {
    var pinned = fromUrl();
    if (pinned) return pinned;
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
    lang: function () { return current; },
    pinnedInUrl: function () { return fromUrl() !== null; }
  };
})(window);
