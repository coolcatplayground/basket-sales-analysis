"""
Independent reference implementation of the KPI spec, used only to check js/kpi.js.

Deliberately written a different way from the JS: where the workbook (and therefore the
JS port) uses row-relative running counters to flag the first appearance of a customer,
this computes the same quantities as set cardinalities. If the two agree across several
parameter sets, the aggregation semantics are right in both.
"""
import csv, json, os, sys, calendar, statistics
from collections import defaultdict


def ymd(n):
    return n // 10000, (n // 100) % 100, n % 100


def fiscal(n):
    y, m, d = ymd(n)
    if d >= 21:
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return "%02d_%02d" % (y % 100, m)


def to_ord(n):
    y, m, d = ymd(n)
    import datetime
    return datetime.date(y, m, d).toordinal()


def edate(y, m, d, months):
    total = y * 12 + (m - 1) + months
    ny, nm = total // 12, total % 12 + 1
    return ny, nm, min(d, calendar.monthrange(ny, nm)[1])


def load(path):
    rows = []
    with open(path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            rows.append({
                "order": r["受注伝票番号"],
                "date": int(r["売上日"]),
                "member": r["会員ID"],
                "reg": int(r["会員登録日"]),
                "code": r["商品コード"],
                "name": r["商品名称"],
                "qty": int(r["注文数量"]),
                "amount": int(r["商品売価計"]),
                "status": r["受注ステータス"],
            })
    return rows


def parse_codes(pc):
    """V3 商品コード: "All", or comma-separated codes, trimmed and upper-cased."""
    if pc.strip().upper() == "ALL":
        return None
    codes = {c.strip().upper() for c in pc.split(",") if c.strip()}
    return codes or None


def analyse(rows, products, start, end, pc, as_of=None, cohort_start=None, cohort_end=None):
    codes = parse_codes(pc)
    is_all = codes is None
    as_of = as_of or end
    cohort_start = cohort_start or start
    cohort_end = cohort_end or end

    for r in rows:
        r["fiscal"] = fiscal(r["date"])
        r["isnew"] = 1 if r["fiscal"] == fiscal(r["reg"]) else 0
        r["in"] = 1 if start <= r["date"] <= end else 0
        st = r["status"]
        r["amt"] = r["amount"] if st == "11" else -r["amount"] if st == "14" else 0
        r["u"] = r["qty"] if st == "11" else -r["qty"] if st == "14" else 0
        r["ln"] = 1 if st == "11" else -1 if st == "14" else 0

    # purchase rank, per member, over completed orders only
    by_member = defaultdict(list)
    for i, r in enumerate(rows):
        by_member[r["member"]].append(i)

    rank_of_order = {}
    first_order, second_order = {}, {}
    for mid, idxs in by_member.items():
        rank = 0
        seen = []
        for i in idxs:
            o = rows[i]["order"]
            if not seen or seen[-1] != o:
                seen.append(o)
                if rows[i]["status"] == "11":
                    rank += 1
                rank_of_order[(mid, o)] = rank
            rows[i]["rank"] = rank_of_order[(mid, o)]
        for i in idxs:
            r = rows[i]
            if r["rank"] == 1 and mid not in first_order:
                first_order[mid] = (r["order"], r["date"])
            if r["rank"] == 2 and mid not in second_order:
                second_order[mid] = (r["order"], r["date"])

    # an ORDER qualifies if any of its lines is the target product
    order_lines = defaultdict(list)
    for r in rows:
        order_lines[r["order"]].append(r)
    order_target = {
        o: any(is_all or l["code"].upper() in codes for l in ls)
        for o, ls in order_lines.items()
    }

    reg_fiscal = {}
    for r in rows:
        reg_fiscal.setdefault(r["member"], r["fiscal"] if False else fiscal(r["reg"]))

    members = {}
    for mid in by_member:
        fo = first_order.get(mid)
        so = second_order.get(mid)
        qual = bool(fo) and order_target.get(fo[0], False)
        in_p = bool(fo) and start <= fo[1] <= end
        rep = qual and so is not None
        members[mid] = {
            "reg": reg_fiscal[mid],
            "qual": qual,
            "rep": rep,
            "days": (to_ord(so[1]) - to_ord(fo[1])) if rep else None,
            "tracked": (to_ord(as_of) - to_ord(fo[1])) if qual else None,
            "first": fo,
            "top2": qual and in_p,
        }

    # V3: the roll-up carries the product filter as well as the period
    def in_kpi1(r):
        return r["in"] and (is_all or r["code"].upper() in codes)

    inp = [r for r in rows if in_kpi1(r)]
    summary = {
        "revenue": sum(r["amt"] for r in inp),
        "units": sum(r["u"] for r in inp),
        "lines": sum(r["ln"] for r in inp),
        "customers": len({r["member"] for r in inp}),
        "newCustomers": len({r["member"] for r in inp if r["isnew"]}),
        "existingCustomers": len({r["member"] for r in inp if not r["isnew"]}),
    }
    summary["avgOrderValue"] = summary["revenue"] / summary["lines"] if summary["lines"] else 0
    summary["avgQty"] = summary["units"] / summary["lines"] if summary["lines"] else 0

    # Month rows run over the FISCAL months the period spans — CONFIG!B4/B5 in the
    # workbook are 開始月度の基準日 / 終了月度の基準日, not the raw dates.
    def fiscal_ym(n):
        y, m, d = ymd(n)
        if d >= 21:
            m += 1
            if m == 13:
                y, m = y + 1, 1
        return y * 12 + (m - 1)

    first, last = fiscal_ym(start), fiscal_ym(end)
    labels = []
    for n in range(36):
        idx = first + n
        if idx > last:
            break
        labels.append("%02d_%02d" % ((idx // 12) % 100, idx % 12 + 1))

    monthly = []
    for lab in labels:
        mrows = [r for r in rows if r["fiscal"] == lab]
        mi = [r for r in mrows if in_kpi1(r)]
        cust = {r["member"] for r in mi}
        monthly.append({
            "label": lab,
            "revenue": sum(r["amt"] for r in mi),
            "units": sum(r["u"] for r in mi),
            "lines": sum(r["ln"] for r in mi),
            "customers": len(cust),
            "newCustomers": len({r["member"] for r in mi if r["isnew"]}),
            "existingCustomers": len({r["member"] for r in mi if not r["isnew"]}),
        })

    qual_members = [m for m in members.values() if m["qual"]]
    cohorts = defaultdict(lambda: {"acq": 0, "rep": 0, "days": [], "tracked": []})
    for m in qual_members:
        c = cohorts[m["reg"]]
        c["acq"] += 1
        c["tracked"].append(m["tracked"])
        if m["rep"]:
            c["rep"] += 1
            c["days"].append(m["days"])

    def cohort_row(label, c):
        return {
            "label": label,
            "acquired": c["acq"],
            "repeated": c["rep"],
            "repeatRate": c["rep"] / c["acq"] if c["acq"] else 0,
            "avgDays": sum(c["days"]) / len(c["days"]) if c["days"] else 0,
            "medianDays": statistics.median(c["days"]) if c["days"] else None,
            "minDays": min(c["days"]) if c["days"] else None,
            "avgTracked": statistics.fmean(c["tracked"]) if c["tracked"] else None,
        }

    total = {
        "acq": len(qual_members),
        "rep": sum(1 for m in qual_members if m["rep"]),
        "days": [m["days"] for m in qual_members if m["rep"]],
        "tracked": [m["tracked"] for m in qual_members],
    }

    # KPI2_BAND, as the query writes it: filter the customer table per band
    bands = []
    for b in (30, 90, 180, 365, 730):
        eligible = [m for m in qual_members if m["tracked"] >= b]
        hit = [m for m in eligible if m["days"] is not None and m["days"] <= b]
        bands.append({"band": b, "eligible": len(eligible), "repeated": len(hit),
                      "repeatRate": len(hit) / len(eligible) if eligible else None})
    reps = [m for m in qual_members if m["rep"]]
    bands.append({"band": None, "eligible": len(qual_members), "repeated": len(reps),
                  "repeatRate": len(reps) / len(qual_members) if qual_members else None})

    # LTV_BASE -> LTV_粗利 -> LTV_SUMMARY, following the query's own shape: build the
    # grouped base table with text bucket labels, join the cost, then group and sort by
    # label text the way Table.Sort does.
    cohort = {mid: m for mid, m in members.items()
              if m["qual"] and cohort_start <= m["first"][1] <= cohort_end}

    def label(days):
        if days <= 90: return "090日"
        if days <= 180: return "180日"
        if days <= 365: return "365日"
        if days <= 730: return "730日"
        return "730日超"

    base_tbl = defaultdict(lambda: {"rev": 0, "qty": 0})
    for r in rows:
        m = cohort.get(r["member"])
        if not m or r["status"] not in ("11", "14") or r["date"] < m["first"][1]:
            continue
        key = (r["member"], r["code"].upper(), label(to_ord(r["date"]) - to_ord(m["first"][1])))
        base_tbl[key]["rev"] += r["amt"]
        base_tbl[key]["qty"] += r["u"]

    cost = {p["code"].upper(): p.get("cost") for p in products}
    grouped = defaultdict(lambda: {"gp": 0, "rev": 0, "buyers": set(), "missing": 0})
    for (mid, code, lab), v in base_tbl.items():
        c = cost.get(code)
        g = grouped[lab]
        g["gp"] += v["rev"] - (0 if c is None else c) * v["qty"]
        g["rev"] += v["rev"]
        g["buyers"].add(mid)
        g["missing"] += 1 if c is None else 0
    acquired = len({k[0] for k in base_tbl})
    labels = ["090日", "180日", "365日", "730日", "730日超"]
    assert labels == sorted(labels)
    bucket_num = {"090日": 90, "180日": 180, "365日": 365, "730日": 730, "730日超": None}
    ltv_rows, prefix = [], 0
    for lab in labels:
        g = grouped.get(lab, {"gp": 0, "rev": 0, "buyers": set(), "missing": 0})
        prefix += g["gp"]
        per = prefix / acquired if acquired else None
        ltv_rows.append({
            "bucket": bucket_num[lab], "grossProfit": g["gp"], "revenue": g["rev"],
            "buyers": len(g["buyers"]), "missingCost": g["missing"],
            "cumulativeGrossProfit": prefix, "perMember": per,
            "allowableCac": None if per is None else per / 3,
        })
    since = to_ord(as_of) - to_ord(cohort_end)
    ltv = {
        "cohortStart": cohort_start, "cohortEnd": cohort_end, "acquired": acquired,
        "daysSinceCohortEnd": since,
        "readableTo": 730 if since >= 730 else 365 if since >= 365 else 180 if since >= 180 else 0,
        "rows": ltv_rows,
    }

    def top(flagfn):
        agg = defaultdict(lambda: {"lines": 0, "revenue": 0})
        for r in rows:
            if flagfn(r):
                a = agg[r["code"]]
                a["lines"] += 1
                a["revenue"] += r["amount"]
        idx = {p["code"]: i for i, p in enumerate(products)}
        names = {p["code"]: p["name"] for p in products}
        out = [
            {"code": c, "name": names.get(c, ""), "lines": v["lines"], "revenue": v["revenue"]}
            for c, v in agg.items() if v["lines"] >= 1
        ]
        out.sort(key=lambda e: (-e["lines"], idx.get(e["code"], 9999)))
        return out[:10]

    t1 = top(lambda r: r["rank"] == 1 and r["status"] == "11"
             and order_target.get(r["order"], False) and r["in"])
    t2 = top(lambda r: r["rank"] == 2 and r["status"] == "11"
             and members[r["member"]]["top2"])

    return {
        "summary": summary,
        "monthly": monthly,
        "cohorts": {
            "total": cohort_row("合計", total),
            "rows": [cohort_row(k, cohorts[k]) for k in sorted(cohorts)],
        },
        "bands": bands,
        "ltv": ltv,
        "top1st": t1,
        "top2nd": t2,
    }


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    base = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(here)
    scenarios_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, "scenarios.json")

    orders = load(os.path.join(base, "data", "orders_demo.csv"))
    with open(os.path.join(base, "data", "products_demo.csv"), encoding="utf-8-sig") as f:
        products = [{"code": r["商品コード"], "name": r["商品名称"],
                     "cost": int(r["原価"]) if r.get("原価") not in (None, "") else None}
                    for r in csv.DictReader(f)]
    scenarios = json.load(open(scenarios_path, encoding="utf-8"))
    out = {}
    for s in scenarios:
        no_cost = set(s.get("noCost", []))
        prods = [dict(p, cost=None) if p["code"] in no_cost else p for p in products]
        out[s["label"]] = analyse(list(orders), prods, s["start"], s["end"], s["product"],
                                  s.get("asOf"), s.get("cohortStart"), s.get("cohortEnd"))
    print(json.dumps(out, ensure_ascii=False, sort_keys=True))
