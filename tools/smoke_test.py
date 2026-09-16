"""
Load the actual page in a real browser and check it rendered.

The other checks prove the arithmetic. None of them would notice a renamed element id, a
broken selector or a script that throws on load — the suite would stay green while the page
showed nothing. This serves the folder, opens it in headless Chrome, lets the scripts run,
and then asserts against the DOM that came out.

Two runs, one per language. The language is pinned with ?lang= rather than through the
browser's own locale: whether a --lang flag reaches navigator.language varies by platform,
and a test that depends on that fails for reasons that have nothing to do with the page.

No browser-automation dependency: Chrome's own --dump-dom prints the DOM after scripts have
run, which is all this needs. Uncaught errors are caught through the page's own error
banner, which is exactly what it exists for.
"""
import http.server, os, re, shutil, socket, subprocess, sys, tempfile, threading

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CHROME_CANDIDATES = [
    os.environ.get('CHROME_PATH'),
    'google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
]


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if not candidate:
            continue
        if os.path.isabs(candidate) and os.path.exists(candidate):
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    return None


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(port):
    handler = lambda *a, **kw: QuietHandler(*a, directory=REPO, **kw)
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def dump_dom(chrome, url):
    profile = tempfile.mkdtemp(prefix='smoke-profile-')
    try:
        proc = subprocess.run([
            chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
            '--disable-dev-shm-usage',   # small /dev/shm on CI containers crashes the tab
            '--no-first-run', '--user-data-dir=' + profile,
            '--virtual-time-budget=10000', '--dump-dom', url
        ], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
        return proc.stdout or '', proc.returncode, (proc.stderr or '').strip()
    finally:
        shutil.rmtree(profile, ignore_errors=True)


# Each case: a query string, and the strings the rendered page must contain. Nothing here
# depends on today's date, which the tracking days and the band denominators do.
CASES = [
    ('lang=ja', [
        ('the roll-up heading', '売上集計'),
        ('the revenue tile', '¥25,258,140'),
        # the first month row is 25_02, not an empty 25_01 — the workbook's own seeding
        ('the first month row', '1,294,060'),
        ('the top acquirer', 'CT106'),
        ('a Japanese product name', '耳そうじシート 40枚'),
        ('the co-purchase heading', 'TOP10_1ST'),
        ('the product comparison heading', '商品別 獲得力'),
        ('the callout naming the outlier', 'CT108'),
        ('the export contract header', '月別推移'),
        ('the time-band table', '生涯（期間無制限）'),
        ('the LTV heading', 'LTV 解析'),
        ('90-day cumulative gross profit per member', '¥11,430'),
        ('365-day allowable CAC', '¥5,377'),
    ]),
    ('lang=ja&product=CT101,CT102', [
        # V3: the roll-up follows the product filter, so this is not the catalogue total
        ('the two-product revenue tile', '¥2,343,550'),
        ('the picker summary', '2 商品を選択中'),
    ]),
    ('lang=en', [
        ('the roll-up heading', 'Sales roll-up'),
        ('the revenue tile', '¥25,258,140'),
        ('an English product name', 'Ear Wipes 40p'),
        ('the comparison column', 'Customers acquired'),
        ('the export contract header', '月別推移'),
        ('the LTV heading', 'Lifetime value'),
        ('the band header', 'Members trackable'),
    ]),
]

# Nothing that indicates the page fell over.
FORBIDDEN = ['スクリプトエラー', 'Script error:', 'Could not load the data',
             'データを読み込めませんでした', 'undefined —', 'NaN']


def main():
    chrome = find_chrome()
    if not chrome:
        sys.exit('no Chrome found; set CHROME_PATH to a Chrome or Chromium binary')
    print('browser : %s' % chrome)

    port = free_port()
    httpd = serve(port)
    url = 'http://127.0.0.1:%d/index.html' % port
    print('serving : %s' % url)
    failures = []

    try:
        for query, expectations in CASES:
            lang = query
            dom, code, err = dump_dom(chrome, url + '?' + query)
            if not dom.strip():
                # say why, so a CI failure does not need a local reproduction
                failures.append('%s: the browser returned no DOM (exit %s)%s'
                                % (lang, code, ('\n    ' + err[:800]) if err else ''))
                continue

            for what, needle in expectations:
                if needle not in dom:
                    failures.append('%s: %s is missing (%r)' % (lang, what, needle))
            if err:
                print('  (chrome stderr: %s)' % err.splitlines()[0][:120])

            for bad in FORBIDDEN:
                if bad in dom:
                    failures.append('%s: the page shows %r' % (lang, bad))

            dots = len(re.findall(r'<circle', dom))
            if dots < 90:
                failures.append('%s: only %d scatter circles, expected 90+' % (lang, dots))

            # the product table's 30 rows plus the two TOP10 tables' 10 each
            code_rows = len(re.findall(r'<tr[^>]*>\s*<th scope="row">C[A-Z]\d{3}</th>', dom))
            if code_rows < 50:
                failures.append('%s: %d rows keyed by product code, expected 50' %
                                (lang, code_rows))

            print('%-3s     %d circles, %d product-code rows, %d KB of DOM' %
                  (lang, dots, code_rows, len(dom) // 1024))
    finally:
        httpd.shutdown()

    if failures:
        print('\nFAILURES (%d):' % len(failures))
        for f in failures:
            print('  ' + f)
        sys.exit(1)
    print('\nthe page renders in both languages')


if __name__ == '__main__':
    main()
