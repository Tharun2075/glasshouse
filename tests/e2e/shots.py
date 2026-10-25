"""Browser e2e: every page at 1280x800 and 390x844, console errors, axe serious/critical, AG Grid watermark.
Env: URL (app), OUT (screenshot dir), AXE (path to axe.min.js), CDP (optional: attach to a running Chrome instead of launching).
Prints one JSON line per page and exits 1 on any failure."""
import json, os, sys
from playwright.sync_api import sync_playwright

URL = os.environ["URL"].rstrip("/")
OUT = os.environ.get("OUT", "/work/out")
AXE = open(os.environ.get("AXE", os.path.join(os.path.dirname(__file__), "../../node_modules/axe-core/axe.min.js"))).read()
TRACE = os.environ.get("TRACE_ID", "1")
PAGES = [(None, "home", "/"), (None, "login", "/login"), (None, "trace", f"/trace/{TRACE}"),
         ("donor@northside.test", "donate", "/donate"), ("volunteer@northside.test", "volunteer", "/volunteer"),
         ("trustee@northside.test", "trustee", "/trustee")]
os.makedirs(OUT, exist_ok=True)
fails = 0
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(os.environ["CDP"]) if os.environ.get("CDP") else p.chromium.launch()
    for vw, vh in [(1280, 800), (390, 844)]:
        for who, name, path in PAGES:
            ctx = browser.new_context(viewport={"width": vw, "height": vh})
            if who:
                ctx.request.post(URL + "/api/auth/login", form={"email": who, "password": "glasshouse-demo"}, max_redirects=0)
            page = ctx.new_page()
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(URL + path, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
            shot = f"{OUT}/{name}-{vw}x{vh}.png"
            page.screenshot(path=shot, full_page=True)
            page.add_script_tag(content=AXE)
            v = page.evaluate("async () => (await axe.run(document, {resultTypes: ['violations']})).violations.filter(x => ['serious','critical'].includes(x.impact)).map(x => x.id + ':' + x.nodes.length)")
            html = page.content()
            watermark = "ag-watermark" in html or "For Development Purposes Only" in html
            grid = page.locator(".ag-root").count()
            ok = not errors and not v and not watermark and page.url.startswith(URL + path.split("?")[0])
            fails += not ok
            print(json.dumps({"page": name, "viewport": f"{vw}x{vh}", "result": "PASS" if ok else "FAIL", "url": page.url[len(URL):],
                              "console_errors": errors[:3], "axe_serious_critical": v, "watermark": watermark, "ag_grid": grid, "shot": os.path.basename(shot)}), flush=True)
            ctx.close()
sys.exit(1 if fails else 0)
