"""
Run every check over the demo engine, and fail loudly if any of them disagree.

    python tools/verify.py

1. The engine (js/kpi.js) against reference_impl.py — an independent implementation of the
   same specification, written set-wise where the engine uses row-relative running
   counters, and following the V3 queries' own shape for the time bands and the LTV
   curve. Compared across every scenario in scenarios.json, field by field.
2. productScan against compute(), product by product, so the one-pass shortcut behind ③
   is held to the same numbers as the long way round.
3. The month rows of the 月別推移 block against the workbook's own formulas, with the
   expectations worked out by hand from those formulas rather than from the engine.
4. The hand-written .xlsx export, opened with a real spreadsheet reader and checked
   against the seven-column contract the seasonal analyzer expects.
5. The page itself, loaded in headless Chrome in both languages, so a broken selector or
   a script that throws cannot pass while the arithmetic still checks out.

This is what the README means when it says the output is verified; it runs in CI on every
push so the claim stays true.
"""
import json, os, subprocess, sys, tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(REPO, 'tools')


def run(argv, **kw):
    return subprocess.run(argv, capture_output=True, text=True, encoding='utf-8', **kw)


def step(title):
    print('\n' + '=' * 68)
    print(title)
    print('=' * 68)


failures = []
skipped = []

# ---------------------------------------------------------------- 1. engine vs reference
step('1/5  engine (js/kpi.js) vs the independent Python reference')
scenarios = os.path.join(TOOLS, 'scenarios.json')
tmp = tempfile.mkdtemp(prefix='basket-verify-')
js_out = os.path.join(tmp, 'engine.json')
ref_out = os.path.join(tmp, 'reference.json')

proc = run(['node', os.path.join(TOOLS, 'run_engine.js'), REPO, scenarios])
if proc.returncode != 0:
    print(proc.stderr)
    failures.append('the engine run failed')
else:
    with open(js_out, 'w', encoding='utf-8') as f:
        f.write(proc.stdout)

    proc = run([sys.executable, os.path.join(TOOLS, 'reference_impl.py'), REPO, scenarios])
    if proc.returncode != 0:
        print(proc.stderr)
        failures.append('the reference run failed')
    else:
        with open(ref_out, 'w', encoding='utf-8') as f:
            f.write(proc.stdout)
        proc = run([sys.executable, os.path.join(TOOLS, 'compare.py'), js_out, ref_out])
        print(proc.stdout.strip())
        if proc.returncode != 0:
            print(proc.stderr)
            failures.append('the engine and the reference disagree')

# ------------------------------------------------------------- 2. productScan vs compute
step('2/5  productScan vs compute(), per product')
proc = run(['node', os.path.join(TOOLS, 'check_product_scan.js')])
print(proc.stdout.strip())
if proc.returncode != 0:
    print(proc.stderr)
    failures.append('productScan disagrees with compute()')

# --------------------------------------------------------- 3. month rows vs the workbook
step('3/5  月別推移 month rows vs the workbook formulas')
proc = run(['node', os.path.join(TOOLS, 'check_month_rows.js')])
print(proc.stdout.strip())
if proc.returncode != 0:
    print(proc.stderr)
    failures.append('the month rows do not match the workbook')

# --------------------------------------------------------------------- 4. xlsx contract
step('4/5  the exported .xlsx against the analyzer contract')
proc = run([sys.executable, os.path.join(TOOLS, 'check_xlsx_export.py')])
print(proc.stdout.strip())
if proc.returncode != 0:
    print(proc.stderr)
    failures.append('the exported workbook does not satisfy the contract')

# ------------------------------------------------------------------------- 5. the page
step('5/5  the page renders, in headless Chrome, in both languages')
proc = run([sys.executable, os.path.join(TOOLS, 'smoke_test.py')])
print(proc.stdout.strip() or proc.stderr.strip())
if proc.returncode != 0:
    # A missing browser is reported rather than passed over: a check that quietly skips
    # itself is worse than one that is not there, because it still reads as green.
    if 'no Chrome found' in (proc.stdout + proc.stderr):
        print('  -> SKIPPED: install Chrome, or set CHROME_PATH, to run this locally')
        skipped.append('the page smoke test (no browser available)')
    else:
        print(proc.stderr)
        failures.append('the page did not render')

# ------------------------------------------------------------------------------ verdict
print('\n' + '=' * 68)
if failures:
    print('FAILED (%d):' % len(failures))
    for f in failures:
        print('  - ' + f)
    sys.exit(1)
if skipped:
    print('PASSED, with %d skipped:' % len(skipped))
    for item in skipped:
        print('  - ' + item)
else:
    print('ALL CHECKS PASSED')
