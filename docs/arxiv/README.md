# arXiv paper — measurement-method draft

The **C1+C2-led** measurement paper (see [`../publication-plan.md`](../publication-plan.md)
and [`../novelty-and-positioning.md`](../novelty-and-positioning.md)). This is the intended
**arXiv + workshop** deliverable; the AJP system paper (`../whitepaper.md`/`.tex`) is
supporting material, not the submission.

## Files

| File | Role |
|---|---|
| `main.tex` | The manuscript. Self-contained preprint layout (`article`, standard packages). |
| `refs.bib` | Bibliography (natbib). Several entries are 2026 preprints — **verify venue/version at submission** and re-run the prior-art scan (novelty doc §10). |

## Build

```bash
cd docs/arxiv
./build.sh          # -> main.pdf
```

`build.sh` uses `latexmk` (or `pdflatex`+`bibtex`) if a TeX install is present; otherwise it
self-bootstraps a [Tectonic](https://tectonic-typesetting.github.io/) binary (self-contained,
fetches packages on demand) — so it works in a fresh Claude-on-the-web sandbox with no TeX
install. Equivalent manual flow: `pdflatex main && bibtex main && pdflatex main && pdflatex main`.

## Overleaf

Two ways to get this into Overleaf:

1. **Upload a zip** — zip the two source files and upload:
   ```bash
   cd docs/arxiv && zip -j teachme-arxiv.zip main.tex refs.bib
   ```
   In Overleaf: **New Project → Upload Project →** select the zip. Overleaf sets `main.tex`
   as the main document; the default **pdfLaTeX** compiler auto-runs BibTeX for the
   `\bibliography{refs}` call. (No custom settings needed.)
2. **Import from GitHub** — Overleaf **New Project → Import from GitHub →** this repo, then
   set the main document to `docs/arxiv/main.tex`.

## Before submitting

- Fill in the author block (currently a placeholder) and affiliation.
- Author names/titles in `refs.bib` marked `Anonymous`/partial are placeholders for
  fast-moving 2026 preprints — complete them from the arXiv abstract pages.
- Numbers already in the draft are **real / offline-validated**: estimator recovery
  (Elo MAE 0.046, ECE 0.023; BKT 0.997 vs 0.175, ECE 0.004), mock-learner leakage recovery
  (δ 1.000 / 0.000), the procedural-domain gradient (J 204→0), and the **real-model
  corpus-binding positive control** on `gemini-flash-latest` (δ 1.000, counterfactual
  followed, closed-book abstained → corpus-bound).
- **Compute-gated, still to fill:** the multi-model `bound`-vs-`unconstrained`
  discrimination table (needs a paid API tier; harness = `npm run colreg:leakage`
  `CONDITION=both`) and the open-weight unlearning 2×2 (needs a GPU;
  `experiments/unlearning/colab.ipynb`).
- Scope guard: keep every claim framed as **simulation-based mechanism evidence, not
  human external validity.**
