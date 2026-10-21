"""End-to-end check of the kernels tab's whole-image mode against NumPy/SciPy references.

Drives the real UI (open an image in the kernels tab, pick operations, press Apply, chain steps, reload,
undo) and compares every result the page produces with an independent implementation.

Run: python3 tests/test_kern_image.py [index.html]      (needs playwright, numpy, scipy, pillow)
"""
import pathlib, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from playwright.sync_api import sync_playwright

page_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "index.html").resolve()
fails = []

def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok: fails.append(name)

# ---- test image: uneven lighting, bright blobs (some touching), noise
rng = np.random.default_rng(3); W, H = 160, 120
yy, xx = np.mgrid[0:H, 0:W]; bg = 60 + 80 * (xx / W) + 30 * np.sin(yy / 20)
im = Image.fromarray(bg.astype("uint8")); d = ImageDraw.Draw(im)
for _ in range(14):
    x, y, r = rng.integers(6, W - 6), rng.integers(6, H - 6), rng.integers(2, 7)
    d.ellipse([x - r, y - r, x + r, y + r], fill=int(min(255, bg[y, x] + 80)))
d.rectangle([10, 90, 45, 112], fill=235); d.rectangle([30, 100, 65, 116], fill=235)
arr = np.clip(np.array(im).astype(float) + rng.normal(0, 5, (H, W)), 0, 255).astype("uint8")
tmp = pathlib.Path(tempfile.mkdtemp()) / "blobs.png"; Image.fromarray(arr).convert("RGB").save(tmp)

def morph(f, K, mode, pad):
    n = len(K); r = n // 2; big = np.inf if mode == "e" else -np.inf
    P = np.full((H + 2 * r, W + 2 * r), 0.0 if pad == "zero" else big); P[r:r + H, r:r + W] = f
    out = np.full((H, W), big)
    for j in range(n):
        for i in range(n):
            if K[j][i] != 1: continue
            dy, dx = (j - r, i - r) if mode == "e" else (r - j, r - i)
            w = P[r + dy:r + dy + H, r + dx:r + dx + W]
            out = np.minimum(out, w) if mode == "e" else np.maximum(out, w)
    out[~np.isfinite(out)] = 0
    return out

SQ3 = [[1] * 3] * 3; SQ5 = [[1] * 5] * 5

with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={"width": 1280, "height": 1000}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/cdnjs.cloudflare.com/**", lambda r: r.fulfill(body="", content_type="text/javascript"))
    pg.goto(page_path.as_uri()); pg.wait_for_timeout(300)
    pg.click(".tabs button[data-tab=kern]"); pg.wait_for_timeout(200)
    pg.set_input_files("#file", str(tmp)); pg.wait_for_timeout(600)

    card = lambda i: pg.locator("#main > section.card").nth(i + 1)        # card 0 is the source card
    def click(i, text): card(i).get_by_role("button", name=text, exact=True).first.click(); pg.wait_for_timeout(120)
    def apply(i): card(i).locator("button.primary").click(); pg.wait_for_timeout(500)
    def result(i):
        v = pg.evaluate("i=>{const R=KernImage.evaluate(App.cur).rows[i];return R.shown&&R.fresh?Array.from(R.shown.v,x=>isFinite(x)?x:(x>0?1e9:-1e9)):null}", i)
        return None if v is None else np.array(v, dtype=float).reshape(H, W)
    status = lambda i: card(i).locator(".kfoot .cap").inner_text()
    src = lambda: pg.evaluate("Array.from(KernImage.source(App.cur).v)")
    L = np.array(src(), dtype=float).reshape(H, W)
    check("source is the image luminance", np.array_equal(L, arr.astype(float)))

    # 1. grayscale erosion, both border modes
    apply(0); check("erosion 3x3, border ignored", np.array_equal(result(0), morph(L, SQ3, "e", "ignore")))
    pg.locator("#main > section.card").nth(0).get_by_role("button", name="Counted as 0", exact=True).click(); pg.wait_for_timeout(150)
    check("changing the border marks the result out of date", "out of date" in status(0) and result(0) is None, status(0))
    apply(0); check("erosion 3x3, border counted as 0", np.array_equal(result(0), morph(L, SQ3, "e", "zero")))
    pg.locator("#main > section.card").nth(0).get_by_role("button", name="Ignored", exact=True).click(); pg.wait_for_timeout(150)

    # 2. top-hat through the algebra panel, 5x5 square
    click(0, "Algebra"); click(0, "Top-hat"); click(0, "5 x 5"); apply(0)
    op = morph(morph(L, SQ5, "e", "ignore"), SQ5, "d", "ignore")
    check("top-hat A − ((A ⊖ B) ⊕ B), 5x5", np.array_equal(result(0), np.maximum(0, L - op)))
    click(0, "Gradient"); apply(0)
    check("gradient (A ⊕ B) − (A ⊖ B)", np.array_equal(result(0), np.maximum(0, morph(L, SQ5, "d", "ignore") - morph(L, SQ5, "e", "ignore"))))

    # 3. hit-or-miss is blocked on a grayscale input
    click(0, "Hit-or-miss")
    check("hit-or-miss blocked on grayscale input", card(0).locator("button.primary").is_disabled() and "binary" in status(0), status(0))

    # 4. binary source with the Otsu threshold
    pg.locator("#main > section.card").nth(0).get_by_role("button", name="Binary", exact=True).click(); pg.wait_for_timeout(200)
    t = pg.evaluate("Algos.otsuCalc(App.cur.nodes[0].h).bt")
    B = (L > t).astype(float)
    check("binary source = luminance > Otsu T", np.array_equal(np.array(src(), dtype=float).reshape(H, W), B), f"T={t}")
    check("hit-or-miss enabled on binary input", not card(0).locator("button.primary").is_disabled())
    click(0, "Erosion"); click(0, "3 x 3"); click(0, "4-conn cross"); apply(0)
    cross = [[-1, 1, -1], [1, 1, 1], [-1, 1, -1]]
    check("binary erosion with the 4-conn cross", np.array_equal(result(0), morph(B, cross, "e", "ignore")))

    # 5. labeling then relabeling (chain), against scipy.ndimage.label
    click(0, "Sequential labeling"); click(0, "V8: left, up, up-left, up-right"); apply(0)
    E = result(0)
    check("provisional labels cover exactly the foreground", np.array_equal(E > 0, B > 0))
    card(0).locator(".mh button.ibtn").click(); card(0).get_by_role("button", name="Use as input for new operation").click(); pg.wait_for_timeout(300)
    click(1, "Relabel through table"); apply(1)
    F = result(1); ref, n = ndimage.label(B, structure=np.ones((3, 3)))
    same_partition = all(len(np.unique(F[ref == c])) == 1 for c in range(1, n + 1)) and len(np.unique(F[F > 0])) == n
    check(f"relabeled components match scipy ({n} components, 8-connectivity)", same_partition)
    check("component count reported", f"{n} connected component" in status(1), status(1))

    # 6. reload: applied steps come back without pressing Apply
    pg.wait_for_timeout(400); pg.reload(); pg.wait_for_timeout(1200)
    F2 = result(1)
    check("results recomputed after reload", F2 is not None and np.array_equal(F2, F))

    # 7. undo/redo restores settings, and the restored step is still applied
    click(1, "Erosion"); pg.wait_for_timeout(400)
    check("switching op marks result out of date", result(1) is None)
    pg.click("#undo"); pg.wait_for_timeout(500)
    check("undo restores relabeling and its result", result(1) is not None and np.array_equal(result(1), F))

    # 8. distance transform: 1s read as ∞, V4 forward then V4 backward = city-block distance
    src_card = pg.locator("#main > section.card").nth(0)
    src_card.get_by_role("button", name="∞", exact=True).first.click(); pg.wait_for_timeout(200)
    click(0, "Weighted min/max-plus"); click(0, "V4 forward"); click(1, "Weighted min/max-plus"); click(1, "V4 backward"); apply(1)
    D = result(1); refD = ndimage.distance_transform_cdt(B, metric="taxicab").astype(float)
    check("V4 forward + backward = city-block distance transform", np.array_equal(D, refD))

    # 9. bigger image stays responsive (1200 px wide photo-sized input, 7x7 top-hat)
    big = pathlib.Path(tempfile.mkdtemp()) / "big.png"
    Image.fromarray(np.tile(arr, (8, 8))[:900, :1200]).convert("RGB").save(big)
    pg.set_input_files("#file", str(big)); pg.wait_for_timeout(1200)
    click(0, "Algebra"); click(0, "Top-hat"); click(0, "7 x 7"); apply(0); pg.wait_for_timeout(3000)
    ms = pg.evaluate("KernImage.evaluate(App.cur).rows[0].shown.ms")
    check(f"7x7 top-hat on 1200x900 runs in {ms} ms", ms < 5000)
    pg.screenshot(path=str(pathlib.Path(tempfile.gettempdir()) / "kern_image_big.png"))

    check("no page errors", not [e for e in errs if "reading 'then'" not in e], str(errs))
    br.close()

print(f"\n{'PASS' if not fails else 'FAIL'}: {len(fails)} failing check(s)")
sys.exit(1 if fails else 0)
