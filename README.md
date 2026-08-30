# EC Sales KPI & First-Purchase Basket Analysis

An Excel-based analytics tool I built for the e-commerce team at my workplace. It turns a raw order
database into two things the team could not get before: same-day sales KPIs for any product and
period, and a customer-behaviour view that follows a product from a customer's first purchase
through to what they bought the second time.

> **No company data appears in this repository.** This is a write-up of a tool that runs on an
> internal SQL Server. Figures below are relative or structural; no revenue, customer counts or real
> product codes are published. Server names, database names, file paths and vendor table names in
> the code samples are replaced with placeholders.

---

## The problem

The company had the data and no way to ask it questions.

Order history lived in a SQL Server database. Getting anything out of it meant opening Access and
writing a query by hand — which meant knowing the schema, knowing which status codes counted, and
knowing how the accounting month worked. In practice that put a specialist between every question
and its answer, and it made a small question cost about as much as a large one. Nobody had built a
standing report, because building one was the whole job.

Two separate needs came out of that.

**Fast sales figures (KPI1).** People needed the month's revenue, units and customer split without a
round trip through someone else's query. The bar was not sophistication, it was speed — a number you
can act on the same afternoon.

**Customer behaviour (KPI2).** A colleague wanted to study how products actually perform, which
turned out to be a chain of questions rather than one:

1. Did this product spike in a particular period, beyond its usual baseline?
2. If it spiked, did it bring in *new* customers, or just sell more to existing ones?
3. If it brought in new customers, did any of them come back?
4. If they came back — **what did they buy the second time?** The same product again, or something
   adjacent?

That last question is the reason the tool exists. A product's own sales line cannot answer it. A
cheap item can look unremarkable on the revenue ranking and still be the thing that opens the
relationship and pulls a customer back weeks later toward something expensive. Nothing in the
existing reporting could tell those two cases apart.

## What it does

**KPI1 — sales roll-up.** For any date range and any product (or the whole catalogue): net revenue,
units, order lines, distinct customers, and a new-versus-returning split. Period totals plus a
month-by-month trend.

**KPI2 — first-purchase basket analysis.** Give it a product code and it finds every customer whose
*first ever order* contained that product, then reports:

| Output | The question it answers |
|---|---|
| 初回購入顧客数 | How many customers did this product acquire? |
| リピート率 | What share of them came back for a second order? |
| 平均リピート日数 | How long did they take? |
| **TOP10_1ST** | What else was in that first order? |
| **TOP10_2ND** | What did those customers buy on their *second* order? |

The two TOP10 tables are the payoff. `TOP10_1ST` is a genuine co-purchase list, because the tool
keeps **every line of the qualifying order**, not just the line that matched the filter.
`TOP10_2ND` answers the repeat question directly: same product, or a related one.

Results are broken out by registration-month cohort, so a product's acquisition performance can be
read against the month those customers actually joined instead of being smeared across ten years of
history.

## How it works

```
SQL Server (order database, ~10 years of history)
    │
    │  Value.NativeQuery — aggregation pushed down to the server
    ▼
Power Query (M)  ←── parameters read back out of the sheet (tblParameter)
    │
    ├─→ small result sets  ─→ worksheet tables ─→ dashboard
    └─→ large fact tables  ─→ Power Pivot data model
    │
    ▼
VBA: the fast group and the slow group refresh on separate buttons
```

Parameters — start date, end date, product code — live in a table on the dashboard. Power Query
reads them back out of the sheet, so changing a cell changes the SQL that gets sent. Nobody has to
touch a query to change the question.

Three decisions shaped the build.

**Push aggregation down to the server.** The first version pulled order detail into Power Query and
aggregated it there. It worked, and it was far too slow to be useful. `KPI1_SUMMARY` and
`KPI1_MONTHLY` were rewritten as `Value.NativeQuery` so SQL Server does the `GROUP BY` and returns a
handful of rows instead of millions. The date filter is also applied to the detail table *before*
any join, while the step can still fold.

**Filter on order status only after the join.** Status lives on the order header, not the detail
line, so the status filter cannot run until the header join has happened. Getting that order wrong
drops rows silently rather than raising an error — the kind of bug that produces a plausible number.

**Split the refresh.** KPI1 returns in seconds. KPI2 walks every customer's full purchase history
and takes **two to twenty minutes** depending on parameters. They sit behind separate buttons so
someone who only wants this month's revenue is not held hostage by the cohort pass. The dashboard
says so in plain language, right next to the slow button.

## Business rules encoded in the tool

**The month is not the calendar month.** The accounting month closes on the 20th, so a sale on the
21st belongs to the *next* month:

```
月度 = if DAY(売上日) >= 21 then month(売上日) + 1 else month(売上日)
```

The same rule is applied to the customer's registration date, and the two buckets are compared to
decide whether a customer is new or returning *in that month*. One consequence is worth stating
plainly: the same person can be "new" in one month and "returning" in another, so new + returning
does not equal the distinct customer count over a longer period. That is correct, not a bug — but it
needs saying out loud, because it is the first thing that looks wrong to someone reading the output.

**Revenue is net of returns.** Status `11` is a completed order, `14` is a return. Every measure is
signed rather than filtered, so returns subtract instead of disappearing:

```sql
SUM(CASE WHEN 受注ステータス='11' THEN 商品売価計
         WHEN 受注ステータス='14' THEN -商品売価計 ELSE 0 END)
```

**Purchase rank is per customer, over completed orders only.**
`ROW_NUMBER() OVER (PARTITION BY 会員ID ORDER BY 売上日, 受注伝票番号)` identifies each customer's
first and second order. Cancelled orders do not consume a rank.

**"First-purchase basket" means the whole order,** as described above — the reason the co-purchase
tables carry information rather than restating the filter.

## Scale

- Roughly **ten years** of order history
- On the order of **25,000 order lines per month**, so **3 million+ rows** in total
- Roughly **700–800 products**
- KPI1 refresh: seconds. KPI2 refresh: 2–20 minutes.

## What changed

It changed how sales data gets used, rather than producing one headline decision.

Anyone who needs the month's sales can now pull them at speed instead of queuing behind a
hand-written Access query. If they want more detail, the queries are already built and parameterised
— they change a cell rather than writing SQL. The effect is less that one report got faster and more
that the cost of asking dropped far enough that people ask.

The heaviest user has been the **企画 (product planning) department**, and the output feeds
downstream: the same data now drives a seasonal sales-potential analyzer I built separately, which
models how demand for a product varies across the year.

## The monthly table is an export contract

The 月別推移 block is not just a display. Its seven columns are the input format of the
**Sales Ledger** seasonal analyzer — the second tool was built on top of this one's output, so the
header row is a contract between them:

| 月別推移 | 売上金額 | 購入個数 | 購入件数 | 総顧客数 | 新規顧客数 | 既存顧客数 |
|---|---|---|---|---|---|---|
| 25_04 | 1294060 | 223 | 179 | 121 | 36 | 85 |

The workflow is: set the product and period here, copy the block into a sheet named after the
product, save, and drop it on the analyzer. The sheet name becomes the product name; the analyzer
merges by year-month, so re-exporting the full history is safe.

The demo workbook carries a dedicated `EXPORT` sheet in exactly this shape. The handoff is verified
end to end — the analyzer's parser resolves all seven columns against this workbook and its stats
engine analyses the result without modification.

## Repository contents

| Path | What it is |
|---|---|
| `EC_Sales_Basket_Analysis_Demo.xlsx` | A runnable version of the logic above on synthetic data, including the `EXPORT` sheet |
| `data/orders_demo.csv` | The synthetic dataset the demo runs on — the raw columns of the workbook's `DATA_ORDERS` sheet |

The production layer — the Power Query (M) section, the native T-SQL it sends, and the VBA refresh
macros — is not published here. It runs against an internal SQL Server and is quoted in this README
only where a fragment is readable on its own.

The demo workbook reproduces the logic above with worksheet formulas over a local table, so it opens
and recalculates without a database or credentials. Its outputs were verified against an independent
implementation of the same specification.

### Running the demo

Open the workbook and edit three cells on the **DASHBOARD** sheet — everything else recalculates.
No macros, no connection, no credentials.

| Cell | Parameter | Format |
|---|---|---|
| `C6` | StartDate | `YYYYMMDD`, e.g. `20250121` |
| `C7` | EndDate | `YYYYMMDD`, e.g. `20260620` |
| `C8` | 商品コード | a product code such as `SK106`, or `All` for the whole catalogue |

The sheets behind it: `KPI1_SUMMARY` / `KPI1_MONTHLY` (the sales roll-up and its month-by-month
trend), `KPI2_SUMMARY` (the first-purchase cohort), `TOP10_1ST` / `TOP10_2ND` (the two co-purchase
tables), `EXPORT` (the seven-column handoff block), and `DATA_ORDERS` / `MEMBERS` / `PRODUCTS`
holding the synthetic data and the per-row working columns.

Because the file is generated rather than saved by Excel, it carries a full-recalculate-on-open
flag; if a viewer ever shows blanks, `Ctrl+Alt+F9` forces the same pass.

## Sanitisation

Removed or replaced relative to the internal version: the embedded data model (a copy of production
order tables), all real figures and product identifiers, the SQL Server host and database names
(→ `<SQL_SERVER>` / `<ORDER_DB>`), the internal file-share path to the product master, and the
vendor's physical table names (→ `T_ORDER_DETAIL`, `T_ORDER_HEADER`, `T_MEMBER`, `T_PRODUCT`).

Japanese business column names (`売上日`, `商品コード`, `会員ID`) are kept — they are generic
e-commerce terms, and the queries read better with them intact.

---

**Stack:** SQL Server · Power Query (M) · Power Pivot · VBA · Excel
