# Open-house posters (24×36″)

Two companion posters plus stand-in presenter notes.

| File | What it is |
|---|---|
| `teachme-poster-24x36.pdf` | **TeachMe platform poster** — multi-domain framing ("Retrieve for the learner, not just the query"), print PDF |
| `teachme-multidomain-poster-24x36.pptx` | Same poster as a fully **editable** PowerPoint (evolved in place from the earlier AJP-only deck) |
| `necessity-audit-poster-24x36.pdf` | **Necessity-audit research poster** — the measurement-instrument framing, print PDF |
| `necessity-audit-poster-24x36.pptx` | Same poster as a 24×36 PowerPoint (full-bleed 288-dpi image slide — prints identically to the PDF, not text-editable) |
| `presenter-notes.md` | Briefing for a stand-in presenter: pitch, walkthrough, Q&A with honest answers, do-not-claim guardrails |
| `Main.dc.html` · `TeachMe.dc.html` · `canvas.json` | Design-canvas sources for the two artboards (Claude Design format; 2304×3456 px at 96 ppi = 24×36″) |
| `figure.svg` | Vector of the real 5-family dose-response figure (same data as the paper's `fig:factqa_dose`) |
| `qr.png` | QR code → this repository |

## Regenerating the PDFs

The PDFs are printed from the artboards via headless Chromium: inline `qr.png`
as a data URI into the artboard body, load at a 2304×3456 viewport, and print
with `page.pdf(width='24in', height='36in', print_background=True)`
(Playwright). The artboards use locally available font stacks
(Cambria/Georgia, Calibri/system sans, Courier New), so rendering environments
without Cambria/Calibri fall back to Georgia/Arial with slightly different
metrics.

## Content provenance

Every claim and number on both posters traces to `README.md` (platform claims,
domains, modes) or the measurement paper in `necessity-audit/`
(calibration across five base-model lineages; evidence-strength language).
Human-outcome claims are deliberately absent: all results are
simulation-based mechanism evidence, and the posters say so.
