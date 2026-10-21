# Manual checklist (things the harness can't see)

Run `python3 tests/harness.py check histogram-lab.html` first. Then, in a real browser:

- [ ] Paste an image with Ctrl/Cmd+V, and drop one onto the page
- [ ] Histogram: hover a transform tile in the picker; remove a node with children
- [ ] Export PDF on the Histogram and Bit-plane tabs (needs jsPDF from the CDN)
- [ ] Otsu: MathJax renders the formulas; "Play the search" animates; chart tooltips on hover
- [ ] Kernels: drag a preset onto the grid; drag the kernel tile from the editor; ghost cells outside the border appear
- [ ] Kernels: group (G), ungroup (Shift+G), delete (Del), arrow keys step the kernel
- [ ] Kernels: paste a numeric grid with ∞ and load it
- [ ] Ctrl+Z / Ctrl+Y work; they don't fire while typing in a text field
- [ ] Toggle theme, reload: theme and all four tabs' sessions come back
- [ ] Kernels, whole image: paste a photo into the Kernels tab; Apply erosion, a 7 x 7 top-hat (Algebra, Top-hat), then Stretch contrast
- [ ] Kernels, whole image: Binary source with Otsu, drag the threshold (results dim until Apply), Sequential labeling then Relabel through table
- [ ] Kernels, whole image: hover a result to read pixel values; reload and check applied steps come back
- [ ] Phone width: no horizontal scroll, session strip scrolls sideways
