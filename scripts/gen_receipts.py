"""Generate fixture receipt PNGs (fictional vendors, no real brands) + data/fixtures/manifest.json.
Colours come from brand-tokens/theme.py; never literal. Run: python3 scripts/gen_receipts.py"""
import hashlib, json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "brand-tokens"))
from theme import LIGHT_RGB as C  # noqa: E402

RECEIPTS = [  # (file, appeal_id, vendor, date, category, receipt_no, [(desc, amount)])
    ("r1.png", 1, "Greenfield Wholesale Foods", "2026-09-08", "food", "GW-1041", [("Rice 10 kg x2", 18.00), ("Lentils 5 kg x2", 22.00)]),
    ("r2.png", 1, "Greenfield Wholesale Foods", "2026-09-15", "food", "GW-1088", [("Tinned tomatoes x24", 21.00), ("Pasta 5 kg x4", 34.00)]),
    ("r3.png", 1, "Riverside Cash and Carry", "2026-09-22", "food", "RC-5520", [("Cooking oil 5 L x3", 33.00), ("Oats 3 kg x6", 27.00)]),
    ("r4.png", 2, "Hearth Kitchen Supply", "2026-09-25", "equipment", "HK-0307", [("Stock pot 40 L", 85.00), ("Ladles x5", 35.00)]),
    ("r5.png", 3, "Northgate Fuel Stop", "2026-10-01", "fuel", "NF-77812", [("Diesel 21.9 L", 35.00)]),
    ("r6.png", 3, "Northgate Fuel Stop", "2026-10-01", "fuel", "NF-77813", [("Diesel 21.9 L", 35.00)]),
    ("r7.png", 1, "Bulkway Provisions", "2026-10-06", "food", "BP-2290", [("Mixed pallet dry goods", 480.00)]),
    ("r8.png", 2, "Hearth Kitchen Supply", "2026-10-12", "equipment", "HK-0391", [("Chest freezer 200 L", 310.00)]),
    ("upload-sample.png", 1, "Corner Market Co-op", "2026-10-20", "food", "CM-0912", [("Fresh vegetables", 28.50), ("Bread loaves x8", 14.00)]),
]

def font(sz):
    return ImageFont.load_default(size=sz)

def draw(vendor, date, no, items):
    total = round(sum(a for _, a in items), 2)
    h = 260 + 34 * len(items)
    im = Image.new("RGB", (480, h), C["surface"])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 479, h - 1], outline=C["line-strong"], width=2)
    d.text((24, 22), vendor.upper(), fill=C["ink"], font=font(24))
    d.text((24, 58), f"Receipt {no}    Date {date}", fill=C["muted"], font=font(16))
    d.line([24, 88, 456, 88], fill=C["line"], width=2)
    y = 104
    for desc, amt in items:
        d.text((24, y), desc, fill=C["ink"], font=font(18))
        d.text((370, y), f"{amt:8.2f}", fill=C["ink"], font=font(18))
        y += 34
    d.line([24, y + 6, 456, y + 6], fill=C["line"], width=2)
    d.text((24, y + 20), "TOTAL USD", fill=C["ink"], font=font(22))
    d.text((350, y + 20), f"{total:9.2f}", fill=C["ink"], font=font(22))
    d.text((24, h - 44), "FIXTURE - fictional vendor - demo only", fill=C["muted"], font=font(14))
    return im, total

def main():
    rdir = os.path.join(ROOT, "data", "receipts"); fdir = os.path.join(ROOT, "data", "fixtures")
    os.makedirs(rdir, exist_ok=True); os.makedirs(fdir, exist_ok=True)
    manifest, seed = {}, []
    for f, appeal, vendor, date, cat, no, items in RECEIPTS:
        im, total = draw(vendor, date, no, items)
        p = os.path.join(rdir if f != "upload-sample.png" else fdir, f)
        im.save(p, format="PNG", optimize=False)
        h = hashlib.sha256(open(p, "rb").read()).hexdigest()
        ext = {"vendor": vendor, "date": date, "amount": total, "currency": "USD", "category": cat,
               "line_items": [{"description": d_, "amount": a} for d_, a in items], "confidence": 0.94}
        manifest[h] = ext
        if f != "upload-sample.png":
            seed.append({"file": f, "appeal_id": appeal, "hash": h, "extraction": ext})
    json.dump(manifest, open(os.path.join(fdir, "manifest.json"), "w"), indent=1)
    json.dump(seed, open(os.path.join(fdir, "seed-receipts.json"), "w"), indent=1)
    print(f"wrote {len(seed)} receipts + upload-sample, manifest {len(manifest)} entries")

if __name__ == "__main__":
    main()
