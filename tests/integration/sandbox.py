"""Live PayPal SANDBOX integration tests T4, T5, T7, T8 against a running Glasshouse server.
Usage: python3 tests/integration/sandbox.py <app_url> <cdp_url>
Needs a freshly seeded DB (npm run seed). Buyer login comes from `secret-get paypal-sandbox-buyer`
and is never printed. Results: JSON lines on stdout, exit 1 on any FAIL."""
import json, os, sqlite3, struct, subprocess, sys, time, urllib.request, urllib.parse, zlib
from pathlib import Path

APP, CDP = sys.argv[1].rstrip("/"), sys.argv[2]
DB = Path(__file__).resolve().parents[2] / "data" / "glasshouse.db"
results = []

def rec(t, ok, **kw):
    results.append(ok); print(json.dumps({"test": t, "result": "PASS" if ok else "FAIL", **kw}), flush=True)

def q(sql, *a):
    with sqlite3.connect(DB) as c: return c.execute(sql, a).fetchall()

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a): return None
opener = urllib.request.build_opener(NoRedirect)

def png():
    """A fresh, never-seen PNG with nothing readable on it (random noise rows)."""
    w, hgt = 64, 64
    raw = b"".join(b"\x00" + os.urandom(w * 3) for _ in range(hgt))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, hgt, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")

def call(method, path, body=None, cookie=None, form=False, multipart=None):
    data = None; h = {}
    if multipart is not None:
        bd = "----gh" + os.urandom(8).hex(); parts = []
        for k, v in multipart.items():
            if isinstance(v, bytes):
                parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"; filename="r.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + v + b"\r\n")
            else:
                parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        data = b"".join(parts) + f"--{bd}--\r\n".encode(); h["content-type"] = f"multipart/form-data; boundary={bd}"
    if body is not None:
        data = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        h["content-type"] = "application/x-www-form-urlencoded" if form else "application/json"
    if cookie: h["cookie"] = cookie
    req = urllib.request.Request(APP + path, data=data, headers=h, method=method)
    try: r = opener.open(req, timeout=60)
    except urllib.error.HTTPError as e: r = e
    raw = r.read(); hdrs = r.headers
    try: b = json.loads(raw)
    except Exception: b = None
    return r.status, b, hdrs

def login(email):
    s, _, h = call("POST", "/api/auth/login", {"email": email, "password": "glasshouse-demo"}, form=True)
    return h["set-cookie"].split(";")[0]

trustee = login("trustee@northside.test")

# D1: an unreadable receipt ($0, confidence 0) is HELD on upload and can never be approved or paid
vol = login("volunteer@northside.test")
s, b, _ = call("POST", "/api/receipts", cookie=vol, multipart={"appeal_id": "1", "receipt": png()})
sp = (b or {}).get("spend") or {}
a, ab, _ = call("POST", f"/api/spends/{sp.get('id')}/approve", {}, trustee)
p_, pb_, _ = call("POST", "/api/payouts", {"spend_id": sp.get("id")}, trustee)
rows = q("SELECT count(*) FROM payouts WHERE spend_id=?", sp.get("id"))[0][0]
rec("D1 $0 unreadable receipt held + unpayable", s == 201 and sp.get("status") == "held" and sp.get("amount_cents") == 0 and a == 403 and p_ == 403 and rows == 0,
    upload=s, spend=sp.get("id"), status=sp.get("status"), reason=sp.get("hold_reason"), approve=a, payout=p_, payout_rows=rows)

# D5: approving more than the appeal has raised -> 409 "not enough raised", no payout row
big = q("SELECT coalesce(sum(amount_cents),0) FROM donations WHERE appeal_id=1 AND status='COMPLETED'")[0][0] + 100
with sqlite3.connect(DB) as c:
    sid5 = c.execute("INSERT INTO spends(appeal_id,vendor,date,amount_cents,currency,category,line_items,confidence,extracted_by,receipt_file,receipt_hash,status,hold_reason,flags,created_by,created_at) "
                     "SELECT appeal_id,'Funds-check probe',date,?,currency,category,line_items,confidence,extracted_by,receipt_file,'probe-d5',  'pending',NULL,'[]',created_by,created_at FROM spends WHERE id=8", (big,)).lastrowid
s, b, _ = call("POST", f"/api/spends/{sid5}/approve", {}, trustee)
rows = q("SELECT count(*) FROM payouts WHERE spend_id=?", sid5)[0][0]
rec("D5 approve over funds refused", s == 409 and rows == 0 and q("SELECT status FROM spends WHERE id=?", sid5)[0][0] == "pending", http=s, error=(b or {}).get("error"), payout_rows=rows)
q("DELETE FROM spends WHERE id=?", sid5)

# T7: payout for an unapproved (pending) spend and for held spends -> 403, no batch row
for sid in (8, 7, 6):
    s, b, _ = call("POST", "/api/payouts", {"spend_id": sid}, trustee)
    rows = q("SELECT count(*) FROM payouts WHERE spend_id=?", sid)[0][0]
    rec(f"T7 spend#{sid}", s == 403 and rows == 0, http=s, payout_rows=rows, error=(b or {}).get("error"))
s, b, _ = call("POST", "/api/spends/7/approve", {}, trustee)
rec("T10 held anomaly cannot be approved", s == 403 and q("SELECT count(*) FROM payouts WHERE spend_id=7")[0][0] == 0, http=s)

# T8: approve spend 8 -> exactly one batch even when approved twice; poll to a terminal status
s1, b1, _ = call("POST", "/api/spends/8/approve", {}, trustee)
s2, b2, _ = call("POST", "/api/spends/8/approve", {}, trustee)
rows = q("SELECT batch_id, sender_batch_id FROM payouts WHERE spend_id=8")
status, deadline = None, time.time() + 120
while time.time() < deadline:
    _, pb, _ = call("POST", "/api/payouts/8/poll", {}, trustee)
    status = ((pb or {}).get("payout") or {}).get("status")
    if status in ("SUCCESS", "DENIED", "CANCELED"): break
    time.sleep(5)
spend_status = q("SELECT status FROM spends WHERE id=8")[0][0]
rec("T8 one batch + polled", s1 == 201 and s2 == 200 and len(rows) == 1 and bool(rows[0][0]) and status == "SUCCESS" and spend_status == "paid",
    first=s1, replay=s2, rows=len(rows), batch_id=rows[0][0] if rows else None, sender_batch_id=rows[0][1] if rows else None, batch_status=status, spend=spend_status)

# T4: donate $25 to appeal 1 -> buyer approves in the sandbox -> return URL captures -> ledger row within 5 s
donor = login("donor@northside.test")
s, b, _ = call("POST", "/api/donate", {"appeal_id": 1, "amount": "25.00"}, donor)
order, approve = b["order_id"], b["approve"]
email = "sb-5890d53512385@personal.example.com"  # sandbox buyer (fake sandbox identity)
pw = subprocess.run(["bash", "-lc", f"secret-get paypal-sandbox-buyer {email}"], capture_output=True, text=True).stdout.strip()

from playwright.sync_api import sync_playwright
t_return = None
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp(CDP)
    ctx = br.new_context(viewport={"width": 1400, "height": 900})
    pg = ctx.new_page(); pg.goto(approve, wait_until="domcontentloaded")
    pg.wait_for_selector("#email", timeout=60000); pg.focus("#email"); pg.fill("#email", ""); pg.locator("#email").press_sequentially(email, delay=20)
    if pg.locator("#btnNext").is_visible(): pg.click("#btnNext")
    pg.wait_for_selector("#password", state="visible", timeout=60000); pg.focus("#password"); pg.locator("#password").press_sequentially(pw, delay=20)
    pg.click("#btnLogin")
    btn = pg.locator("[data-testid=submit-button-initial], #payment-submit-btn, button:has-text('Complete Purchase'), button:has-text('Continue')").first
    btn.wait_for(state="visible", timeout=90000); time.sleep(2); btn.click()
    pg.wait_for_url(lambda u: urllib.parse.urlparse(u).path.startswith(("/api/donate/return", "/trace/", "/donate")), timeout=90000)  # D14: path, not origin
    t_return = time.time()
    pg.wait_for_load_state("domcontentloaded")
    landed = pg.url
    ctx.close()
done = None
while time.time() - t_return < 5:
    r = q("SELECT id, amount_cents, status FROM donations WHERE order_id=?", order)
    if r and r[0][2] == "COMPLETED": done = r[0]; break
    time.sleep(0.2)
lag = round(time.time() - t_return, 2)
_, led, _ = call("GET", "/api/ledger")
in_ledger = bool(done) and any(d.get("id") == done[0] for d in (led or {}).get("donations", []))
rec("T4 donate -> ledger <=5s", bool(done) and done[1] == 2500 and in_ledger, order=order, landed=urllib.parse.urlparse(landed).path, seconds_after_return=lag, in_public_ledger=in_ledger)

# T5: replay the capture twice -> 200 replay, still one completed row, same capture id
cap_before = q("SELECT capture_id FROM donations WHERE order_id=?", order)[0][0]
r1 = call("POST", "/api/donate/capture", {"order_id": order}); r2 = call("POST", "/api/donate/capture", {"order_id": order})
rows = q("SELECT count(*), max(capture_id) FROM donations WHERE order_id=? AND status='COMPLETED'", order)[0]
rec("T5 replay idempotent", r1[0] == 200 and r2[0] == 200 and r1[1].get("replay") and rows[0] == 1 and rows[1] == cap_before, http=[r1[0], r2[0]], completed_rows=rows[0])

# D13: a REAL second capture at PayPal with the same request id cap-<order> -> PayPal replays, same capture id, still one row
with sqlite3.connect(DB) as c: c.execute("UPDATE donations SET status='CREATED', capture_id=NULL WHERE order_id=?", (order,))
r3 = call("POST", "/api/donate/capture", {"order_id": order})
after = q("SELECT count(*), max(capture_id) FROM donations WHERE order_id=? AND status='COMPLETED'", order)[0]
rec("T5b real PayPal double capture idempotent", r3[0] in (200, 201) and after[0] == 1 and after[1] == cap_before, http=r3[0], replay=(r3[1] or {}).get("replay"), same_capture_id=after[1] == cap_before)

# T9 on the live donation: trace sums to exactly $25.00
did = q("SELECT id FROM donations WHERE order_id=?", order)[0][0]
_, tr, _ = call("GET", f"/api/trace/{did}")
tot = sum(x["cents"] for x in (tr or {}).get("rows", []))
rec("T9 live trace sums to $25.00", tot == 2500 and (tr or {}).get("total_cents") == 2500, donation=did, rows=len((tr or {}).get("rows", [])), sum_cents=tot)
sys.exit(0 if all(results) else 1)
