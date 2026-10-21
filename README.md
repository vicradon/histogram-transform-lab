# Histogram Transform Lab

An interactive image-processing lab in a single HTML file, with no build step. Live at https://histogram-transform-lab.vercel.app.

It has four tabs:

- **Histogram transforms:** chain point transforms (gamma, log, piecewise, equalization, and more) and see each $T(r)$ curve over the input histogram.
- **Bit-plane slicing:** view each of the 8 bit planes, or a chosen group of them.
- **Kernels & morphology:** draw a binary image, then step a kernel across it. Supports erosion, dilation, hit-or-miss, morphological algebra, weighted min/max-plus scans, and sequential labeling with a correspondence table.
- **Otsu threshold:** steps through the between-class variance search, with the derivation.

Sessions are saved in the browser (localStorage, plus IndexedDB for images).

## Code layout

No build step. `index.html` holds the markup and loads plain scripts in this order (each file only uses the ones above it):

| File | Namespace | Contents |
|---|---|---|
| `css/styles.css` | | theme tokens, layout, shared controls, then one block per tab |
| `js/algos.js` | `Algos` | pure math, no DOM |
| `js/core.js` | `App`, `Core` | shared state; sessions, persistence, undo/redo, theme, PDF helpers, tab registry |
| `js/tabs/*.js` | `HistTab`, `BitsTab`, `KernTab`, `OtsuTab` | one per tab; each ends with `registerTab(...)` |
| `js/boot.js` | | first render and restore |

To add a tab, add a file under `js/tabs/`, load it in `index.html`, and register it with `registerTab(name, {render, paint, exportPdf?, thumb?, newSession?, noImages?})`.

## Tests

`tests/harness.py` is a regression safety net. It records golden outputs of every pure function, then drives the UI through all four tabs in headless Chromium. At 51 checkpoints it compares the canvases, the visible text, and a screenshot of the whole page.

```bash
pip install playwright pillow && playwright install chromium
python3 tests/harness.py check index.html    # compare against the golden outputs
python3 tests/harness.py record index.html   # re-baseline after an intentional change
```

`tests/CHECKLIST.md` lists what still needs a manual check (paste, PDF export, MathJax, phone layout).

## Deployment

The site is served as static files on Vercel. `tests/` is excluded from deploys by `.vercelignore`.
