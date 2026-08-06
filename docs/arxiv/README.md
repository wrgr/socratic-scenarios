# Paper — NeurIPS 2026 TAE workshop submission

The **C1+C2-led** measurement paper (see [`../publication-plan.md`](../publication-plan.md)
and [`../novelty-and-positioning.md`](../novelty-and-positioning.md)), formatted for the
**NeurIPS 2026 workshop "Can We Trust AI Evaluation? (TAE)"** — double-blind, ≤8 pages
excluding references/appendix, non-archival, deadline **Aug 29, 2026**. The AJP system paper
(`../whitepaper.md`/`.tex`) is supporting material, not the submission.

## Files

| File | Role |
|---|---|
| `main.tex` | The manuscript. Uses the NeurIPS workshop style (`\usepackage[dblblindworkshop]{neurips_2026}` + `\workshoptitle{...}`). |
| `neurips_2026.sty` | NeurIPS workshop style. **This is the official 2025 style with the year bumped to 2026** (same `dblblindworkshop` option) — **replace it with the official NeurIPS 2026 style** from the workshop's OpenReview page before final submission. |
| `refs.bib` | Bibliography (natbib, loaded by the NeurIPS style). Several entries are 2026 preprints — **verify venue/version at submission** and re-run the prior-art scan (novelty doc §10). |

## Submission notes (TAE / NeurIPS 2026 workshop)

- **Double-blind:** authors are anonymized by the style in submission mode; the body carries
  no identifying strings and the code release is withheld to preserve anonymity.
- **Page limit:** ≤8 pages excluding references and appendix (currently ~7pp of body).
- **arXiv preprint version:** the workshop is non-archival, so the same content may go on
  arXiv. To build a non-anonymized preprint, change the option to
  `\usepackage[preprint]{neurips_2026}` and fill in the real author block.

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

1. **Upload a zip** — zip the source files **including the style** and upload:
   ```bash
   cd docs/arxiv && zip -j teachme-tae.zip main.tex refs.bib neurips_2026.sty
   ```
   In Overleaf: **New Project → Upload Project →** select the zip. Overleaf sets `main.tex`
   as the main document; the default **pdfLaTeX** compiler auto-runs BibTeX for the
   `\bibliography{refs}` call. (No custom settings needed. The `.sty` must be in the zip.)
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
- **Real-model discrimination (Table 3): done** on **six** LLMs — `CONDITION=both
  npm run colreg:leakage`. Strong flash models bind tightly (go inconclusive unconstrained);
  lighter models flip to leaking; the lightest leaks even under the bound prompt.
- **Construct validity + grading (Table 1): done** — `npm run colreg:construct` (naive vs
  VO vs SB-MPC across 9 varied encounters; 19 distinct J values, graded not near-binary).
- **Reviewer hardening done:** terminology is "reference policy" not "optimal" (VO/SB-MPC
  are near-optimal solvers, not proven optima); the KC→metric identifiability objection is
  addressed head-on (§3); the coarse ablation sub-metric vs graded transfer J is clarified.
- **Compute-gated, still to fill:** the open-weight unlearning 2×2 (needs a GPU;
  `experiments/unlearning/colab.ipynb`).
- Scope guard: keep every claim framed as **simulation-based mechanism evidence, not
  human external validity.**
