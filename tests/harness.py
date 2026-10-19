"""Safety net for the Histogram Transform Lab refactor.

Usage:
  python3 tests/harness.py record original.html     -> writes tests/golden.json
  python3 tests/harness.py check  histogram-lab.html -> compares against tests/golden.json

Two layers:
  1. Golden outputs of every pure function (LUTs, Otsu, ISODATA, morphology,
     hit-or-miss, weighted scans, labeling, algebra) on fixed inputs.
  2. A scripted UI walk through all four tabs (load image, apply transforms,
     bit planes, Otsu stepping, kernel drawing, every kernel op, chaining,
     labeling table upgrade, undo/redo, reload/restore). At each checkpoint it
     hashes every canvas and the visible text, so any visual change shows up.
"""
import hashlib, json, sys, pathlib, io
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
GOLDEN = HERE / "golden.json"
SHOTS = HERE / "golden-shots"


def shot_diff(a_png, b_bytes):
    """Pixels that differ by more than anti-aliasing noise (> 16 of 255)."""
    a = Image.open(a_png).convert("L"); b = Image.open(io.BytesIO(b_bytes)).convert("L")
    if a.size != b.size:
        return f"size {a.size} vs {b.size}"
    n = sum(ImageChops.difference(a, b).histogram()[17:])
    return f"{n} pixels" if n else None

PURE_JS = r"""
() => {
  const {cdfOf, meanOf, lohi, hist, toGray, TR, lutOf, bitLut, maskLut, otsuCalc, isodata,
         kmorph, khm, kout, kwt, klab, kalg, kEff} = Algos;
  const {KP, KPW} = KernTab;
  const R = {};
  // deterministic synthetic image 64x48
  const w = 64, h = 48, d = new Uint8ClampedArray(w*h*4);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=(y*w+x)*4, inC=(x-20)**2+(y-20)**2<120, inR=x>38&&x<58&&y>10&&y<40;
    d[i]=(x*4+(inC?90:0))&255; d[i+1]=(y*5+(inR?120:0))&255; d[i+2]=((x*y)>>3)&255; d[i+3]=255;
  }
  const H = hist(d); R.hist = H;
  R.gray = Array.from(toGray(d).slice(0, 400));
  // every transform at defaults plus a few parameter variants
  R.luts = {};
  for (const [type, t] of Object.entries(TR)) {
    const v = {}; t.p.forEach(q => v[q[0]] = q[5]);
    R.luts[type] = Array.from(lutOf({type, v, inH: H}));
    t.p.forEach(q => { if (q[6]==='sel') { for (let o=0;o<3;o++) { const v2={...v,[q[0]]:o}; R.luts[type+'_'+q[0]+o]=Array.from(lutOf({type,v:v2,inH:H})); } }
      else { const v2={...v,[q[0]]: q[2] + Math.round((q[3]-q[2])*0.3)}; R.luts[type+'_'+q[0]]=Array.from(lutOf({type,v:v2,inH:H})); } });
  }
  for (let k=1;k<=8;k++) R['bit'+k] = Array.from(bitLut(k));
  [0, 1, 128, 192, 255, 0b10100101].forEach(m => { R['mask'+m] = Array.from(maskLut(m, true)); R['maskraw'+m] = Array.from(maskLut(m, false)); });
  const o = otsuCalc(H); R.otsu = {bt:o.bt, best:o.best, mt:o.mt, vt:o.vt, sb:o.sb, w0:o.w0, m0:o.m0};
  R.isodata = isodata(o);
  R.cdf = cdfOf([...H]); R.mean = meanOf([...H]); R.lohi = lohi([...H], 2);

  // binary/numeric grid tests
  const G = {W: 12, H: 12, C: 40};
  const g = new Uint8Array(G.W*G.H);
  for (let y=0;y<G.H;y++) for (let x=0;x<G.W;x++) g[y*G.W+x] = ((x>1&&x<6&&y>1&&y<9) || ((x-8)**2+(y-7)**2<6) || (x===10&&y<4)) ? 1 : 0;
  R.morph = KP.map(([n, K]) => ({n, e: Array.from(kmorph(G, g, K, 'e')), d: Array.from(kmorph(G, g, K, 'd')), hm: Array.from(khm(G, g, K))}));
  R.kout = ['erode','dilate','hm'].map(op => Array.from(kout(G, {op, K: KP[0][1], conn: 8}, g).v));
  const num = Float64Array.from(g, v => v ? Infinity : 0);
  R.kwt = [];
  KPW.forEach(([n, Wt, dx, dy]) => [true, false].forEach(seq => ['min', 'max'].forEach(red => {
    const st = {Wt, dx, dy, seq, red};
    R.kwt.push({n, seq, red, full: Array.from(kwt(G, num, st)).map(String), part: Array.from(kwt(G, num, st, 40)).map(String)});
  })));
  R.klab = [4, 8].map(conn => [null, 30, 80].map(lim => { const r = klab(G, g, {conn}, lim); return {E: Array.from(r.E), T: r.T, k: r.k}; }));
  R.kalg = ['A − (A ⊖ B)', '(A ⊕ B) − A', '(A ⊕ B) − (A ⊖ B)', '(A ⊖ B) ⊕ B', '(A ⊕ B) ⊖ B',
    'A − ((A ⊖ B) ⊕ B)', 'Aᶜ ∩ (A ⊕ B)', 'B', '(A', 'A ? B', ''].map(e => {
      const r = kalg(G, e, g, KP[1][1]); return r.err ? {err: r.err} : {v: Array.from(r.v)}; });
  R.kEff = [4, 8].map(c => kEff({op: 'label', conn: c, K: KP[0][1]}));
  return JSON.parse(JSON.stringify(R));
}
"""

SNAP_JS = r"""
(label) => {
  const cs = [...document.querySelectorAll('#main canvas, #side canvas')].map(c => { try { return c.width + 'x' + c.height + ':' + c.toDataURL(); } catch (e) { return 'err'; } });
  const txt = document.getElementById('main').innerText;
  const vals = [...document.querySelectorAll('#main input, #main select')].map(e => e.type === 'checkbox' ? e.checked : e.value);
  return {label, cs, txt, vals};
}
"""

HELPERS_JS = r"""
() => {
  window.__t = {
    card(i) { return document.querySelectorAll('#main > section.card')[i]; },
    clickText(root, text, sel) { const b = [...root.querySelectorAll(sel || 'button')].find(b => b.textContent.trim() === text); if (!b) throw new Error('no button ' + text); b.click(); },
    stepCard(i) { return [...document.querySelectorAll('#main > section.card')].filter(c => /^Step /.test(c.querySelector('h2')?.textContent || ''))[i]; },
  };
}
"""


def h(s):
    return hashlib.sha256(s.encode()).hexdigest()[:16]


def summarize(snap):
    return {"label": snap["label"], "canvases": [h(c) for c in snap["cs"]], "text": h(snap["txt"]), "vals": snap["vals"]}


def run(path):
    out = {"errors": [], "snaps": []}
    url = pathlib.Path(path).resolve().as_uri()
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 1280, "height": 1000})
        # test-only: no smooth scrolling, so screenshots never land mid-scroll
        ctx.add_init_script("Element.prototype.scrollIntoView=function(){};")
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: out["errors"].append(str(e)))
        pg.goto(url); pg.wait_for_timeout(300)
        out["pure"] = pg.evaluate(PURE_JS)
        pg.evaluate(HELPERS_JS)

        def snap(label):
            pg.wait_for_timeout(120)
            sm = summarize(pg.evaluate(SNAP_JS, label))
            sm["shot"] = pg.screenshot(full_page=True, animations="disabled", caret="hide")
            out["snaps"].append(sm)

        def ev(js):
            # space actions past the 250ms save debounce so each is its own undo step
            pg.evaluate(js); pg.wait_for_timeout(320)

        # ---------- Histogram tab ----------
        ev("""async () => { const c=document.createElement('canvas');c.width=80;c.height=60;const x=c.getContext('2d');
          const g=x.createLinearGradient(0,0,80,60);g.addColorStop(0,'#123');g.addColorStop(1,'#fd8');x.fillStyle=g;x.fillRect(0,0,80,60);
          x.fillStyle='#e33';x.beginPath();x.arc(28,26,14,0,7);x.fill();x.fillStyle='#2b6';x.fillRect(50,8,22,40);
          const b=await new Promise(r=>c.toBlob(r,'image/png'));await Core.addImage(b); }""")
        pg.wait_for_timeout(300); snap("hist:loaded")
        ev("__t.card(0).querySelector('button.add').click()"); snap("hist:picker")
        ev("__t.card(0).querySelectorAll('.picker .tile')[5].click()"); snap("hist:gamma")
        ev("""() => { const r=__t.card(1).querySelector('input[type=range]'); r.value=40; r.dispatchEvent(new Event('input')); }"""); snap("hist:gamma-slider")
        ev("__t.card(1).querySelector('button.add').click(); __t.card(1).querySelectorAll('.picker .tile')[12].click()"); snap("hist:equalize-chain")
        ev("""() => { const s=document.querySelector('#main select'); }""")
        ev("document.getElementById('gray').click()"); snap("hist:color")
        ev("document.getElementById('gray').click()")

        # ---------- Bits tab ----------
        ev("document.querySelector('.tabs button[data-tab=bits]').click()"); pg.wait_for_timeout(300); snap("bits:empty")
        ev("""async () => { const c=document.createElement('canvas');c.width=40;c.height=30;const x=c.getContext('2d');
          for(let i=0;i<40;i++){x.fillStyle=`rgb(${i*6},${255-i*6},${i*3})`;x.fillRect(i,0,1,30)}
          const b=await new Promise(r=>c.toBlob(r,'image/png'));await Core.addImage(b); }""")
        pg.wait_for_timeout(300); snap("bits:loaded")
        ev("__t.clickText(document.getElementById('main'), '6', 'button.chip')"); snap("bits:chip6")
        ev("__t.clickText(document.getElementById('main'), '8 to 5')"); snap("bits:preset")
        ev("document.querySelector('#main label.sw input').click()"); snap("bits:norm-off")

        # ---------- Otsu tab ----------
        ev("document.querySelector('.tabs button[data-tab=otsu]').click()"); pg.wait_for_timeout(300)
        ev("""async () => { const c=document.createElement('canvas');c.width=60;c.height=40;const x=c.getContext('2d');
          x.fillStyle='#333';x.fillRect(0,0,60,40);x.fillStyle='#ccc';x.fillRect(10,8,30,20);x.fillStyle='#888';x.fillRect(42,5,12,30);
          const b=await new Promise(r=>c.toBlob(r,'image/png'));await Core.addImage(b); }""")
        pg.wait_for_timeout(300); snap("otsu:loaded")
        ev("for(let i=0;i<3;i++)document.querySelector('#main button[title=\"Next threshold\"]').click()"); snap("otsu:next3")
        ev("__t.clickText(document.getElementById('main'), 'Derivation')"); snap("otsu:derivation")
        ev("__t.clickText(document.getElementById('main'), 'Otsu optimum')"); snap("otsu:optimum")
        ev("__t.clickText(document.getElementById('main'), 'Numbers')")

        # ---------- Kernels tab ----------
        ev("document.querySelector('.tabs button[data-tab=kern]').click()"); pg.wait_for_timeout(300); snap("kern:new")

        def cellxy(card, cx, cy):
            box = pg.evaluate("""([i]) => { const cv=__t.stepCard(i).querySelector('canvas.kcv'); const r=cv.getBoundingClientRect(); const G=Algos.kGrid(App.cur.k); const m=(cv.width/G.C-G.W)/2; return [r.left,r.top,r.width,r.height,G.W,G.H,m]; }""", [card])
            l, t, w, hh, kw, kh, m = box
            return (l + (cx + m + 0.5) / (kw + 2 * m) * w, t + (cy + m + 0.5) / (kh + 2 * m) * hh)

        def drag(card, a, b):
            pg.mouse.move(*cellxy(card, *a)); pg.mouse.down()
            pg.mouse.move(*cellxy(card, *b), steps=4); pg.mouse.up(); pg.wait_for_timeout(320)

        ev("document.querySelector('#main button[aria-label=Rectangle]').click()")
        drag(0, (1, 1), (5, 7)); snap("kern:rect")
        ev("document.querySelector('#main button[aria-label=Ellipse]').click()")
        drag(0, (6, 5), (10, 9)); snap("kern:ellipse")
        ev("document.querySelector('#main button[aria-label^=\"Paint\"]').click()")
        drag(0, (10, 0), (10, 3)); snap("kern:paint")
        ev("document.querySelector('#main button[aria-label^=\"Select\"]').click()")
        pg.mouse.click(*cellxy(0, 2, 2)); snap("kern:select")
        ev("__t.stepCard(0).querySelectorAll('button.km')[0].click()"); snap("kern:preset")
        for _ in range(14): pg.keyboard.press("ArrowRight")
        snap("kern:erode-step")
        ev("__t.clickText(__t.stepCard(0), 'Dilation')"); snap("kern:dilate")
        ev("__t.clickText(__t.stepCard(0), 'Hit-or-miss')"); snap("kern:hm")
        ev("__t.clickText(__t.stepCard(0), 'Thresholded')"); snap("kern:view-thresh")
        ev("__t.clickText(__t.stepCard(0), 'Binary numbers')"); snap("kern:view-num")
        ev("__t.clickText(__t.stepCard(0), 'Algebra')"); snap("kern:alg")
        ev("__t.clickText(__t.stepCard(0), 'Gradient')"); snap("kern:alg-gradient")
        ev("__t.clickText(__t.stepCard(0), 'Weighted min/max-plus')"); snap("kern:wt")
        ev("__t.clickText(__t.stepCard(0), 'Start')")
        for _ in range(20): pg.keyboard.press("ArrowRight")
        snap("kern:wt-scan")
        ev("__t.clickText(__t.stepCard(0), 'Maximum')"); snap("kern:wt-max")
        ev("__t.clickText(__t.stepCard(0), 'From input')"); snap("kern:wt-frominput")
        ev("__t.clickText(__t.stepCard(0), 'Sequential labeling')"); snap("kern:label")
        ev("__t.clickText(__t.stepCard(0), 'Start')")
        for _ in range(30): pg.keyboard.press("ArrowRight")
        snap("kern:label-partial")
        ev("__t.clickText(__t.stepCard(0), 'End')"); snap("kern:label-end")
        for _ in range(3): pg.keyboard.press("ArrowRight")
        snap("kern:label-upgrade")
        ev("__t.clickText(__t.stepCard(0), 'V4: left, up')"); snap("kern:label-v4")
        ev("() => { const mb=__t.stepCard(0).querySelector('.mh button'); mb.click(); __t.stepCard(0).querySelector('.menu button').click(); }")
        pg.wait_for_timeout(200); snap("kern:chained")
        ev("__t.clickText(__t.stepCard(1), 'Relabel through table')"); snap("kern:apply")
        ev("__t.clickText(__t.stepCard(1), 'Start')")
        for _ in range(25): pg.keyboard.press("ArrowRight")
        snap("kern:apply-scan")
        ev("() => { const mb=__t.stepCard(1).querySelector('.mh button'); mb.click(); __t.stepCard(1).querySelector('.menu button').click(); }")
        pg.wait_for_timeout(200)
        ev("__t.clickText(__t.stepCard(2), 'Erosion')"); snap("kern:step3")
        ev("__t.clickText(__t.stepCard(2), 'Remove this step')"); snap("kern:removed-step")
        ev("""() => { const e=document.querySelectorAll('#main label.sw input[type=number]'); e[0].value=8; e[0].dispatchEvent(new Event('change')); }"""); snap("kern:grid8")

        # ---------- undo / redo ----------
        pg.wait_for_timeout(400)
        ev("document.getElementById('undo').click()"); pg.wait_for_timeout(350); snap("undo1")
        ev("document.getElementById('undo').click()"); pg.wait_for_timeout(350); snap("undo2")
        ev("document.getElementById('redo').click()"); pg.wait_for_timeout(350); snap("redo1")
        ev("document.getElementById('theme').click()"); snap("theme-toggle")

        # ---------- reload / restore ----------
        pg.wait_for_timeout(400)
        pg.reload(); pg.wait_for_timeout(900)
        for t in ["kern", "otsu", "bits", "hist"]:
            ev(f"document.querySelector('.tabs button[data-tab={t}]').click()"); pg.wait_for_timeout(300); snap("restore:" + t)
        br.close()
    return out


def main():
    mode, path = sys.argv[1], sys.argv[2]
    res = run(path)
    if mode == "record":
        SHOTS.mkdir(exist_ok=True)
        for sm in res["snaps"]:
            (SHOTS / (sm["label"].replace(":", "_") + ".png")).write_bytes(sm.pop("shot"))
        GOLDEN.write_text(json.dumps(res))
        print(f"recorded {len(res['snaps'])} UI checkpoints, {len(res['pure'])} pure-function groups, page errors: {res['errors']}")
        return
    gold = json.loads(GOLDEN.read_text())
    bad = 0
    for k in gold["pure"]:
        if json.dumps(gold["pure"][k]) != json.dumps(res["pure"].get(k)):
            print("PURE MISMATCH:", k); bad += 1
    for a, b in zip(gold["snaps"], res["snaps"]):
        for f in ("canvases", "text", "vals"):
            if a[f] != b[f]:
                print(f"UI MISMATCH at {a['label']}: {f}"); bad += 1
        d = shot_diff(SHOTS / (a["label"].replace(":", "_") + ".png"), b["shot"])
        if d:
            print(f"SCREENSHOT MISMATCH at {a['label']}: {d}"); bad += 1
    if len(gold["snaps"]) != len(res["snaps"]):
        print("checkpoint count differs"); bad += 1
    if res["errors"] != gold["errors"]:
        print("page errors:", res["errors"]); bad += 1
    print("PASS" if not bad else f"FAIL ({bad} differences)", f"- {len(res['snaps'])} UI checkpoints, {len(res['pure'])} pure groups")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
