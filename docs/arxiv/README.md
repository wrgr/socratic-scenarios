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

No TeX toolchain ships in the web sandbox, so build locally or in CI:

```bash
cd docs/arxiv
pdflatex main && bibtex main && pdflatex main && pdflatex main
# -> main.pdf
```

Or `latexmk -pdf main.tex`.

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
