"""
Independent reference implementation of the KPI spec, used only to check js/kpi.js.

Deliberately written a different way from the JS: where the workbook (and therefore the
JS port) uses row-relative running counters to flag the first appearance of a customer,
this computes the same quantities as set cardinalities. If the two agree across several
parameter sets, the aggregation semantics are right in both.
"""
import csv, json, os, sys, calendar
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


def analyse(rows, products, start, end, pc):
    pc = pc.upper()
    is_all = pc == "ALL"

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
        o: any(is_all or l["code"].upper() == pc for l in ls)
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
            "top2": qual and in_p,
        }

    inp = [r for r in rows if r["in"]]
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

    # month rows generated from the start date forward, cut off at the end date
    sy, sm, sd = ymd(start)
    labels, seen_labels = [], set()
    for n in range(36):
        y, m, d = edate(sy, sm, sd, n)
        if (y, m, d) > ymd(end):
            break
        lab = "%02d_%02d" % (y % 100, m)
        if lab not in seen_labels:
            seen_labels.add(lab)
            labels.append(lab)

    monthly = []
    for lab in labels:
        mrows = [r for r in rows if r["fiscal"] == lab]
        mi = [r for r in mrows if r["in"]]
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
    cohorts = defaultdict(lambda: {"acq": 0, "rep": 0, "days": []})
    for m in qual_members:
        c = cohorts[m["reg"]]
        c["acq"] += 1
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
        }

    total = {
        "acq": len(qual_members),
        "rep": sum(1 for m in qual_members if m["rep"]),
        "days": [m["days"] for m in qual_members if m["rep"]],
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
        "top1st": t1,
        "top2nd": t2,
    }


if __name__ == "__main__":
    base = sys.argv[1]
    orders = load(os.path.join(base, "data", "orders_demo.csv"))
    with open(base + "/data/products_demo.csv", encoding="utf-8-sig") as f:
        products = [{"code": r["商品コード"], "name": r["商品名称"]} for r in csv.DictReader(f)]
    scenarios = json.load(open(sys.argv[2], encoding="utf-8"))
    out = {}
    for s in scenarios:
        out[s["label"]] = analyse(list(orders), products, s["start"], s["end"], s["product"])
    print(json.dumps(out, ensure_ascii=False, sort_keys=True))
