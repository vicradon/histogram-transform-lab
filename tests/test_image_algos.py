"""Checks for the whole-image morphology primitives in js/algos.js.

1. On 0/1 images with zero padding, imgMorph / imgHm / kalg(imgOps) must equal the drawn-grid
   binary versions (kmorph / khm / kalg) exactly.
2. On grayscale images, imgMorph must equal an independent NumPy min/max filter, for both
   padding modes, every preset and random structuring elements.

Run: python3 tests/test_image_algos.py [index.html]
"""
import json, pathlib, sys
import numpy as np
from playwright.sync_api import sync_playwright

page_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "index.html").resolve()
rng = np.random.default_rng(7)

def ref_morph(f, K, mode, pad):
    H, W = f.shape; n = len(K); r = n // 2
    big = np.inf if mode == "e" else -np.inf
    padv = 0.0 if pad == "zero" else (big)
    P = np.full((H + 2 * r, W + 2 * r), padv); P[r:r + H, r:r + W] = f
    out = np.full((H, W), big); any_cell = False
    for j in range(n):
        for i in range(n):
            if K[j][i] != 1: continue
            any_cell = True
            dy, dx = (j - r, i - r) if mode == "e" else (r - j, r - i)
            win = P[r + dy:r + dy + H, r + dx:r + dx + W]
            out = np.minimum(out, win) if mode == "e" else np.maximum(out, win)
    if not any_cell: return np.zeros((H, W))
    out[~np.isfinite(out)] = 0  # no in-image cell under the element ('ignore' padding)
    return out

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(page_path.as_uri()); pg.wait_for_timeout(300)
    KP = pg.evaluate("KernTab.KP.map(p=>p[1])")
    rand_K = [rng.choice([-1, 1], size=(n, n)).tolist() for n in (3, 5, 7) for _ in range(3)]
    fails = 0; checks = 0

    # 1. binary equivalence
    for trial in range(6):
        H, W = int(rng.integers(5, 14)), int(rng.integers(5, 14))
        g = (rng.random((H, W)) < 0.45).astype(int)
        res = pg.evaluate("""([g,W,H,Ks]) => { const {kmorph,khm,kalg,imgMorph,imgHm,imgOps}=Algos, G={W,H}; const out=[];
          for (const K of Ks) {
            const gb=Uint8Array.from(g), gf=Float64Array.from(g);
            for (const m of ['e','d']) out.push(['morph'+m, [...kmorph(G,gb,K,m)], [...imgMorph(G,gf,K,m,'zero')]]);
            out.push(['hm', [...khm(G,gb,K)], [...imgHm(G,gf,K,'zero')]]);
            const Kse=K.map(r=>r.map(v=>v===0?-1:v));
            for (const ex of ['A − (A ⊖ B)','(A ⊕ B) − (A ⊖ B)','A − ((A ⊖ B) ⊕ B)','(A ⊕ B) ⊖ B','Aᶜ ∩ (A ⊕ B)','(A ∘ B) ∪ (A • B)']) {
              const a=kalg(G,ex,gb,Kse), c=kalg(G,ex,gf,Kse,imgOps(G,Kse,1,'zero'));
              out.push(['alg '+ex, a.err||[...a.v], c.err||[...c.v]]) } }
          return out }""", [g.flatten().tolist(), W, H, KP + rand_K])
        for name, a, c in res:
            checks += 1
            if list(map(float, a)) != list(map(float, c)) if not isinstance(a, str) else a != c:
                fails += 1; print("BINARY MISMATCH", name, W, H)

    # 2. grayscale vs NumPy reference
    for trial in range(4):
        H, W = int(rng.integers(6, 30)), int(rng.integers(6, 30))
        f = rng.integers(0, 256, size=(H, W)).astype(float)
        for K in KP + rand_K:
            Kse = [[1 if v == 1 else -1 for v in row] for row in K]
            got = pg.evaluate("""([f,W,H,K]) => { const {imgMorph}=Algos, G={W,H}, F=Float64Array.from(f);
              return ['zero','ignore'].flatMap(pad=>['e','d'].map(m=>[...imgMorph(G,F,K,m,pad)])) }""", [f.flatten().tolist(), W, H, Kse])
            k = 0
            for pad in ("zero", "ignore"):
                for m in ("e", "d"):
                    checks += 1
                    exp = ref_morph(f, Kse, m, pad).flatten()
                    if not np.array_equal(np.array(got[k]), exp):
                        fails += 1; print("GRAY MISMATCH", pad, m, K)
                    k += 1
    b.close()
print(f"{'PASS' if not fails and not errs else 'FAIL'} - {checks} checks, {fails} mismatches, page errors: {errs}")
sys.exit(1 if fails or errs else 0)
