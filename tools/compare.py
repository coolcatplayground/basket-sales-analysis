"""Diff the JS engine's output against the Python reference, scenario by scenario."""
import json, sys, math

a = json.load(open(sys.argv[1], encoding="utf-8"))   # js
b = json.load(open(sys.argv[2], encoding="utf-8"))   # ref

diffs = []


def walk(pa, x, y):
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y)):
            if k not in x:
                diffs.append(f"{pa}.{k}: missing in js")
            elif k not in y:
                diffs.append(f"{pa}.{k}: missing in ref")
            else:
                walk(f"{pa}.{k}", x[k], y[k])
    elif isinstance(x, list) and isinstance(y, list):
        if len(x) != len(y):
            diffs.append(f"{pa}: length {len(x)} vs {len(y)}")
        for i in range(min(len(x), len(y))):
            walk(f"{pa}[{i}]", x[i], y[i])
    elif isinstance(x, (int, float)) and isinstance(y, (int, float)):
        if not math.isclose(x, y, rel_tol=1e-9, abs_tol=1e-9):
            diffs.append(f"{pa}: {x} != {y}")
    elif x != y:
        diffs.append(f"{pa}: {x!r} != {y!r}")


walk("", a, b)

scen = sorted(set(a) | set(b))
print(f"scenarios compared: {len(scen)} -> {', '.join(scen)}")
for s in scen:
    if s in a:
        m = a[s]["summary"]
        print(f"  {s}: revenue={m['revenue']:,} lines={m['lines']} customers={m['customers']} "
              f"new={m['newCustomers']} months={len(a[s]['monthly'])} "
              f"acquired={a[s]['cohorts']['total']['acquired']} "
              f"repeatRate={a[s]['cohorts']['total']['repeatRate']:.4f} "
              f"top1st={len(a[s]['top1st'])} top2nd={len(a[s]['top2nd'])}")
if diffs:
    print(f"\nMISMATCHES ({len(diffs)}):")
    for d in diffs[:40]:
        print("  " + d)
    sys.exit(1)
print("\nALL MATCH")
